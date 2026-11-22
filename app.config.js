/**
 * Layers build settings on top of app.json.
 *
 * The normal build is NOVIA itself (com.iitznova.novia): the redesigned app
 * in src/next, with payment capture, steps, over-the-air updates, the bold
 * notification icon and the home- and lock-screen widgets.
 *
 * NOVIA_SIDE_BY_SIDE=1 builds a test copy that installs beside the real app
 * (com.iitznova.novia.next, "NOVIA Next") against the same backend, with OTA
 * off and payment capture stripped, so two apps on one phone never both
 * record the same payment. Use it to try a build on a phone without
 * replacing NOVIA.
 *
 * EXPO_PUBLIC_DEMO_MODE=1 is the no-backend demo:
 *  - its own package name, so it installs next to the real app instead of
 *    replacing it;
 *  - OTA updates switched off. A demo that pulled a production update would
 *    swap its fake backend for the real one;
 *  - none of the payment-capture or step permissions. The demo never reads
 *    texts, notifications or Health Connect (see src/demo/config.ts), and an APK
 *    that asks for RECEIVE_SMS is one Play Protect warns people away from.
 */
const PAYMENT_PERMISSIONS = [
  'android.permission.RECEIVE_SMS',
  'android.permission.BIND_NOTIFICATION_LISTENER_SERVICE',
  'android.permission.REQUEST_IGNORE_BATTERY_OPTIMIZATIONS',
];

const WIDGETS = [
  'react-native-android-widget',
  {
    fonts: ['./node_modules/@expo-google-fonts/bricolage-grotesque/700Bold/BricolageGrotesque_700Bold.ttf'],
    // 'keyguard' makes them eligible for the lock screen where Android allows
    // third-party lock-screen widgets (16 QPR2 and later).
    widgets: [
      {
        name: 'NoviaLights',
        label: 'NOVIA lights',
        description: 'Both of your lights. Tap theirs to send a nudge.',
        minWidth: '250dp',
        minHeight: '110dp',
        targetCellWidth: 4,
        targetCellHeight: 2,
        resizeMode: 'horizontal|vertical',
        widgetCategory: 'home_screen|keyguard',
        updatePeriodMillis: 1800000,
      },
      {
        name: 'NoviaDays',
        label: 'Days together',
        description: 'How many days you have been together, and the next anniversary.',
        minWidth: '110dp',
        minHeight: '110dp',
        targetCellWidth: 2,
        targetCellHeight: 2,
        resizeMode: 'horizontal|vertical',
        widgetCategory: 'home_screen|keyguard',
        updatePeriodMillis: 1800000,
      },
    ],
  },
];

/** A bold status-bar icon (the old one was a hairline at 24dp) and the Ember accent. */
function withNotificationLook(plugins) {
  return plugins.map((p) =>
    Array.isArray(p) && p[0] === 'expo-notifications'
      ? ['expo-notifications', { ...p[1], icon: './assets/next-notification-icon.png', color: '#FF8A3D' }]
      : p
  );
}

module.exports = ({ config }) => {
  if (process.env.EXPO_PUBLIC_DEMO_MODE === '1') {
    const stripped = [...PAYMENT_PERMISSIONS, 'android.permission.health.READ_STEPS'];
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
  }
  const app = {
    ...config,
    plugins: [...withNotificationLook(config.plugins ?? []), WIDGETS],
  };
  if (process.env.NOVIA_SIDE_BY_SIDE === '1') {
    return {
      ...app,
      name: 'NOVIA Next',
      updates: { ...config.updates, enabled: false, checkAutomatically: 'NEVER' },
      android: {
        ...config.android,
        package: 'com.iitznova.novia.next',
        permissions: (config.android?.permissions ?? []).filter((p) => !PAYMENT_PERMISSIONS.includes(p)),
      },
      plugins: [...app.plugins, ['./plugins/withDemoManifest', { permissions: PAYMENT_PERMISSIONS }]],
    };
  }
  return app;
};
