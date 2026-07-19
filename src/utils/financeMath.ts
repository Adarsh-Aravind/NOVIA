import { FinanceItem } from '../types';

/**
 * Format a Date as 'YYYY-MM-DD' in *local* time.
 *
 * `date.toISOString().split('T')[0]` is the obvious-looking version and it is
 * wrong east of UTC: a date built at local midnight converts back to the
 * previous calendar day in UTC, so the date strip could hand back yesterday.
 */
export function toLocalISODate(date: Date): string {
  const y = date.getFullYear();
  const m = String(date.getMonth() + 1).padStart(2, '0');
  const d = String(date.getDate()).padStart(2, '0');
  return `${y}-${m}-${d}`;
}

/** Parse 'YYYY-MM-DD' (or an ISO timestamp) as a local-midnight Date. */
export function parseLocalDate(value: string): Date {
  const [datePart] = value.split('T');
  const [y, m, d] = datePart.split('-').map(Number);
  if (!y || !m || !d) return new Date(NaN);
  return new Date(y, m - 1, d);
}

function daysInMonth(year: number, month: number): number {
  return new Date(year, month + 1, 0).getDate();
}

function isLastDayOfMonth(date: Date): boolean {
  return date.getDate() === daysInMonth(date.getFullYear(), date.getMonth());
}

/**
 * Add months, clamping to the end of the target month.
 *
 * Plain setMonth() overflows: 31 Jan + 1 month becomes 3 Mar, which would walk
 * a subscription's billing day forward a few days every year.
 *
 * An end-of-month due date stays end-of-month (31 Jan → 28 Feb → 31 Mar). Without
 * that rule a clamp is permanent: 31 Jan bills on the 28th forever after its first
 * February, ratcheting the billing day earlier and earlier.
 *
 * Tradeoff: a date that is genuinely meant as "the 28th" gets pulled to month end
 * if it lands on a February. Month-end billing is the far more common intent, and
 * this direction self-corrects where the alternative drifts monotonically.
 */
export function addMonthsClamped(date: Date, months: number): Date {
  const targetMonth = date.getMonth() + months;
  const result = new Date(date.getFullYear(), targetMonth, 1);
  const targetLength = daysInMonth(result.getFullYear(), result.getMonth());
  const day = isLastDayOfMonth(date) ? targetLength : Math.min(date.getDate(), targetLength);
  result.setDate(day);
  result.setHours(date.getHours(), date.getMinutes(), 0, 0);
  return result;
}

/**
 * The next due date for a recurring item, always strictly in the future.
 *
 * Each candidate is computed from the *original* due date rather than from the
 * previous candidate, so catching up on several missed cycles can't accumulate
 * clamping error along the way.
 */
export function nextDueDate(
  currentDue: Date,
  cycle: 'monthly' | 'yearly',
  now: Date = new Date()
): Date {
  const step = cycle === 'yearly' ? 12 : 1;
  let cycles = 1;
  let next = addMonthsClamped(currentDue, step);
  while (next.getTime() <= now.getTime() && cycles < 600) {
    cycles++;
    next = addMonthsClamped(currentDue, step * cycles);
  }
  return next;
}

/**
 * Only a shared subscription renews.
 *
 * The type check matters: renewal_cycle is shared form state, so a borrowing can
 * end up persisted with 'monthly' on it. Without this guard such a row would
 * roll its due date forward on every settle and could never be cleared.
 */
export function isRecurring(
  item: Pick<FinanceItem, 'renewal_cycle' | 'type' | 'is_self_liability'>
): boolean {
  if (item.type !== 'subscription' || item.is_self_liability) return false;
  return item.renewal_cycle === 'monthly' || item.renewal_cycle === 'yearly';
}

export function isOverdue(item: Pick<FinanceItem, 'due_date' | 'status'>, now: Date = new Date()): boolean {
  if (item.status === 'paid') return false;
  const due = parseLocalDate(item.due_date);
  if (isNaN(due.getTime())) return false;
  return due.getTime() < new Date(now.getFullYear(), now.getMonth(), now.getDate()).getTime();
}

export interface FinanceSummary {
  /** Every unpaid item, shared and personal. */
  combinedOutstanding: number;
  /** Unpaid shared items only (subscriptions + borrowings). */
  sharedOutstanding: number;
  /** Each partner's total exposure: their split of shared items + their own personal debts. */
  yourShare: number;
  partnerShare: number;
  yourSelfLiability: number;
  partnerSelfLiability: number;
  /** Borrowings only — what each partner owes the other. */
  yourBorrowings: number;
  partnerBorrowings: number;
  /** Positive: partner owes you. Negative: you owe partner. */
  netSettlement: number;
  monthlySubscriptionCost: number;
  activeSubscriptionCount: number;
  /**
   * Unpaid borrowings that belong to neither partner (e.g. logged before the
   * couple was linked, so borrower_id points at a stale profile). Surfaced
   * rather than silently dropped — the old code added these to the combined
   * total but to nobody's share, so the liability bars never added up.
   */
  unattributed: number;
  overdueCount: number;
}

export function summarizeFinances(
  items: FinanceItem[],
  userId: string | null,
  partnerId: string | null | undefined,
  now: Date = new Date()
): FinanceSummary {
  const summary: FinanceSummary = {
    combinedOutstanding: 0,
    sharedOutstanding: 0,
    yourShare: 0,
    partnerShare: 0,
    yourSelfLiability: 0,
    partnerSelfLiability: 0,
    yourBorrowings: 0,
    partnerBorrowings: 0,
    netSettlement: 0,
    monthlySubscriptionCost: 0,
    activeSubscriptionCount: 0,
    unattributed: 0,
    overdueCount: 0,
  };

  for (const item of items) {
    const amount = Number(item.amount);
    if (!Number.isFinite(amount)) continue;

    // Recurring subscriptions are an ongoing cost regardless of whether this
    // period's instance is settled, so the forecast counts them either way.
    if (isRecurring(item)) {
      summary.activeSubscriptionCount++;
      summary.monthlySubscriptionCost += item.renewal_cycle === 'yearly' ? amount / 12 : amount;
    }

    if (item.status === 'paid') continue;
    if (isOverdue(item, now)) summary.overdueCount++;

    summary.combinedOutstanding += amount;

    if (item.is_self_liability) {
      // Personal debts belong to one person and never enter the shared pot or
      // the who-owes-whom settlement.
      //
      // created_by is nullable (ON DELETE SET NULL), and an unowned row must not
      // fall through to the partner branch — both devices would then show the
      // same debt as belonging to the *other* person, and neither would claim it.
      if (item.created_by === userId) {
        summary.yourSelfLiability += amount;
        summary.yourShare += amount;
      } else if (partnerId && item.created_by === partnerId) {
        summary.partnerSelfLiability += amount;
        summary.partnerShare += amount;
      } else {
        summary.unattributed += amount;
      }
      continue;
    }

    summary.sharedOutstanding += amount;

    if (item.type === 'subscription') {
      // Shared subscriptions split evenly, so they cancel out of the net
      // settlement and only affect each partner's total exposure.
      summary.yourShare += amount / 2;
      summary.partnerShare += amount / 2;
    } else if (item.type === 'borrowing') {
      if (item.borrower_id === userId) {
        summary.yourShare += amount;
        summary.yourBorrowings += amount;
      } else if (partnerId && item.borrower_id === partnerId) {
        summary.partnerShare += amount;
        summary.partnerBorrowings += amount;
      } else {
        summary.unattributed += amount;
      }
    }
  }

  summary.netSettlement = summary.partnerBorrowings - summary.yourBorrowings;
  return summary;
}
