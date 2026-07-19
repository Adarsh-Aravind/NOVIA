const chains = new Map<string, Promise<unknown>>();

/**
 * Serialize async work per key so concurrent callers cannot interleave.
 *
 * The reminder-sync effects follow a "cancel everything with this prefix, then
 * reschedule from the current list" shape. Their dependency arrays contain
 * arrays that get a fresh identity on every realtime refetch, so a second run
 * can start while the first is still in flight. If run B cancels before run A
 * schedules, both then schedule and the user gets duplicate notifications.
 */
export function withLock<T>(key: string, fn: () => Promise<T>): Promise<T> {
  const previous = chains.get(key) ?? Promise.resolve();
  const next = previous.then(fn, fn);
  // Swallow rejections on the stored chain so one failure doesn't poison
  // every subsequent call for this key.
  chains.set(key, next.catch(() => undefined));
  return next;
}
