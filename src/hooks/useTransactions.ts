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
    if (!supported || ingesting.current) return;
    if (!coupleRef.current) return;

    ingesting.current = true;
    try {
      const pending = drainPending();
      if (pending.length === 0) return;

      const seenRaw = await AsyncStorage.getItem(SEEN_KEY);
      const seen: string[] = seenRaw ? JSON.parse(seenRaw) : [];
      const seenSet = new Set(seen);

      let posted = 0;
      for (const notification of pending) {
        const key = rawKey(notification);
        if (seenSet.has(key)) continue;
        seenSet.add(key);
        seen.push(key);

        const payment = parsePayment(notification, aliasRef.current);
        if (!payment) continue;

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
          // Forget it locally so the next drain can retry — a dropped payment
          // is worse than a duplicate attempt, which the server collapses.
          seenSet.delete(key);
          seen.pop();
          continue;
        }
        posted += 1;
      }

      await AsyncStorage.setItem(SEEN_KEY, JSON.stringify(seen.slice(-SEEN_MAX)));

      // Realtime will deliver the row too, but only for rows this couple's
      // server actually inserted; refreshing here also covers the case where a
      // post was collapsed into the partner's existing row.
      if (posted > 0) await fetchTransactions();
    } catch (e: any) {
      console.error('[Payments] Ingest failed:', e?.message ?? e);
    } finally {
      ingesting.current = false;
    }
  }, [supported, fetchTransactions]);

  const recheckPermission = useCallback(() => {
    if (!supported) return;
    setPermitted(isPermissionGranted());
    setBatteryExempt(isIgnoringBatteryOptimizations());
    if (Platform.OS === 'android') {
      PermissionsAndroid.check(PermissionsAndroid.PERMISSIONS.RECEIVE_SMS)
        .then(setSmsGranted)
        .catch(() => setSmsGranted(false));
    }
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
    refresh: fetchTransactions,
    recheckPermission,
  };
}
