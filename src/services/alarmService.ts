import notifee, {
  AndroidCategory,
  AndroidImportance,
  AndroidVisibility,
  AndroidLaunchActivityFlag,
  AndroidNotificationSetting,
  TriggerType,
  TimestampTrigger,
  AlarmType,
  EventType,
} from '@notifee/react-native';
import { Platform } from 'react-native';

export const ALARM_CHANNEL_ID = 'novia-alarms-v3';
export const ALARM_NOTIFICATION_ID_PREFIX = 'novia-alarm-';

export async function setupAlarmChannel() {
  if (Platform.OS !== 'android') return;
  await notifee.createChannel({
    id: ALARM_CHANNEL_ID,
    name: 'NOVIA Alarms',
    description: 'Wake-up alarms — rings even in Do Not Disturb.',
    importance: AndroidImportance.HIGH,
    sound: 'alarm', // res/raw/alarm.wav (no extension)
    vibration: true,
    vibrationPattern: [500, 500, 500, 500, 500, 500],
    bypassDnd: true,
    visibility: AndroidVisibility.PUBLIC,
    lights: true,
    lightColor: '#D4AF37',
  });
}

export async function requestAlarmPermissions() {
  // POST_NOTIFICATIONS (Android 13+) + iOS notification (incl. critical alert).
  // Exact-alarm scheduling is covered by the USE_EXACT_ALARM manifest permission
  // (auto-granted for alarm-clock apps), so we do NOT force-open system settings
  // here — that would pop up on every launch. The in-app "Device Optimization"
  // card guides the user to battery/DND settings when needed.
  await notifee.requestPermission({
    criticalAlert: true,
    alert: true,
    sound: true,
    badge: true,
  });
}

/**
 * Whether the OS currently lets this app schedule *exact* alarms. Android 12+
 * gates `SET_ALARM_CLOCK` behind the "Alarms & reminders" special-access
 * permission; if it is revoked, `createTriggerNotification` silently fails to
 * arm anything and no wake-up ever fires. On Android < 12 and iOS notifee
 * reports NOT_SUPPORTED, which we treat as "allowed".
 */
export async function isExactAlarmAllowed(): Promise<boolean> {
  if (Platform.OS !== 'android') return true;
  try {
    const settings = await notifee.getNotificationSettings();
    return settings.android.alarm !== AndroidNotificationSetting.DISABLED;
  } catch (e) {
    console.warn('[Alarms] Could not read exact-alarm setting:', e);
    return true; // fail open — don't block scheduling on a read error
  }
}

/** Opens the system "Alarms & reminders" screen so the user can grant exact alarms. */
export async function promptExactAlarmPermission(): Promise<void> {
  if (Platform.OS !== 'android') return;
  try {
    await notifee.openAlarmPermissionSettings();
  } catch (e) {
    console.warn('[Alarms] Could not open exact-alarm settings:', e);
  }
}

export interface ScheduleAlarmInput {
  id: string;          // stable id, e.g. 'morning'
  title: string;
  body: string;
  date: Date;          // local time when it should fire
}

export async function scheduleAlarm({ id, title, body, date }: ScheduleAlarmInput) {
  if (date.getTime() <= Date.now()) return;

  await setupAlarmChannel();

  const trigger: TimestampTrigger = {
    type: TriggerType.TIMESTAMP,
    timestamp: date.getTime(),
    alarmManager: { type: AlarmType.SET_ALARM_CLOCK }, // shows the system alarm icon, fires exactly
  };

  await notifee.createTriggerNotification(
    {
      id: ALARM_NOTIFICATION_ID_PREFIX + id,
      title,
      body,
      data: { kind: 'alarm', alarmId: id },
      android: {
        channelId: ALARM_CHANNEL_ID,
        category: AndroidCategory.ALARM,
        importance: AndroidImportance.HIGH,
        visibility: AndroidVisibility.PUBLIC,
        sound: 'alarm',
        loopSound: true,           // <-- rings continuously
        autoCancel: false,
        ongoing: true,
        showTimestamp: true,
        smallIcon: 'ic_launcher',
        pressAction: { id: 'default', launchActivity: 'default' },
        fullScreenAction: {        // <-- full-screen ring UI even on lock screen
          id: 'default',
          launchActivity: 'default',
          launchActivityFlags: [AndroidLaunchActivityFlag.SINGLE_TOP],
        },
        actions: [
          { title: 'Stop',  pressAction: { id: 'stop-alarm' } },
          { title: 'Snooze 5m', pressAction: { id: 'snooze-alarm' } },
        ],
      },
      ios: {
        sound: 'alarm.wav',
        critical: true,            // <-- bypasses Silent / Focus / DND
        criticalVolume: 1.0,
        interruptionLevel: 'critical',
        categoryId: 'novia-alarm',
      },
    },
    trigger,
  );
}

