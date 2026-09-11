import { useCallback, useEffect, useRef, useState } from 'react';
import { AppState, AppStateStatus, PermissionsAndroid, Platform } from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import {
  addNotificationListener,
  drainPending,
  isAvailable,
  isIgnoringBatteryOptimizations,
  isPermissionGranted,
  setWatchedPackages,
  type CapturedNotification,
} from '../../modules/notification-listener';
import { supabase } from '../services/supabase';
import { parsePayment } from '../utils/paymentParser';
import { Transaction } from '../types';

/** How far back the feed reaches. Older rows stay in the table, just unfetched. */
const FEED_LIMIT = 100;

/**
 * Literal reposts we have already handled, kept on the device.
 *
 * The server's dedup_key catches a re-post that lands in the same minute, and
 * record_transaction() catches the partner's copy of the same payment. This
 * catches the third case: the identical notification handed to us twice across
 * a restart, where a round trip would otherwise be spent learning nothing.
 */
const SEEN_KEY = 'novia.payments.seen';
const SEEN_MAX = 300;

/**
 * Captures whose upload failed, held until it can be retried.
 *
 * Draining the native queue is destructive — the entries are gone from the
 * device the moment they are read. So a failed post (offline, server down, a
 * session that needs refreshing) has nowhere to fall back to unless it is
 * written down here. Without this the payment is lost permanently, which is
 * precisely the failure this feature exists to prevent.
 */
const RETRY_KEY = 'novia.payments.retry';
const RETRY_MAX = 50;

function rawKey(n: CapturedNotification): string {
  return `${n.packageName}|${n.postTime}|${n.title}|${n.text}`;
}

/**
 * The feed's read of a row.
 *
 * `direction` on a row is stated relative to whoever's phone observed it, and
 * only one of the two phones' observations survives the pairing in
 * record_transaction() — so the stored direction may be the *partner's* point
 * of view. Flipping it for the reader is what keeps "you sent" from showing up
 * on the phone that received the money.
 */
export function directionFor(row: Transaction, userId: string | null): 'sent' | 'received' {
  if (!userId || row.user_id === userId) return row.direction;
  return row.direction === 'sent' ? 'received' : 'sent';
}

export interface TransactionsState {
  transactions: Transaction[];
  loading: boolean;
  /** False on iOS and on Android builds that predate the native module. */
  supported: boolean;
  /** Whether the OS is currently letting us read notifications. */
  permitted: boolean;
  /** False means an OEM battery saver can silently stop detection. */
  batteryExempt: boolean;
  /** RECEIVE_SMS — the primary source, since the bank texts every transfer. */
  smsGranted: boolean;
  /** Shows the system permission dialog. Resolves once the user answers. */
  requestSms: () => Promise<void>;
  refresh: () => Promise<void>;
  /** Re-reads the OS permission state, e.g. on return from Settings. */
  recheckPermission: () => void;
  /** False until the first permission read lands — render nothing until then. */
  permissionsChecked: boolean;
}

/**
 * Note there is no userId parameter: every write goes through
 * record_transaction(), which resolves the caller from auth.uid() server-side,
 * and the reader's own id is only needed to orient a row — which is what
 * directionFor() above is for.
 */
