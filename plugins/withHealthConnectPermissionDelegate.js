const { withMainActivity, withAndroidManifest, AndroidConfig } = require('@expo/config-plugins');

/**
 * react-native-health-connect@3.5.3's bundled Expo plugin is incomplete for a
 * managed Expo app on Android 14+. Two things are missing; this plugin adds both
 * so they survive every `expo prebuild` / EAS build.
 *
 * 1) MainActivity permission delegate.
 *    The library's `HealthConnectPermissionDelegate.requestPermission` is a
 *    `lateinit` ActivityResultLauncher that must be initialized from the host
 *    Activity via `setPermissionDelegate(this)` in `onCreate` (see the library
 *    README's bare-RN setup). `registerForActivityResult` may only be called
 *    before the Activity is STARTED, so onCreate is the right spot. Without it the
 *    first requestPermission() throws UninitializedPropertyAccessException on a
 *    coroutine thread — an uncaught native crash at launch.
 *
 * 2) VIEW_PERMISSION_USAGE activity-alias.
 *    From Android 14 (Upside Down Cake) Health Connect is part of the framework
 *    and REQUIRES the app to declare an activity that handles
 *    android.intent.action.VIEW_PERMISSION_USAGE with the HEALTH_PERMISSIONS
 *    category (the "privacy policy" screen). Without it Health Connect reports
 *    "Incorrect health permission state" — the grant dialog flashes shut without
 *    granting, and reads throw IllegalStateException. The bundled plugin only adds
 *    the older ACTION_SHOW_PERMISSIONS_RATIONALE filter (Android 13 and below), so
 *    we add the Android 14+ one here.
 */

const DELEGATE_IMPORT =
  'import dev.matinzd.healthconnect.permissions.HealthConnectPermissionDelegate';
const DELEGATE_CALL = 'HealthConnectPermissionDelegate.setPermissionDelegate(this)';

const ALIAS_NAME = 'ViewPermissionUsageActivity';
const VIEW_PERMISSION_USAGE = 'android.intent.action.VIEW_PERMISSION_USAGE';
const HEALTH_PERMISSIONS_CATEGORY = 'android.intent.category.HEALTH_PERMISSIONS';

function withPermissionDelegate(config) {
  return withMainActivity(config, (cfg) => {
    if (cfg.modResults.language !== 'kt') {
      throw new Error(
        `[withHealthConnect] Expected a Kotlin MainActivity, got "${cfg.modResults.language}".`
      );
    }

    let src = cfg.modResults.contents;

    if (!src.includes(DELEGATE_IMPORT)) {
      src = src.replace(/^(package .*)$/m, `$1\n\n${DELEGATE_IMPORT}`);
    }

    if (!src.includes(DELEGATE_CALL)) {
      const onCreate = /(super\.onCreate\([^)]*\))/;
      if (!onCreate.test(src)) {
        throw new Error(
          '[withHealthConnect] Could not find super.onCreate(...) in MainActivity to anchor the delegate registration.'
        );
      }
      src = src.replace(onCreate, `$1\n    ${DELEGATE_CALL}`);
    }

    cfg.modResults.contents = src;
    return cfg;
  });
}

function withPermissionUsageAlias(config) {
  return withAndroidManifest(config, (cfg) => {
    const app = AndroidConfig.Manifest.getMainApplicationOrThrow(cfg.modResults);
    app['activity-alias'] = app['activity-alias'] || [];

    const exists = app['activity-alias'].some((a) => a?.$?.['android:name'] === ALIAS_NAME);
    if (!exists) {
      app['activity-alias'].push({
        $: {
          'android:name': ALIAS_NAME,
          'android:exported': 'true',
          'android:targetActivity': '.MainActivity',
          'android:permission': 'android.permission.START_VIEW_PERMISSION_USAGE',
        },
        'intent-filter': [
          {
            action: [{ $: { 'android:name': VIEW_PERMISSION_USAGE } }],
            category: [{ $: { 'android:name': HEALTH_PERMISSIONS_CATEGORY } }],
          },
        ],
      });
    }

    return cfg;
  });
}

module.exports = function withHealthConnect(config) {
  config = withPermissionDelegate(config);
  config = withPermissionUsageAlias(config);
  return config;
};
