const { withAndroidManifest } = require('@expo/config-plugins');

/**
 * Demo build only (wired in by app.config.js).
 *
 * Filtering app.json's permission list is not enough on its own: the local
 * notification-listener module declares RECEIVE_SMS, its SMS receiver and its
 * listener service in its *library* manifest, and AGP's merger folds those into
 * the APK regardless. `tools:node="remove"` in the app manifest is what the
 * merger honours over a library, so the demo APK carries none of them.
 */

const SERVICE = 'expo.modules.notificationlistener.NoviaNotificationListenerService';
const RECEIVER = 'expo.modules.notificationlistener.NoviaSmsReceiver';

module.exports = function withDemoManifest(config, { permissions = [] } = {}) {
  return withAndroidManifest(config, (cfg) => {
    const manifest = cfg.modResults.manifest;
    manifest.$['xmlns:tools'] = manifest.$['xmlns:tools'] || 'http://schemas.android.com/tools';

    const existing = manifest['uses-permission'] || [];
    manifest['uses-permission'] = [
      ...existing.filter((p) => !permissions.includes(p.$['android:name'])),
      ...permissions.map((name) => ({ $: { 'android:name': name, 'tools:node': 'remove' } })),
    ];

    const app = manifest.application[0];
    app.service = [...(app.service || []), { $: { 'android:name': SERVICE, 'tools:node': 'remove' } }];
    app.receiver = [...(app.receiver || []), { $: { 'android:name': RECEIVER, 'tools:node': 'remove' } }];

    return cfg;
  });
};