export async function cancelAlarm(id: string) {
  await notifee.cancelTriggerNotification(ALARM_NOTIFICATION_ID_PREFIX + id);
}

/**
 * A couple alarm as stored in Supabase, trimmed to what the scheduler needs.
 */
export interface CoupleAlarm {
  id: string;
  purpose: string | null;
  alarm_time: string;   // "HH:MM" or "HH:MM:SS"
  days_active: number[]; // 0=Sun ... 6=Sat ; empty = every day
  is_enabled: boolean;
  sync_mode: string;
}

// Occurrence notification ids look like:  novia-alarm-<dbId>::<epochMillis>
function occurrenceId(alarm: CoupleAlarm, date: Date) {
  return `${ALARM_NOTIFICATION_ID_PREFIX}${alarm.id}::${date.getTime()}`;
}

/** Every fire time for an alarm inside the next `windowDays` days. */
function computeOccurrences(alarm: CoupleAlarm, windowDays = 14): Date[] {
  const [hour, minute] = alarm.alarm_time.split(':').map(Number);
  if (isNaN(hour) || isNaN(minute)) return [];
  const activeDays = alarm.days_active && alarm.days_active.length > 0
    ? alarm.days_active
    : [0, 1, 2, 3, 4, 5, 6];

  const now = Date.now();
  const out: Date[] = [];
  const base = new Date();
  for (let offset = 0; offset <= windowDays; offset += 1) {
    const candidate = new Date(base);
    candidate.setDate(base.getDate() + offset);
    candidate.setHours(hour, minute, 0, 0);
    if (activeDays.includes(candidate.getDay()) && candidate.getTime() > now) {
      out.push(candidate);
    }
  }
  return out;
}

async function scheduleOccurrence(alarm: CoupleAlarm, date: Date) {
  const trigger: TimestampTrigger = {
    type: TriggerType.TIMESTAMP,
    timestamp: date.getTime(),
    alarmManager: { type: AlarmType.SET_ALARM_CLOCK },
  };

  await notifee.createTriggerNotification(
    {
      id: occurrenceId(alarm, date),
      title: alarm.purpose || 'NOVIA Alarm',
      body: `${alarm.alarm_time.slice(0, 5)} — ${alarm.sync_mode} alarm for both of you.`,
      data: { kind: 'alarm', alarmId: alarm.id },
      android: {
        channelId: ALARM_CHANNEL_ID,
        category: AndroidCategory.ALARM,
        importance: AndroidImportance.HIGH,
        visibility: AndroidVisibility.PUBLIC,
        sound: 'alarm',
        loopSound: true,
        autoCancel: false,
        ongoing: true,
        showTimestamp: true,
        smallIcon: 'ic_launcher',
        pressAction: { id: 'default', launchActivity: 'default' },
        fullScreenAction: {
          id: 'default',
          launchActivity: 'default',
          launchActivityFlags: [AndroidLaunchActivityFlag.SINGLE_TOP],
        },
        actions: [
          { title: 'Wake Up', pressAction: { id: 'stop-alarm' } },
          { title: 'Snooze 5m', pressAction: { id: 'snooze-alarm' } },
        ],
      },
      ios: {
        sound: 'alarm.wav',
        critical: true,
        criticalVolume: 1.0,
        interruptionLevel: 'critical',
        categoryId: 'novia-alarm',
      },
    },
    trigger,
  );
}

export interface AlarmSyncResult {
  /** How many occurrences we attempted to schedule across all enabled alarms. */
  expected: number;
  /** How many NOVIA triggers are actually armed in the OS afterwards. */
  armed: number;
  /** Whether the OS currently permits exact alarms (false => nothing will ring). */
  exactAlarmAllowed: boolean;
}

/**
 * Cancel every previously scheduled NOVIA alarm trigger and re-schedule a
 * rolling `windowDays`-day window from the current couple alarm list.
 * Call this on app start, when alarms change, and when the app returns to
 * the foreground so the window keeps rolling forward.
 *
 * Returns a summary so callers can detect silent failures (e.g. exact-alarm
 * permission revoked -> `expected > 0` but `armed === 0`).
 */
