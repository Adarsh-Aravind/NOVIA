/**
 * Layers the demo build on top of app.json. Without EXPO_PUBLIC_DEMO_MODE=1
 * this returns app.json untouched.
 *
 * The demo gets:
 *  - its own package name, so it installs next to the real app instead of
 *    replacing it;
 *  - OTA updates switched off. A demo that pulled a production update would
 *    swap its fake backend for the real one;
 *  - none of the payment-capture or step permissions. The demo never reads
 *    texts, notifications or Health Connect (see src/demo/config.ts), and an APK
 *    that asks for RECEIVE_SMS is one Play Protect warns people away from.
 */
module.exports = ({ config }) => {
  if (process.env.EXPO_PUBLIC_DEMO_MODE !== '1') return config;

  const stripped = [
    'android.permission.RECEIVE_SMS',
    'android.permission.BIND_NOTIFICATION_LISTENER_SERVICE',
    'android.permission.REQUEST_IGNORE_BATTERY_OPTIMIZATIONS',
    'android.permission.health.READ_STEPS',
  ];

  return {
    ...config,
    name: 'NOVIA Demo',
    updates: { ...config.updates, enabled: false, checkAutomatically: 'NEVER' },
    android: {
      ...config.android,
      package: 'com.iitznova.novia.demo',
      permissions: (config.android?.permissions ?? []).filter((p) => !stripped.includes(p)),
    },
    plugins: [...(config.plugins ?? []), ['./plugins/withDemoManifest', { permissions: stripped }]],
  };
};
