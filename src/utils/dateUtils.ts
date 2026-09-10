/**
 * Local-time date helpers.
 *
 * These two were the only survivors of financeMath when the finance module was
 * replaced by auto-detected transactions — the renewal, overdue and settlement
 * maths went with it. They stayed because milestone scheduling, the cycle
 * tracker and the medical vault all still need a date parsed and formatted in
 * LOCAL time rather than UTC.
 */

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
