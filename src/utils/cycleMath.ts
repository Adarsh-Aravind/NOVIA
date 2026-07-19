import { PeriodRecord } from '../types';

export type CyclePhase = 'Menstruation' | 'Follicular' | 'Ovulation' | 'Luteal' | 'Unknown';

export interface CyclePrediction {
  avgCycleLength: number;
  avgPeriodLength: number;
  /** Start of the cycle the user is in *today* (rolled forward from the last log). */
  currentCycleStart: Date;
  nextPeriodStart: Date;
  predictedOvulation: Date;
  fertileWindowStart: Date;
  fertileWindowEnd: Date;
  currentPhase: CyclePhase;
  /** 1-indexed day within the current cycle (day 1 = first day of bleeding). */
  cycleDay: number;
  /** Negative once the predicted date has passed without a new log. */
  daysUntilNextPeriod: number;
  /** How many cycles we rolled past because no period was logged. */
  cyclesSkipped: number;
  /** True when predictions are extrapolated well past the last real log. */
  isStale: boolean;
  /** Rough trust signal, driven by how many real intervals we measured. */
  confidence: 'low' | 'medium' | 'high';
}

const DAY_MS = 24 * 60 * 60 * 1000;
const LUTEAL_PHASE_DAYS = 14; // fairly fixed across people; the follicular phase is what varies
const MIN_CYCLE = 15;
const MAX_CYCLE = 45;
const RECENT_INTERVALS = 6; // recent cycles predict better than ancient history

/**
 * Parse a Postgres DATE ('YYYY-MM-DD') as a *local* midnight.
 *
 * `new Date('2026-07-19')` parses as UTC midnight, which is a different
 * calendar day once you read it back with local-time getters — that produced
 * off-by-one cycle days for anyone behind UTC.
 */
function parseLocalDate(value: string): Date {
  const [datePart] = value.split('T');
  const [y, m, d] = datePart.split('-').map(Number);
  if (!y || !m || !d) return new Date(NaN);
  return new Date(y, m - 1, d);
}

function startOfToday(): Date {
  const now = new Date();
  return new Date(now.getFullYear(), now.getMonth(), now.getDate());
}

/** Whole calendar days from `from` to `to`, both already at local midnight. */
function daysBetween(from: Date, to: Date): number {
  return Math.round((to.getTime() - from.getTime()) / DAY_MS);
}

function addDays(date: Date, days: number): Date {
  const next = new Date(date);
  next.setDate(next.getDate() + days);
  return next;
}

export function calculateCyclePredictions(
  historicalPeriods: PeriodRecord[],
  standardCycleLength = 28
): CyclePrediction | null {
  if (!historicalPeriods || historicalPeriods.length === 0) return null;

  const sorted = [...historicalPeriods]
    .map((record) => ({ record, start: parseLocalDate(record.start_date) }))
    .filter(({ start }) => !isNaN(start.getTime()))
    .sort((a, b) => a.start.getTime() - b.start.getTime());

  if (sorted.length === 0) return null;

  // --- Average cycle length -------------------------------------------------
  const intervals: number[] = [];
  for (let i = 1; i < sorted.length; i++) {
    const gap = daysBetween(sorted[i - 1].start, sorted[i].start);
    // Ignore implausible gaps: duplicate logs, typos, or a months-long lapse.
    if (gap >= MIN_CYCLE && gap <= MAX_CYCLE) intervals.push(gap);
  }

  const recentIntervals = intervals.slice(-RECENT_INTERVALS);
  const latest = sorted[sorted.length - 1];

  // An explicit user override always wins over inference.
  const override = latest.record.cycle_length_override;
  const avgCycleLength =
    override && override >= MIN_CYCLE && override <= MAX_CYCLE
      ? override
      : recentIntervals.length > 0
        ? Math.round(recentIntervals.reduce((sum, n) => sum + n, 0) / recentIntervals.length)
        : standardCycleLength;

  // --- Average period (bleed) length ---------------------------------------
  const bleedLengths = sorted
    .filter(({ record }) => record.end_date)
    .map(({ record, start }) => daysBetween(start, parseLocalDate(record.end_date!)) + 1)
    .filter((n) => n >= 1 && n <= 12);

  const avgPeriodLength =
    bleedLengths.length > 0
      ? Math.round(bleedLengths.reduce((sum, n) => sum + n, 0) / bleedLengths.length)
      : 5;

  // --- Roll forward to the cycle the user is actually in today -------------
  // The old logic anchored every prediction to the last *logged* start, so a
  // missed log left nextPeriodStart sitting in the past — the date went stale
  // while the phase kept wrapping via modulo, and the two disagreed.
  const today = startOfToday();
  let currentCycleStart = latest.start;
  let cyclesSkipped = 0;

  while (daysBetween(currentCycleStart, today) >= avgCycleLength) {
    currentCycleStart = addDays(currentCycleStart, avgCycleLength);
    cyclesSkipped++;
  }

  const cycleDay = daysBetween(currentCycleStart, today) + 1; // day 1 = first bleed day
  const nextPeriodStart = addDays(currentCycleStart, avgCycleLength);

  // --- Phase boundaries, as 1-indexed cycle days ---------------------------
  // Clamp to at least the day after bleeding ends. On a very short cycle the raw
  // arithmetic goes non-positive (a 15-day cycle puts ovulation on day 1 and the
  // fertile window on day -4), which made every post-period day fall through to
  // Luteal and put the fertile window before the cycle had started.
  // +1 because cycle days are 1-indexed: on a 28-day cycle with a 14-day luteal
  // phase, ovulation falls 14 days before the next period, i.e. cycle day 15.
  const ovulationDay = Math.max(avgCycleLength - LUTEAL_PHASE_DAYS + 1, avgPeriodLength + 1);
  const fertileStartDay = Math.max(ovulationDay - 5, avgPeriodLength + 1);
  const fertileEndDay = Math.min(ovulationDay + 1, avgCycleLength);

  // Dates are derived from those same day numbers rather than computed
  // independently, so the reported phase and the reported dates cannot disagree.
  const predictedOvulation = addDays(currentCycleStart, ovulationDay - 1);
  const fertileWindowStart = addDays(currentCycleStart, fertileStartDay - 1);
  const fertileWindowEnd = addDays(currentCycleStart, fertileEndDay - 1);

  let currentPhase: CyclePhase;
  if (cycleDay <= avgPeriodLength) {
    currentPhase = 'Menstruation';
  } else if (cycleDay < fertileStartDay) {
    currentPhase = 'Follicular';
  } else if (cycleDay <= fertileEndDay) {
    currentPhase = 'Ovulation';
  } else {
    currentPhase = 'Luteal';
  }

  return {
    avgCycleLength,
    avgPeriodLength,
    currentCycleStart,
    nextPeriodStart,
    predictedOvulation,
    fertileWindowStart,
    fertileWindowEnd,
    currentPhase,
    cycleDay,
    daysUntilNextPeriod: daysBetween(today, nextPeriodStart),
    cyclesSkipped,
    // Two or more skipped cycles means we're extrapolating from a log that is
    // months old; the UI should say so rather than present a confident date.
    isStale: cyclesSkipped >= 2,
    confidence: recentIntervals.length >= 3 ? 'high' : recentIntervals.length >= 1 ? 'medium' : 'low',
  };
}
