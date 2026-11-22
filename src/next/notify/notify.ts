import AsyncStorage from '@react-native-async-storage/async-storage';
import * as Notifications from 'expo-notifications';

/**
 * NOVIA Next's notifications, rebuilt to sit quietly beside every other app's.
 *
 * What was wrong before, and what changed:
 *  - One loud channel for everything, so a vocabulary word buzzed like an
 *    alarm. Now there are four channels, each as loud as its content deserves,
 *    with Android's own sound and vibration rather than a custom buzz.
 *  - Titles shouted ("TODO: BUY MILK") and repeated the app name the system
 *    already shows. Now the title says what or who in sentence case, and the
 *    body gives one useful line.
 *  - A hairline status-bar icon. Now it's a bold white mark (see app.config.js).
 *
 * Channel IDs are new (`next-*`). Android fixes a channel's importance the
 * first time it is created, so reusing the old IDs would keep the old loudness.
 */
export const CH = {
  plans: 'next-plans',
  partner: 'next-partner',
  dates: 'next-dates',
  care: 'next-care',
} as const;
export type Channel = (typeof CH)[keyof typeof CH];

const KEY = 'novia-next:reminders';

/** Whether NOVIA Next schedules reminders. Off by default while the old app is installed too. */
export async function remindersEnabled(): Promise<boolean> {
  try {
    return (await AsyncStorage.getItem(KEY)) === 'on';
  } catch {
    return false;
  }
}

export async function setRemindersEnabled(on: boolean): Promise<void> {
  await AsyncStorage.setItem(KEY, on ? 'on' : 'off');
  if (!on) await cancelNext('');
}

let configured = false;

export async function configureNext(): Promise<boolean> {
  if (!configured) {
    configured = true;
    // In the foreground the app shows its own toasts, so partner moments
    // arrive quietly in the shade; reminders still show as a banner.
    Notifications.setNotificationHandler({
      handleNotification: async (n) => {
        const partner = n.request.content.data?.channel === CH.partner;
        return {
          shouldShowAlert: !partner,
          shouldShowBanner: !partner,
          shouldShowList: true,
          shouldPlaySound: !partner,
          shouldSetBadge: false,
        };
      },
    });
    await Promise.all([
      Notifications.setNotificationChannelAsync(CH.plans, {
        name: 'Plans',
        description: 'Reminders for the things you planned together.',
        importance: Notifications.AndroidImportance.HIGH,
        showBadge: true,
      }),
      Notifications.setNotificationChannelAsync(CH.partner, {
        name: 'From your partner',
        description: 'Nudges and repairs from your partner.',
        importance: Notifications.AndroidImportance.HIGH,
        showBadge: true,
      }),
      Notifications.setNotificationChannelAsync(CH.dates, {
        name: 'Dates and anniversaries',
        description: 'Your special days, and a heads-up the day before.',
        importance: Notifications.AndroidImportance.DEFAULT,
        showBadge: true,
      }),
      Notifications.setNotificationChannelAsync(CH.care, {
        name: 'Cycle',
        description: 'A heads-up before a predicted period.',
        importance: Notifications.AndroidImportance.DEFAULT,
        showBadge: false,
      }),
    ]);
  }
  const { status } = await Notifications.getPermissionsAsync();
  if (status === 'granted') return true;
  const asked = await Notifications.requestPermissionsAsync();
  return asked.status === 'granted';
}

export async function notify({
  channel,
  title,
  body,
  trigger,
  key,
  data = {},
}: {
  channel: Channel;
  title: string;
  body: string;
  trigger: Notifications.NotificationTriggerInput | Date | null;
  key: string;
  data?: Record<string, unknown>;
}) {
  const t =
    trigger === null
      ? null
      : trigger instanceof Date
        ? { type: Notifications.SchedulableTriggerInputTypes.DATE, date: trigger, channelId: channel }
        : { ...(trigger as object), channelId: channel };
  return Notifications.scheduleNotificationAsync({
    content: { title, body, data: { ...data, channel, reminderKey: `next:${key}` } },
    trigger: t as Notifications.NotificationTriggerInput,
  });
}

/** Cancel every NOVIA Next scheduled notification whose key starts with `prefix`. */
export async function cancelNext(prefix: string) {
  const all = await Notifications.getAllScheduledNotificationsAsync();
  await Promise.all(
    all
      .filter((n) => {
        const k = n.content.data?.reminderKey;
        return typeof k === 'string' && k.startsWith(`next:${prefix}`);
      })
      .map((n) => Notifications.cancelScheduledNotificationAsync(n.identifier))
  );
}
