const { withMainActivity } = require('@expo/config-plugins');

/**
 * react-native-health-connect ships an Expo config plugin (`app.plugin.js`) that
 * only patches AndroidManifest.xml — it never registers the permission launcher.
 *
 * The library's `HealthConnectPermissionDelegate.requestPermission` is a `lateinit`
 * `ActivityResultLauncher` that MUST be initialized from the host Activity via
 * `setPermissionDelegate(this)` inside `onCreate` (see the library README's bare-RN
 * setup). `registerForActivityResult` may only be called before the Activity is
 * STARTED, so onCreate is the correct spot.
 *
 * Without this, the first `requestPermission()` call throws
 * `UninitializedPropertyAccessException: lateinit property requestPermission has not
 * been initialized` on a Kotlin coroutine thread — an uncaught native crash the JS
 * try/catch can't intercept, so the whole app dies at launch.
 *
 * This plugin injects the missing import + registration into the managed MainActivity
 * so it survives every `expo prebuild` / EAS build.
 */

const IMPORT = 'import dev.matinzd.healthconnect.permissions.HealthConnectPermissionDelegate';
const CALL = 'HealthConnectPermissionDelegate.setPermissionDelegate(this)';

module.exports = function withHealthConnectPermissionDelegate(config) {
  return withMainActivity(config, (cfg) => {
    if (cfg.modResults.language !== 'kt') {
      throw new Error(
        `[withHealthConnectPermissionDelegate] Expected a Kotlin MainActivity, got "${cfg.modResults.language}". Update the plugin to patch this language.`
      );
    }

    let src = cfg.modResults.contents;

    // 1) Import, right after the package declaration (idempotent).
    if (!src.includes(IMPORT)) {
      src = src.replace(/^(package .*)$/m, `$1\n\n${IMPORT}`);
    }

    // 2) Register the delegate immediately after super.onCreate(...) (idempotent).
    if (!src.includes(CALL)) {
      const onCreate = /(super\.onCreate\([^)]*\))/;
      if (!onCreate.test(src)) {
        throw new Error(
          '[withHealthConnectPermissionDelegate] Could not find super.onCreate(...) in MainActivity to anchor the delegate registration.'
        );
      }
      src = src.replace(onCreate, `$1\n    ${CALL}`);
    }

    cfg.modResults.contents = src;
    return cfg;
  });
};
