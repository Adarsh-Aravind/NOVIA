import { Milestone } from '../types';
import { parseLocalDate } from './financeMath';

/** Local-midnight copy of a date, so day comparisons ignore the clock time. */
function atMidnight(d: Date): Date {
  return new Date(d.getFullYear(), d.getMonth(), d.getDate());
}

/** Whole days between two local-midnight dates (b - a). */
function dayDiff(a: Date, b: Date): number {
  return Math.round((atMidnight(b).getTime() - atMidnight(a).getTime()) / 86400000);
}

/** Does a milestone fall on the given calendar day, per its recurrence? */
export function occursOn(m: Pick<Milestone, 'milestone_date' | 'recurrence'>, day: Date): boolean {
  const base = parseLocalDate(m.milestone_date);
  if (isNaN(base.getTime())) return false;
  if (m.recurrence === 'once') {
    return dayDiff(base, day) === 0;
  }
  if (m.recurrence === 'monthly') {
    return base.getDate() === day.getDate();
  }
  // yearly
  return base.getMonth() === day.getMonth() && base.getDate() === day.getDate();
}

/**
 * The next calendar day (>= from) this milestone occurs, or null for a one-off
 * that has already passed.
 */
export function nextOccurrence(
  m: Pick<Milestone, 'milestone_date' | 'recurrence'>,
  from: Date = new Date()
): Date | null {
  const base = parseLocalDate(m.milestone_date);
  if (isNaN(base.getTime())) return null;
  const start = atMidnight(from);

  if (m.recurrence === 'once') {
    return dayDiff(start, base) >= 0 ? base : null;
  }

  if (m.recurrence === 'monthly') {
    // This month's instance, rolling to next month if the day already passed.
    let candidate = new Date(start.getFullYear(), start.getMonth(), base.getDate());
    if (dayDiff(start, candidate) < 0) {
      candidate = new Date(start.getFullYear(), start.getMonth() + 1, base.getDate());
    }
    return candidate;
  }

  // yearly
  let candidate = new Date(start.getFullYear(), base.getMonth(), base.getDate());
  if (dayDiff(start, candidate) < 0) {
    candidate = new Date(start.getFullYear() + 1, base.getMonth(), base.getDate());
  }
  return candidate;
}

/** Days from today until the next occurrence (0 = today), or null if none. */
export function daysUntilNext(
  m: Pick<Milestone, 'milestone_date' | 'recurrence'>,
  from: Date = new Date()
): number | null {
  const next = nextOccurrence(m, from);
  return next ? dayDiff(from, next) : null;
}

/**
 * How many years (yearly) or months (monthly) an occurrence marks since the
 * original date. `count` is 0 for the original day itself and for one-offs.
 */
export function elapsedAt(
  m: Pick<Milestone, 'milestone_date' | 'recurrence'>,
  occurrence: Date
): { count: number; unit: 'year' | 'month' } {
  const base = parseLocalDate(m.milestone_date);
  if (m.recurrence === 'monthly') {
    const months =
      (occurrence.getFullYear() - base.getFullYear()) * 12 +
      (occurrence.getMonth() - base.getMonth());
    return { count: Math.max(0, months), unit: 'month' };
  }
  // yearly + once both report years elapsed
  return { count: Math.max(0, occurrence.getFullYear() - base.getFullYear()), unit: 'year' };
}

/** "3 years", "1 month", or '' when count is 0. */
export function formatElapsed(count: number, unit: 'year' | 'month'): string {
  if (count <= 0) return '';
  return `${count} ${unit}${count === 1 ? '' : 's'}`;
}
