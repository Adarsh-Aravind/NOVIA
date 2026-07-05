import * as Updates from 'expo-updates';

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
