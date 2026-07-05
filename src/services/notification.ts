import * as Notifications from 'expo-notifications';
import { Platform } from 'react-native';

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
    // 1. High-Priority Alarm channel (Bypasses silent profile and DND if configured)
    await Notifications.setNotificationChannelAsync('alarm-channel-v2', {
      name: 'NOVIA Sync Alarms',
      description: 'Simultaneous & Coordinated couples alarms to sync waking up.',
      importance: Notifications.AndroidImportance.MAX,
      vibrationPattern: [0, 250, 250, 250, 500, 250, 500],
      lightColor: '#D4AF37', // Gold base
      sound: 'default',
      bypassDnd: true, // Bypass Do Not Disturb profile
      showBadge: true,
      audioAttributes: {
        usage: Notifications.AndroidAudioUsage.ALARM,
        contentType: Notifications.AndroidAudioContentType.SONIFICATION,
      },
    });

    // 2. Standard Reminders channel
    await Notifications.setNotificationChannelAsync('reminders-channel', {
      name: 'NOVIA Reminders',
      description: 'Standard daily logs, face care, shaving reminders.',
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
  channelId = 'reminders-channel',
  data = {},
}: {
  title: string;
  body: string;
  trigger: Notifications.NotificationTriggerInput;
  channelId?: 'alarm-channel-v2' | 'reminders-channel';
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
      sound: channelId === 'alarm-channel-v2' ? 'default' : undefined,
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
  channelId = 'reminders-channel',
}: {
  reminderKey: string;
  title: string;
  body: string;
  date: Date;
  channelId?: 'alarm-channel-v2' | 'reminders-channel';
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

export async function getAlarmChannelDndBypassGranted(): Promise<boolean> {
  if (Platform.OS !== 'android') return true;
  try {
    const channel = await Notifications.getNotificationChannelAsync('alarm-channel-v2');
    return !!(channel && channel.bypassDnd);
  } catch (error) {
    console.warn('Error checking alarm channel DND bypass:', error);
    return false;
  }
}

