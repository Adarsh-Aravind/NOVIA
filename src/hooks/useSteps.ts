import { useCallback, useEffect, useRef, useState } from 'react';
import { AppState, Platform } from 'react-native';
import { supabase } from '../services/supabase';
import { StepCount, StepForfeit } from '../types';

/**
 * Step Duel — daily step competition with a quarterly season.
 *
 * Own steps come from Health Connect on this device; they're upserted to
 * Supabase (public.step_counts, one row per user per day) so the partner can
 * read them. The partner's number comes back the same way, kept live via a
 * realtime subscription (mirrors [[useCheckIns]]).
 *
 * On top of the daily duel this derives a season from the quarter's history:
 * a daily-win tally, the current win streak, and the champion. The "stakes"
 * (public.step_forfeits) is the forfeit the season's loser owes — either partner
 * may set it, and it's shared for motivation through the quarter.
 *
 * Why a lazy require of react-native-health-connect: it's a native module. Before
 * a fresh dev/EAS build links it (or on iOS, or a bare Metro reload after
 * `npm install` but before prebuild), a static import would tear down the JS
 * bundle. Requiring it in a try/catch keeps the app alive and lets the card fall
 * back to an "unavailable" state — the partner + season sides still work, since
 * they're pure Supabase.
 */

export type StepsStatus = 'loading' | 'ready' | 'unavailable' | 'denied';
export type StepLeader = 'me' | 'partner' | 'tie';
/** Winner of a single decided day, or the streak/season holder. */
export type StepSide = 'me' | 'partner' | null;

type HealthConnect = typeof import('react-native-health-connect');

let hcModule: HealthConnect | null | undefined; // undefined = not yet tried, null = tried & absent

function getHealthConnect(): HealthConnect | null {
  if (hcModule !== undefined) return hcModule;
  try {
    // eslint-disable-next-line @typescript-eslint/no-var-requires
    hcModule = require('react-native-health-connect') as HealthConnect;
  } catch {
    hcModule = null;
  }
  return hcModule;
}

