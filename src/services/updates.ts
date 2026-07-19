import * as Updates from 'expo-updates';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { supabase } from './supabase';
import { AppUpdate } from '../types';
import { withLock } from '../utils/asyncLock';

const LAST_SEEN_UPDATE_KEY = 'novia:lastSeenUpdateAt';

/**
 * Fetch the in-app changelog entries (newest first). These are hand-authored
 * rows in the global `app_updates` table (see docs/UPDATES.md) and are visible
 * to every signed-in user, so both partners see the same list.
 */
export async function fetchAppUpdates(): Promise<AppUpdate[]> {
  const { data, error } = await supabase
    .from('app_updates')
    .select('*')
    .order('created_at', { ascending: false });

  if (error) {
    console.error('[Updates] Failed to fetch changelog:', error);
    return [];
  }
  return (data || []) as AppUpdate[];
}

/** Timestamp of the newest changelog entry the user has already been shown. */
export async function getLastSeenUpdateAt(): Promise<string | null> {
  try {
    return await AsyncStorage.getItem(LAST_SEEN_UPDATE_KEY);
  } catch {
    return null;
  }
}

/** Remember that the user has now seen everything up to `createdAt`. */
export async function markUpdatesSeen(createdAt: string): Promise<void> {
  try {
    await AsyncStorage.setItem(LAST_SEEN_UPDATE_KEY, createdAt);
  } catch (e) {
    console.warn('[Updates] Failed to persist last-seen update:', e);
  }
}

/**
 * Given the changelog and the last-seen timestamp, return the entries the user
 * hasn't been notified about yet (newest first). On a first run (no stored
 * timestamp) returns an empty array so we silently baseline instead of spamming.
 */
export function unseenUpdates(updates: AppUpdate[], lastSeenAt: string | null): AppUpdate[] {
  if (!lastSeenAt) return [];
  return updates.filter((u) => u.created_at > lastSeenAt);
}

/**
 * Over-the-air (EAS Update) check, run once at cold start.
 *
 * At launch the user hasn't started doing anything yet, so fetching and
 * reloading straight away is invisible rather than disruptive.
 *
 * NOTE: OTA only ships JS/asset changes. Anything touching native code still
 * needs a fresh `eas build` — `runtimeVersion` uses the `fingerprint` policy,
 * so it changes automatically when (and only when) the native runtime does.
 */
export async function checkAndApplyUpdate(): Promise<void> {
  // No embedded update system while running in Expo Go / dev client hot-reload.
  if (__DEV__ || !Updates.isEnabled) return;

  return withLock('ota', async () => {
    try {
      const result = await Updates.checkForUpdateAsync();
      if (result.isAvailable) {
        await Updates.fetchUpdateAsync();
        await Updates.reloadAsync();
      }
    } catch (e) {
      console.log('[Updates] OTA launch check failed (ignored):', e);
    }
  });
}

/**
 * Check for and download an update *without* reloading.
 *
 * Used on foreground resume: yanking the bundle out from under someone who is
 * mid-sentence in a shared note would lose their work, so the download happens
 * quietly and the UI offers a restart when it's ready.
 *
 * Returns true when a new bundle is downloaded and waiting to be applied.
 */
export async function fetchUpdateInBackground(): Promise<boolean> {
  if (__DEV__ || !Updates.isEnabled) return false;

  return withLock('ota', async () => {
    try {
      const result = await Updates.checkForUpdateAsync();
      if (!result.isAvailable) return false;

      const fetched = await Updates.fetchUpdateAsync();
      return fetched.isNew;
    } catch (e) {
      console.log('[Updates] OTA background check failed (ignored):', e);
      return false;
    }
  });
}

/** Apply an already-downloaded update. Safe to call from a button handler. */
export async function applyPendingUpdate(): Promise<void> {
  try {
    await Updates.reloadAsync();
  } catch (e) {
    console.log('[Updates] Reload failed (ignored):', e);
  }
}