export function useTransactions(
  coupleId: string | null,
  partnerAliases: string[]
): TransactionsState {
  const [transactions, setTransactions] = useState<Transaction[]>([]);
  const [loading, setLoading] = useState(true);
  const [permitted, setPermitted] = useState(false);
  const [batteryExempt, setBatteryExempt] = useState(true);
  const [smsGranted, setSmsGranted] = useState(false);
  // The SMS check is async, so on the first render nothing is known yet. Until
  // it resolves the screen must not claim the permission is missing, or every
  // launch flashes the onboarding card at someone who set this up weeks ago.
  const [permissionsChecked, setPermissionsChecked] = useState(false);
  const channelRef = useRef<any>(null);

  // Read once: the aliases and ids change, but the native module either exists
  // in this binary or never will.
  const supported = useRef(isAvailable()).current;

  // The ingest path runs from a native callback and from an AppState change,
  // neither of which re-renders first — so it reads its inputs from refs to
  // avoid ingesting against a stale closure's alias list.
  const aliasRef = useRef(partnerAliases);
  aliasRef.current = partnerAliases;
  const coupleRef = useRef(coupleId);
  coupleRef.current = coupleId;
  const ingesting = useRef(false);
  const ingestQueued = useRef(false);

  const fetchTransactions = useCallback(async () => {
    if (!coupleId) {
      setTransactions([]);
      setLoading(false);
      return;
    }

    const { data, error } = await supabase
      .from('transactions')
      .select('*')
      .eq('couple_id', coupleId)
      .order('occurred_at', { ascending: false })
      .limit(FEED_LIMIT);

    if (error) {
      console.error('[Payments] Fetch failed:', error.message);
      setLoading(false);
      return;
    }

    setTransactions((data || []) as Transaction[]);
    setLoading(false);
  }, [coupleId]);

  /**
   * Drain whatever the listener captured while JS was asleep, parse it, and
   * post what turns out to be a payment between the two partners.
   *
   * Guarded against re-entry rather than debounced: a drain empties the native
   * queue, so two overlapping runs would race to claim the same entries and the
   * loser would come back empty while the winner posts twice.
   */
  const ingest = useCallback(async () => {
    if (!supported || !coupleRef.current) return;

    // Re-entrant call: remember that there is more to do rather than dropping
    // it. A notification that arrives mid-ingest was appended to the native
    // queue before its event fired, so it is sitting there waiting — and
    // without this flag it would wait until the app was next foregrounded.
    if (ingesting.current) {
      ingestQueued.current = true;
      return;
    }

    ingesting.current = true;
    try {
      const retryRaw = await AsyncStorage.getItem(RETRY_KEY);
      const retries: CapturedNotification[] = retryRaw ? JSON.parse(retryRaw) : [];
      // Retries first: they are older, and the feed reads better in order.
      const pending = [...retries, ...drainPending()];
      if (pending.length === 0) return;

      const seenRaw = await AsyncStorage.getItem(SEEN_KEY);
      const seen: string[] = seenRaw ? JSON.parse(seenRaw) : [];
      const seenSet = new Set(seen);

      const failed: CapturedNotification[] = [];
      let posted = 0;

      for (const notification of pending) {
        const key = rawKey(notification);
        if (seenSet.has(key)) continue;

        const payment = parsePayment(notification, aliasRef.current);
        if (!payment) {
          // Not a payment between them. Nothing to upload, but remember it so
          // the same message is not re-parsed on every future drain.
          seenSet.add(key);
          seen.push(key);
          continue;
        }

        const { error } = await supabase.rpc('record_transaction', {
          p_direction: payment.direction,
          p_amount: payment.amount,
          p_counterparty: payment.counterparty,
          p_source_package: payment.sourcePackage,
          p_occurred_at: payment.occurredAt,
          p_dedup_key: payment.dedupKey,
        });

        if (error) {
          console.error('[Payments] Record failed:', error.message);
          // Hold the capture itself, not just the fact that it failed — the
          // native queue has already let go of it.
          failed.push(notification);
          continue;
        }

        seenSet.add(key);
        seen.push(key);
        posted += 1;
      }

      await AsyncStorage.multiSet([
        [SEEN_KEY, JSON.stringify(seen.slice(-SEEN_MAX))],
        // Newest kept when the cap bites: an old failure is likely a message
        // whose wording we cannot parse anyway.
        [RETRY_KEY, JSON.stringify(failed.slice(-RETRY_MAX))],
      ]);

      // Realtime will deliver the row too, but only for rows this couple's
      // server actually inserted; refreshing here also covers the case where a
      // post was collapsed into the partner's existing row.
      if (posted > 0) await fetchTransactions();
    } catch (e: any) {
      console.error('[Payments] Ingest failed:', e?.message ?? e);
    } finally {
      ingesting.current = false;
      if (ingestQueued.current) {
        ingestQueued.current = false;
        ingest();
      }
    }
  }, [supported, fetchTransactions]);

  const recheckPermission = useCallback(() => {
    if (!supported) {
      setPermissionsChecked(true);
      return;
    }
    setPermitted(isPermissionGranted());
    setBatteryExempt(isIgnoringBatteryOptimizations());
    if (Platform.OS !== 'android') {
      setPermissionsChecked(true);
      return;
    }
    PermissionsAndroid.check(PermissionsAndroid.PERMISSIONS.RECEIVE_SMS)
      .then(setSmsGranted)
      .catch(() => setSmsGranted(false))
      .finally(() => setPermissionsChecked(true));
  }, [supported]);

  /**
   * Ask for RECEIVE_SMS.
   *
   * Worth preferring over notification access wherever the bank texts: it is
   * one dialog rather than a walk into Settings, it fires whether or not the
   * messaging app's notifications are on, and it hands over the whole message
   * instead of whatever a collapsed notification happened to show.
   */
  const requestSms = useCallback(async () => {
    if (Platform.OS !== 'android') return;
    try {
      const result = await PermissionsAndroid.request(
        PermissionsAndroid.PERMISSIONS.RECEIVE_SMS,
        {
          title: 'Let NOVIA read payment texts',
          message:
            'Your bank texts every transfer. NOVIA reads those texts to log money moving between the two of you, and ignores everything else.',
          buttonPositive: 'Allow',
          buttonNegative: 'Not now',
        }
      );
      setSmsGranted(result === PermissionsAndroid.RESULTS.GRANTED);
    } catch (e) {
      setSmsGranted(false);
    }
  }, []);

  // Tell the native side which apps to watch. Doing it from JS is what lets the
  // list change in an over-the-air update instead of a new binary.
  useEffect(() => {
    if (!supported) return;
    setWatchedPackages([
      'com.google.android.apps.nbu.paisa.user', // Google Pay (India)
      'com.phonepe.app',
      'net.one97.paytm',
      'com.paypal.android.p2pmobile',
      'com.sbi.lotusintouch',
    ]);
    recheckPermission();
  }, [supported, recheckPermission]);

  // Data + realtime.
  useEffect(() => {
    if (!coupleId) {
      setTransactions([]);
      setLoading(false);
      return;
    }

    setLoading(true);
    fetchTransactions();

    channelRef.current = supabase
      .channel(`transactions-sync:${coupleId}`)
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'transactions',
          filter: `couple_id=eq.${coupleId}`,
        },
        () => fetchTransactions()
      )
      .subscribe();

    return () => {
      if (channelRef.current) supabase.removeChannel(channelRef.current);
      channelRef.current = null;
    };
  }, [coupleId, fetchTransactions]);

  // Ingest: on mount, whenever the app comes forward, and live while it's open.
  useEffect(() => {
    if (!supported || !coupleId) return;

    ingest();

    const sub = addNotificationListener(() => {
      // The payload is already queued natively; drain rather than parse it
      // here, so the live path and the cold path are the same code.
      ingest();
    });

    const onAppState = (state: AppStateStatus) => {
      if (state !== 'active') return;
      recheckPermission();
      ingest();
    };
    const appSub = AppState.addEventListener('change', onAppState);

    return () => {
      sub?.remove();
      appSub.remove();
    };
  }, [supported, coupleId, ingest, recheckPermission]);

  return {
    transactions,
    loading,
    supported,
    permitted,
    batteryExempt,
    smsGranted,
    requestSms,
    permissionsChecked,
    refresh: fetchTransactions,
    recheckPermission,
  };
}
