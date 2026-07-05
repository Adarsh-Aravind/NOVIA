import * as Notifications from 'expo-notifications';
import { Platform } from 'react-native';

// Notification channels used across the app.
export const PRIORITY_CHANNEL = 'priority-channel';
export const REMINDERS_CHANNEL = 'reminders-channel';

type ChannelId = typeof PRIORITY_CHANNEL | typeof REMINDERS_CHANNEL;

// Set up the default handler configuration
Notifications.setNotificationHandler({
  handleNotification: async () => ({
    shouldShowAlert: true,
    shouldPlaySound: true,
    shouldSetBadge: true,
    shouldShowBanner: true,
    shouldShowList: true,
  }),
});

export async function configureNotificationsAsync() {
  if (Platform.OS === 'android') {
    // 1. High-priority channel — todo reminders, daily vocabulary, update alerts.
    await Notifications.setNotificationChannelAsync(PRIORITY_CHANNEL, {
      name: 'NOVIA Reminders',
      description: 'Todo reminders, the daily word, and update alerts.',
      importance: Notifications.AndroidImportance.HIGH,
      vibrationPattern: [0, 250, 250, 250],
      lightColor: '#F18F2E',
      sound: 'default',
      showBadge: true,
    });

    // 2. Standard channel — quieter shared reminders (finances, cycle).
    await Notifications.setNotificationChannelAsync(REMINDERS_CHANNEL, {
      name: 'NOVIA Notices',
      description: 'Finance due-dates and cycle reminders.',
      importance: Notifications.AndroidImportance.DEFAULT,
      showBadge: true,
    });
  }

  // Request user permission for push notifications
  const { status: existingStatus } = await Notifications.getPermissionsAsync();
  let finalStatus = existingStatus;

  if (existingStatus !== 'granted') {
    const { status } = await Notifications.requestPermissionsAsync();
    finalStatus = status;
  }

  return finalStatus === 'granted';
}

export async function scheduleLocalNotification({
  title,
  body,
  trigger,
  channelId = REMINDERS_CHANNEL,
  data = {},
}: {
  title: string;
  body: string;
  trigger: Notifications.NotificationTriggerInput;
  channelId?: ChannelId;
  data?: Record<string, any>;
}) {
  // Enrich trigger block with channelId so Android maps the alert to the correct channel
  const enrichedTrigger =
    trigger instanceof Date
      ? { type: Notifications.SchedulableTriggerInputTypes.DATE, date: trigger, channelId }
      : (trigger && typeof trigger === 'object'
          ? { ...(trigger as object), channelId }
          : { channelId } as any);

  return await Notifications.scheduleNotificationAsync({
    content: {
      title,
      body,
      data,
      sound: 'default',
      categoryIdentifier: channelId,
    },
    trigger: enrichedTrigger,
  });
}

export async function cancelScheduledNotificationsByPrefix(prefix: string) {
  const scheduled = await Notifications.getAllScheduledNotificationsAsync();
  await Promise.all(
    scheduled
      .filter((notification) => {
        const reminderKey = notification.content.data?.reminderKey;
        return typeof reminderKey === 'string' && reminderKey.startsWith(prefix);
      })
      .map((notification) => Notifications.cancelScheduledNotificationAsync(notification.identifier))
  );
}

export async function scheduleSharedReminder({
  reminderKey,
  title,
  body,
  date,
  channelId = REMINDERS_CHANNEL,
}: {
  reminderKey: string;
  title: string;
  body: string;
  date: Date;
  channelId?: ChannelId;
}) {
  if (date.getTime() <= Date.now()) return null;

  return await scheduleLocalNotification({
    title,
    body,
    trigger: date as any,
    channelId,
    data: { reminderKey },
  });
}

export async function cancelAllScheduledNotifications() {
  await Notifications.cancelAllScheduledNotificationsAsync();
}