export async function syncCoupleAlarms(
  alarms: CoupleAlarm[],
  windowDays = 14,
): Promise<AlarmSyncResult> {
  const result: AlarmSyncResult = { expected: 0, armed: 0, exactAlarmAllowed: true };
  if (Platform.OS !== 'android' && Platform.OS !== 'ios') return result;

  await setupAlarmChannel();

  result.exactAlarmAllowed = await isExactAlarmAllowed();
  if (!result.exactAlarmAllowed) {
    console.warn(
      '[Alarms] Exact-alarm permission is DISABLED — Android will not fire wake-up ' +
        'alarms. Ask the user to grant it via promptExactAlarmPermission().',
    );
  }

  // Cancel existing scheduled NOVIA alarm triggers (leaves other notifications alone).
  const existing = await notifee.getTriggerNotificationIds();
  await Promise.all(
    existing
      .filter((id) => id.startsWith(ALARM_NOTIFICATION_ID_PREFIX))
      .map((id) => notifee.cancelTriggerNotification(id)),
  );

  for (const alarm of alarms) {
    if (!alarm.is_enabled) continue;
    const occurrences = computeOccurrences(alarm, windowDays);
    result.expected += occurrences.length;
    for (const date of occurrences) {
      try {
        await scheduleOccurrence(alarm, date);
      } catch (e) {
        // Never let one bad occurrence abort the rest of the schedule.
        console.error(
          `[Alarms] Failed to arm alarm ${alarm.id} @ ${date.toISOString()}:`,
          e,
        );
      }
    }
  }

  // Read back what actually landed so silent failures become visible.
  const armedIds = (await notifee.getTriggerNotificationIds()).filter((id) =>
    id.startsWith(ALARM_NOTIFICATION_ID_PREFIX),
  );
  result.armed = armedIds.length;

  console.log(
    `[Alarms] sync complete — armed ${result.armed}/${result.expected} occurrences ` +
      `(exactAlarmAllowed=${result.exactAlarmAllowed}).`,
  );
  if (result.expected > 0 && result.armed === 0) {
    console.warn(
      '[Alarms] Expected occurrences but NONE were armed. Most likely the ' +
        'exact-alarm permission is off, or the OS killed/optimised the app.',
    );
  }

  return result;
}

/**
 * The alarmId of any alarm notification currently displayed (i.e. actively
 * ringing) right now, or null. Used when the app resumes from the lock screen
 * via the full-screen intent: `getInitialNotification` only covers a cold
 * launch, so on a warm resume we read the still-ongoing alarm notification to
 * decide whether to surface the branded ringing screen.
 */
export async function getActiveRingingAlarmId(): Promise<string | null> {
  try {
    const displayed = await notifee.getDisplayedNotifications();
    const active = displayed.find((d) => d.notification?.data?.kind === 'alarm');
    const alarmId = active?.notification?.data?.alarmId;
    return typeof alarmId === 'string' ? alarmId : null;
  } catch (e) {
    console.warn('[Alarms] Could not read displayed notifications:', e);
    return null;
  }
}

export async function cancelAllAlarms() {
  const ids = await notifee.getTriggerNotificationIds();
  await Promise.all(
    ids
      .filter((i) => i.startsWith(ALARM_NOTIFICATION_ID_PREFIX))
      .map((i) => notifee.cancelTriggerNotification(i)),
  );
}

export async function stopRingingAlarm(notificationId?: string) {
  // Stops the looping sound + removes the active notification.
  if (notificationId) await notifee.cancelDisplayedNotification(notificationId);
  else await notifee.cancelAllNotifications();
  await notifee.stopForegroundService().catch(() => {});
}

/** Snooze the alarm by re-scheduling it N minutes from now. */
export async function snoozeAlarm(
  id: string,
  title: string,
  body: string,
  minutes = 5,
) {
  await stopRingingAlarm(ALARM_NOTIFICATION_ID_PREFIX + id);
  const next = new Date(Date.now() + minutes * 60_000);
  await scheduleAlarm({ id, title, body, date: next });
}

/** Foreground event handler — register once at app start. */
export function registerAlarmForegroundHandler(
  onRing: (alarmId: string, notificationId: string) => void,
) {
  return notifee.onForegroundEvent(async ({ type, detail }) => {
    const n = detail.notification;
    const isAlarm = n?.data?.kind === 'alarm';
    if (!isAlarm || !n?.id) return;

    if (type === EventType.DELIVERED) {
      onRing(String(n.data?.alarmId ?? ''), n.id);
    }
    if (type === EventType.ACTION_PRESS) {
      if (detail.pressAction?.id === 'stop-alarm') {
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
}
