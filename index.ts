import 'react-native-gesture-handler';
import { registerRootComponent } from 'expo';

// EXPO_PUBLIC_NEXT=1 boots the redesign (src/next) instead of the current app.
// The flag is inlined at bundle time, so each build carries only one root.
const Root =
  process.env.EXPO_PUBLIC_NEXT === '1'
    ? require('./src/next/NextApp').default
    : require('./App').default;

// NOVIA Next's home- and lock-screen widgets draw from a headless task.
if (process.env.EXPO_PUBLIC_NEXT === '1') {
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
