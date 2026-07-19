import AsyncStorage from '@react-native-async-storage/async-storage';

const NOTIFIED_PREFIX = 'novia:notified:';
const BASELINE_PREFIX = 'novia:baseline:';
const PRUNE_AFTER_MS = 60 * 24 * 60 * 60 * 1000; // 60 days

/**
 * One-shot notification dedup that survives app restarts.
 *
 * In-memory refs are not enough: the app remounts on every cold start, so any
 * "have I already announced this?" state kept in a ref is lost and the same
 * row gets announced again on the next launch.
 */
export async function claimNotification(key: string): Promise<boolean> {
  const storageKey = NOTIFIED_PREFIX + key;
  try {
    if ((await AsyncStorage.getItem(storageKey)) !== null) return false;
    await AsyncStorage.setItem(storageKey, String(Date.now()));
    return true;
  } catch {
    // Fail closed. A missed notification is a far smaller annoyance than a
    // notification that reappears on every launch.
    return false;
  }
}

/**
 * Per-scope baseline timestamp, created on first ever call for that scope.
 *
 * Rows that already existed when the user installed the app are older than the
 * baseline and so are never announced — without this, a fresh install would
 * notify once for every historical complaint.
 */
export async function getOrCreateBaseline(scope: string): Promise<string> {
  const storageKey = BASELINE_PREFIX + scope;
  try {
    const existing = await AsyncStorage.getItem(storageKey);
    if (existing) return existing;
    const now = new Date().toISOString();
    await AsyncStorage.setItem(storageKey, now);
    return now;
  } catch {
    return new Date().toISOString();
  }
}

/** Drop dedup markers older than PRUNE_AFTER_MS so the key set stays bounded. */
export async function pruneNotifiedMarkers(): Promise<void> {
  try {
    const keys = (await AsyncStorage.getAllKeys()).filter((k) => k.startsWith(NOTIFIED_PREFIX));
    if (keys.length === 0) return;

    const cutoff = Date.now() - PRUNE_AFTER_MS;
    const entries = await AsyncStorage.multiGet(keys);
    const stale = entries
      .filter(([, value]) => {
        const at = Number(value);
        return Number.isFinite(at) && at < cutoff;
      })
      .map(([key]) => key);

    if (stale.length > 0) await AsyncStorage.multiRemove(stale);
  } catch {
    // Pruning is housekeeping only — never let it surface to the user.
  }
}
