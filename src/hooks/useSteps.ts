import { useCallback, useEffect, useRef, useState } from 'react';
import { AppState, Platform } from 'react-native';

/**
 * Step Duel — daily step counter for the couple.
 *
 * SPIKE STATUS: this reads the caller's *own* steps from Health Connect on
 * Android and degrades gracefully everywhere else. The partner's steps are
 * still MOCKED (see makeMockPartnerSteps) — real partner sync goes through
 * Supabase and is a separate piece of work. See [[novia-web-companion]] parity
 * notes if we ever surface this on the PC companion.
 *
 * Why a lazy require instead of a top-level import: `react-native-health-connect`
 * is a native module. Before a fresh dev/EAS build links it (or on iOS, or in a
 * bare Metro reload after `npm install` but before prebuild), a static import
 * would tear down the whole JS bundle with a red screen. Requiring it inside a
 * try/catch keeps the app alive and lets the card fall back to an "unavailable"
 * state until the native side is really there.
 */

// 'loading'      — first read in flight
// 'ready'        — real Health Connect steps in hand
// 'unavailable'  — not Android, module not built, or Health Connect app missing
// 'denied'       — Health Connect present but the user declined step access
export type StepsStatus = 'loading' | 'ready' | 'unavailable' | 'denied';

export type StepLeader = 'me' | 'partner' | 'tie';

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

/** Local midnight → now, as ISO strings for the Health Connect time filter. */
function todayRange(): { startTime: string; endTime: string } {
  const start = new Date();
  start.setHours(0, 0, 0, 0);
  return { startTime: start.toISOString(), endTime: new Date().toISOString() };
}

/**
 * Deterministic placeholder for the partner until real sync lands. Seeded by the
 * calendar date so the number is stable across refreshes within a day (a value
 * that jitters every poll would look broken), but changes day to day.
 */
function makeMockPartnerSteps(): number {
  const d = new Date();
  const seed = d.getFullYear() * 10000 + (d.getMonth() + 1) * 100 + d.getDate();
  // Cheap LCG-ish hash → 3,500–12,500 range.
  const n = Math.abs(Math.sin(seed) * 10000);
  return 3500 + Math.floor((n % 1) * 9000);
}

async function readTodaySteps(hc: HealthConnect): Promise<number> {
  const result = await hc.aggregateRecord({
    recordType: 'Steps',
    timeRangeFilter: { operator: 'between', ...todayRange() },
  });
  // Steps aggregate resolves to { COUNT_TOTAL: number, ... }.
  return (result as { COUNT_TOTAL?: number })?.COUNT_TOTAL ?? 0;
}

export interface UseStepsResult {
  mySteps: number;
  partnerSteps: number;
  status: StepsStatus;
  loading: boolean;
  leader: StepLeader;
  /** True while the partner number is placeholder data, not real sync. */
  partnerIsMock: boolean;
  refresh: () => void;
}

export function useSteps(): UseStepsResult {
  const [mySteps, setMySteps] = useState(0);
  const [partnerSteps, setPartnerSteps] = useState(0);
  const [status, setStatus] = useState<StepsStatus>('loading');
  // Guards against setState after unmount and against overlapping reads.
  const mounted = useRef(true);
  const reading = useRef(false);

  const load = useCallback(async () => {
    if (reading.current) return;
    reading.current = true;

    // Partner is still mocked; set it up front so the card has both numbers even
    // if the real read below fails.
    if (mounted.current) setPartnerSteps(makeMockPartnerSteps());

    if (Platform.OS !== 'android') {
      if (mounted.current) setStatus('unavailable');
      reading.current = false;
      return;
    }

    const hc = getHealthConnect();
    if (!hc) {
      if (mounted.current) setStatus('unavailable');
      reading.current = false;
      return;
    }

    try {
      await hc.initialize();

      const sdk = await hc.getSdkStatus();
      if (sdk !== hc.SdkAvailabilityStatus.SDK_AVAILABLE) {
        if (mounted.current) setStatus('unavailable');
        reading.current = false;
        return;
      }

      // Idempotent: if already granted, most versions resolve without a prompt.
      const granted = await hc.requestPermission([{ accessType: 'read', recordType: 'Steps' }]);
      const hasSteps = granted.some((p) => p.recordType === 'Steps');
      if (!hasSteps) {
        if (mounted.current) setStatus('denied');
        reading.current = false;
        return;
      }

      const steps = await readTodaySteps(hc);
      if (mounted.current) {
        setMySteps(steps);
        setStatus('ready');
      }
    } catch (err) {
      console.warn('[Steps] Health Connect read failed:', err);
      if (mounted.current) setStatus('unavailable');
    } finally {
      reading.current = false;
    }
  }, []);

  useEffect(() => {
    mounted.current = true;
    load();

    // Refresh when the app returns to the foreground — Google Fit → Health
    // Connect sync lags, so steps taken while the app was backgrounded won't be
    // in the last read.
    const sub = AppState.addEventListener('change', (state) => {
      if (state === 'active') load();
    });

    return () => {
      mounted.current = false;
      sub.remove();
    };
  }, [load]);

  const leader: StepLeader =
    mySteps === partnerSteps ? 'tie' : mySteps > partnerSteps ? 'me' : 'partner';

  return {
    mySteps,
    partnerSteps,
    status,
    loading: status === 'loading',
    leader,
    partnerIsMock: true,
    refresh: load,
  };
}