/** Format a Date as local 'YYYY-MM-DD' (matches the DATE column semantics). */
function toLocalISODate(d: Date): string {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${y}-${m}-${day}`;
}

const MONTHS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];

interface QuarterInfo {
  startISO: string;
  periodKey: string;
  label: string;
  daysLeft: number;
}

/** Calendar-quarter boundaries for the given day. */
function quarterInfo(now = new Date()): QuarterInfo {
  const y = now.getFullYear();
  const q = Math.floor(now.getMonth() / 3); // 0..3
  const startMonth = q * 3;
  const start = new Date(y, startMonth, 1);
  const end = new Date(y, startMonth + 3, 0); // last day of the quarter
  const todayMid = new Date(y, now.getMonth(), now.getDate());
  const daysLeft = Math.max(0, Math.round((end.getTime() - todayMid.getTime()) / 86400000));
  return {
    startISO: toLocalISODate(start),
    periodKey: `${y}-Q${q + 1}`,
    label: `${MONTHS[startMonth]}–${MONTHS[startMonth + 2]}`,
    daysLeft,
  };
}

/** Local midnight → now, as ISO strings for the Health Connect time filter. */
function todayRange(): { startTime: string; endTime: string } {
  const start = new Date();
  start.setHours(0, 0, 0, 0);
  return { startTime: start.toISOString(), endTime: new Date().toISOString() };
}

async function readTodaySteps(hc: HealthConnect): Promise<number> {
  const result = await hc.aggregateRecord({
    recordType: 'Steps',
    timeRangeFilter: { operator: 'between', ...todayRange() },
  });
  // Steps aggregate resolves to { COUNT_TOTAL: number, ... }.
  return (result as { COUNT_TOTAL?: number })?.COUNT_TOTAL ?? 0;
}

const STEPS_READ = { accessType: 'read', recordType: 'Steps' } as const;
const hasStepsRead = (perms: { accessType: string; recordType: string }[]): boolean =>
  perms.some((p) => p.recordType === 'Steps' && p.accessType === 'read');

/**
 * Read this device's own step total from Health Connect, classifying failures.
 *
 * This only *checks* permission (getGrantedPermissions, no dialog) — it never
 * prompts. Firing the permission dialog automatically on cold start races with
 * the splash/mount transition and Health Connect dismisses it, so the actual
 * request is gesture-driven via requestStepsAccess(). See [[useSteps]].
 */
async function readOwnSteps(): Promise<{ status: StepsStatus; steps: number }> {
  if (Platform.OS !== 'android') return { status: 'unavailable', steps: 0 };

  const hc = getHealthConnect();
  if (!hc) return { status: 'unavailable', steps: 0 };

  try {
    await hc.initialize();

    const sdk = await hc.getSdkStatus();
    if (sdk !== hc.SdkAvailabilityStatus.SDK_AVAILABLE) {
      return { status: 'unavailable', steps: 0 };
    }

    const granted = await hc.getGrantedPermissions();
    if (!hasStepsRead(granted)) {
      return { status: 'denied', steps: 0 };
    }

    return { status: 'ready', steps: await readTodaySteps(hc) };
  } catch (err) {
    console.warn('[Steps] Health Connect read failed:', err);
    return { status: 'unavailable', steps: 0 };
  }
}

/**
 * Prompt for Steps read access. MUST be called from a user gesture — a stray
 * cold-start invocation gets auto-dismissed. Returns whether Steps read ended up
 * granted.
 */
async function requestStepsAccess(): Promise<boolean> {
  if (Platform.OS !== 'android') return false;

  const hc = getHealthConnect();
  if (!hc) return false;

  try {
    await hc.initialize();
    const granted = await hc.requestPermission([STEPS_READ]);
    return hasStepsRead(granted);
  } catch (err) {
    console.warn('[Steps] Permission request failed:', err);
    return false;
  }
}

export interface StepSeason {
  label: string; // e.g. 'Jul–Sep'
  periodKey: string; // e.g. '2026-Q3'
  daysLeft: number;
  myWins: number;
  partnerWins: number;
  champion: StepLeader; // current standing (leader of completed days this quarter)
}

export interface UseStepsResult {
  // Today's duel.
  mySteps: number;
  partnerSteps: number;
  status: StepsStatus;
  loading: boolean;
  leader: StepLeader;
  partnerSynced: boolean;
  // Season.
  season: StepSeason;
  streakHolder: StepSide;
  streakCount: number;
  // Stakes.
  forfeit: string | null;
  forfeitSetByMe: boolean;
  setForfeit: (text: string) => Promise<void>;
  /** Prompt for Health Connect Steps access (from a user tap), then refresh. */
  requestAccess: () => Promise<void>;
  refresh: () => void;
}

const emptySeason = (): StepSeason => {
  const q = quarterInfo();
  return { label: q.label, periodKey: q.periodKey, daysLeft: q.daysLeft, myWins: 0, partnerWins: 0, champion: 'tie' };
};

export function useSteps(
  coupleId: string | null,
  userId: string | null,
  partnerId: string | null | undefined
): UseStepsResult {
  const [mySteps, setMySteps] = useState(0);
  const [partnerSteps, setPartnerSteps] = useState(0);
  const [partnerSynced, setPartnerSynced] = useState(false);
  const [status, setStatus] = useState<StepsStatus>('loading');
  const [season, setSeason] = useState<StepSeason>(emptySeason);
  const [streakHolder, setStreakHolder] = useState<StepSide>(null);
  const [streakCount, setStreakCount] = useState(0);
  const [forfeit, setForfeitText] = useState<string | null>(null);
  const [forfeitSetByMe, setForfeitSetByMe] = useState(false);

  // Guards against setState after unmount and against overlapping reads.
  const mounted = useRef(true);
  const reading = useRef(false);

  // Pull this quarter's rows for the couple: drive today's partner number, the
  // season tally, and the win streak. Returns my own last-synced total for today
  // so the card shows a real number before Health Connect resolves.
  const fetchSeason = useCallback(async (): Promise<number | null> => {
    if (!coupleId) return null;
    const q = quarterInfo();
    const today = toLocalISODate(new Date());

    const { data, error } = await supabase
      .from('step_counts')
      .select('*')
      .eq('couple_id', coupleId)
      .gte('step_date', q.startISO)
      .order('step_date', { ascending: false });

    if (error) {
      console.warn('[Steps] Season fetch failed:', error);
      return null;
    }

    const rows = (data || []) as StepCount[];

    // Collapse to one { me, partner } per day.
    const byDate = new Map<string, { me?: number; partner?: number }>();
    for (const r of rows) {
      const slot = byDate.get(r.step_date) || {};
      if (r.user_id === userId) slot.me = r.steps;
      else if (partnerId && r.user_id === partnerId) slot.partner = r.steps;
      byDate.set(r.step_date, slot);
    }

    // Today's numbers.
    const todaySlot = byDate.get(today);
    const partnerToday = todaySlot?.partner;
    if (mounted.current) {
      setPartnerSteps(partnerToday ?? 0);
      setPartnerSynced(partnerToday != null);
    }

    // Season tally + streak over *completed* contested days (both synced, no tie).
    const decided: { date: string; winner: 'me' | 'partner' }[] = [];
    let myWins = 0;
    let partnerWins = 0;
    for (const [date, s] of byDate) {
      if (date >= today) continue; // today is still in progress
      if (s.me == null || s.partner == null || s.me === s.partner) continue;
      const winner: 'me' | 'partner' = s.me > s.partner ? 'me' : 'partner';
      if (winner === 'me') myWins++;
      else partnerWins++;
      decided.push({ date, winner });
    }

    decided.sort((a, b) => (a.date < b.date ? 1 : -1)); // most recent first
    let holder: StepSide = null;
    let count = 0;
    for (const d of decided) {
      if (holder === null) {
        holder = d.winner;
        count = 1;
      } else if (d.winner === holder) {
        count++;
      } else {
        break;
      }
    }

    if (mounted.current) {
      setSeason({
        label: q.label,
        periodKey: q.periodKey,
        daysLeft: q.daysLeft,
        myWins,
        partnerWins,
        champion: myWins === partnerWins ? 'tie' : myWins > partnerWins ? 'me' : 'partner',
      });
      setStreakHolder(holder);
      setStreakCount(count);
    }

    return todaySlot?.me ?? null;
  }, [coupleId, userId, partnerId]);

  const fetchForfeit = useCallback(async () => {
    if (!coupleId) return;
    const { periodKey } = quarterInfo();
    const { data, error } = await supabase
      .from('step_forfeits')
      .select('*')
      .eq('couple_id', coupleId)
      .eq('period_key', periodKey)
      .maybeSingle();

    if (error) {
      console.warn('[Steps] Forfeit fetch failed:', error);
      return;
    }
    const row = data as StepForfeit | null;
    if (mounted.current) {
      setForfeitText(row?.forfeit ?? null);
      setForfeitSetByMe(!!row && row.set_by === userId);
    }
  }, [coupleId, userId]);

  const setForfeit = useCallback(
    async (text: string) => {
      const trimmed = text.trim();
      if (!coupleId || !userId || !trimmed) return;
      const { periodKey } = quarterInfo();
      const { error } = await supabase.from('step_forfeits').upsert(
        {
          couple_id: coupleId,
          period_key: periodKey,
          forfeit: trimmed,
          set_by: userId,
          updated_at: new Date().toISOString(),
        },
        { onConflict: 'couple_id,period_key' }
      );
      if (error) {
        console.warn('[Steps] Set forfeit failed:', error);
        return;
      }
      await fetchForfeit();
    },
    [coupleId, userId, fetchForfeit]
  );

  const load = useCallback(async () => {
    if (reading.current) return;
    reading.current = true;
    try {
      // Season, partner, forfeit, and my last-synced total first — instant, and
      // works even if Health Connect is unavailable on this device.
      const [lastSynced] = await Promise.all([fetchSeason(), fetchForfeit()]);
      if (lastSynced != null && mounted.current) setMySteps(lastSynced);

      // My live steps from Health Connect; push the fresh total to Supabase.
      const own = await readOwnSteps();
      if (!mounted.current) return;
      setStatus(own.status);

      if (own.status === 'ready') {
        setMySteps(own.steps);
        if (coupleId && userId) {
          const { error } = await supabase.from('step_counts').upsert(
            {
              couple_id: coupleId,
              user_id: userId,
              step_date: toLocalISODate(new Date()),
              steps: own.steps,
              updated_at: new Date().toISOString(),
            },
            { onConflict: 'user_id,step_date' }
          );
          if (error) console.warn('[Steps] Sync failed:', error);
        }
      }
    } finally {
      reading.current = false;
    }
  }, [coupleId, userId, fetchSeason, fetchForfeit]);

  // Gesture-driven permission prompt; re-read once granted.
  const requestAccess = useCallback(async () => {
    const ok = await requestStepsAccess();
    if (ok) await load();
  }, [load]);

  useEffect(() => {
    mounted.current = true;

    if (!coupleId) {
      setStatus('unavailable');
      return () => {
        mounted.current = false;
      };
    }

    load();

    // Refresh on foreground — Google Fit → Health Connect sync lags, and the
    // partner may have synced while we were backgrounded.
    const appStateSub = AppState.addEventListener('change', (state) => {
      if (state === 'active') load();
    });

    // Live updates for both the daily counts and the stakes.
    const channel = supabase
      .channel(`steps-sync:${coupleId}`)
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'step_counts', filter: `couple_id=eq.${coupleId}` },
        () => fetchSeason()
      )
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'step_forfeits', filter: `couple_id=eq.${coupleId}` },
        () => fetchForfeit()
      )
      .subscribe();

    return () => {
      mounted.current = false;
      appStateSub.remove();
      supabase.removeChannel(channel);
    };
  }, [coupleId, load, fetchSeason, fetchForfeit]);

  const leader: StepLeader =
    mySteps === partnerSteps ? 'tie' : mySteps > partnerSteps ? 'me' : 'partner';

  return {
    mySteps,
    partnerSteps,
    status,
    loading: status === 'loading',
    leader,
    partnerSynced,
    season,
    streakHolder,
    streakCount,
    forfeit,
    forfeitSetByMe,
    setForfeit,
    requestAccess,
    refresh: load,
  };
}
