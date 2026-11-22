/**
 * Layers a build variant on top of app.json. With neither flag set this returns
 * app.json untouched.
 *
 * EXPO_PUBLIC_DEMO_MODE=1, the demo build:
 *  - its own package name, so it installs next to the real app instead of
 *    replacing it;
 *  - OTA updates switched off. A demo that pulled a production update would
 *    swap its fake backend for the real one;
 *  - none of the payment-capture or step permissions. The demo never reads
 *    texts, notifications or Health Connect (see src/demo/config.ts), and an APK
 *    that asks for RECEIVE_SMS is one Play Protect warns people away from.
 *
 * EXPO_PUBLIC_NEXT=1, the redesign ("NOVIA Next"):
 *  - its own package name, so it sits beside the current app on the same phone
 *    while the new UI is built, talking to the same backend;
 *  - OTA updates off, so a production update can never replace its bundle;
 *  - payment capture stripped. The current app already records payments from
 *    texts; a second app on the same phone reading the same texts would only
 *    create a second writer for the same rows. Steps stay.
 */
const PAYMENT_PERMISSIONS = [
  'android.permission.RECEIVE_SMS',
  'android.permission.BIND_NOTIFICATION_LISTENER_SERVICE',
  'android.permission.REQUEST_IGNORE_BATTERY_OPTIMIZATIONS',
];

function variant(config, { name, pkg, stripped }) {
  return {
    ...config,
    name,
    updates: { ...config.updates, enabled: false, checkAutomatically: 'NEVER' },
    android: {
      ...config.android,
      package: pkg,
      permissions: (config.android?.permissions ?? []).filter((p) => !stripped.includes(p)),
    },
    plugins: [...(config.plugins ?? []), ['./plugins/withDemoManifest', { permissions: stripped }]],
  };
}

module.exports = ({ config }) => {
  if (process.env.EXPO_PUBLIC_DEMO_MODE === '1') {
    return variant(config, {
      name: 'NOVIA Demo',
      pkg: 'com.iitznova.novia.demo',
      stripped: [...PAYMENT_PERMISSIONS, 'android.permission.health.READ_STEPS'],
    });
  }
  if (process.env.EXPO_PUBLIC_NEXT === '1') {
    const next = variant(config, {
      name: 'NOVIA Next',
      pkg: 'com.iitznova.novia.next',
      stripped: PAYMENT_PERMISSIONS,
    });
    // Home- and lock-screen widgets (src/next/widgets). 'keyguard' makes them
    // eligible for the lock screen where Android allows it (16 QPR2 and later).
    next.plugins.push([
      'react-native-android-widget',
      {
        fonts: ['./node_modules/@expo-google-fonts/bricolage-grotesque/700Bold/BricolageGrotesque_700Bold.ttf'],
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
    ]);
    return next;
  }
  return config;
};
