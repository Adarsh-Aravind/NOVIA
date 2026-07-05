import { LogBox } from 'react-native';

// Suppress the warning/error message about expo-notifications remote push in Expo Go SDK 53/54
LogBox.ignoreLogs([
  'expo-notifications: Android Push notifications',
  'Android Push notifications (remote notifications) functionality provided by expo-notifications was removed from Expo Go',
]);

const originalConsoleError = console.error;
console.error = (...args: any[]) => {
  const message = args.join(' ');
  if (
    message.includes('expo-notifications: Android Push notifications') ||
    message.includes('Android Push notifications (remote notifications) functionality')
  ) {
    // Suppress this specific error in development
    return;
  }
  originalConsoleError(...args);
};
import notifee, { EventType } from '@notifee/react-native';
import { stopRingingAlarm, snoozeAlarm } from './src/services/alarmService';

notifee.onBackgroundEvent(async ({ type, detail }) => {
  const n = detail.notification;
  if (n?.data?.kind !== 'alarm') return;

  if (type === EventType.ACTION_PRESS) {
    if (detail.pressAction?.id === 'stop-alarm' && n.id) {
      await stopRingingAlarm(n.id);
    }
    if (detail.pressAction?.id === 'snooze-alarm') {
      await snoozeAlarm(
        String(n.data?.alarmId ?? 'snoozed'),
        n.title ?? 'Alarm',
        n.body ?? '',
        5,
      );
    }
  }
});
 
import { registerRootComponent } from 'expo';
import App from './App';

// registerRootComponent calls AppRegistry.registerComponent('main', () => App);
// It also ensures that whether you load the app in Expo Go or in a native build,
// the environment is set up appropriately
registerRootComponent(App);
