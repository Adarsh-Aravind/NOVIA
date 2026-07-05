import * as Updates from 'expo-updates';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { supabase } from './supabase';
import { AppUpdate } from '../types';

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
 * Over-the-air (EAS Update) check. Runs on app launch in production builds:
 * if a newer JS bundle has been published to this build's channel, it is
 * fetched and applied with a quick reload. Never throws — update problems must
 * not block normal app usage.
 *
 * NOTE: OTA only ships JS/asset changes. Anything that touches native code or
 * adds a native dependency still requires a new `eas build`, and (if native
 * changed) a bump of `runtimeVersion` in app.json.
 */
export async function checkAndApplyUpdate(): Promise<void> {
  // No embedded update system while running in Expo Go / dev client hot-reload.
  if (__DEV__ || !Updates.isEnabled) return;

  try {
    const result = await Updates.checkForUpdateAsync();
    if (result.isAvailable) {
      await Updates.fetchUpdateAsync();
      await Updates.reloadAsync();
    }
  } catch (e) {
    console.log('[Updates] OTA check failed (ignored):', e);
  }
}
