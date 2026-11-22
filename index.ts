import 'react-native-gesture-handler';
import { registerRootComponent } from 'expo';

// NOVIA is the app in src/next. The original single-file app (App.tsx) is
// kept only for the no-backend demo build (EXPO_PUBLIC_DEMO_MODE=1), whose
// in-memory backend was written against it. The flag is inlined at bundle
// time, so each build carries only one root.
const DEMO = process.env.EXPO_PUBLIC_DEMO_MODE === '1';
const Root = DEMO ? require('./App').default : require('./src/next/NextApp').default;

// The home- and lock-screen widgets draw from a headless task.
if (!DEMO) {
  try {
    const { registerWidgetTaskHandler } = require('react-native-android-widget');
    registerWidgetTaskHandler(require('./src/next/widgets/handler').widgetTaskHandler);
  } catch {
    // A build without the widget module still runs; it just has no widgets.
  }
}

// registerRootComponent calls AppRegistry.registerComponent('main', () => Root)
// and sets up the environment for the native build.
registerRootComponent(Root);
