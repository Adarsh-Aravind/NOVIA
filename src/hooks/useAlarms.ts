import { useEffect, useState } from 'react';
import { supabase } from '../services/supabase';
import { Alarm, Punishment } from '../types';
import { syncCoupleAlarms, promptExactAlarmPermission, snoozeAlarm } from '../services/alarmService';

// Creative, couple-flirty punishments handed out when someone won't get up.
// Long-distance friendly — everything is doable from opposite ends of the map.
// Shown to BOTH partners (offender + partner) via the realtime punishments feed.
const FLIRTY_PUNISHMENTS = [
  'Owes their partner a good-morning voice note singing their favourite song 🎤',
  'Must send 3 selfies today — bed hair mandatory, no filters 🤳',
  'Has to text their partner a cheesy pickup line every hour til noon 💌',
  'Loses playlist rights — partner picks every song on the shared playlist today 🎧',
  'Owes a full 30-minute video call date tonight, phone propped up, undivided 📹',
  'Must order their partner’s favourite food to their door — surprise delivery 🍕',
  'Has to write and send a 5-line poem about missing their partner ✍️❤️',
  'Owes a voice note narrating their whole day like a lovesick documentary 🎙️',
  'Must be the one to send the first good-morning AND goodnight text for a week 🌙',
  'Has to send a 60-second video saying 3 things they love about their partner 🎬',
];

const FLIRTY_LOCKDOWNS = [
  'Snooze royalty detected 👑🔒 App stays locked until your partner video-calls you awake and unlocks it.',
  'Too cozy in bed 😴🔒 Access is frozen until your partner rings you and personally talks you up.',
  'Locked out for over-snoozing 🔒 Only your partner’s tap can free you — go call and be adorable about it.',
];

const pickRandom = (list: string[]) => list[Math.floor(Math.random() * list.length)];

type AddAlarmInput = {
  alarmId?: string;
  hour: number;
  minute: number;
  daysActive: number[];
  syncMode: Alarm['sync_mode'];
  purpose: string;
};

export function useAlarms(coupleId: string | null, userId: string | null) {
  const [alarms, setAlarms] = useState<Alarm[]>([]);
  const [activePunishments, setActivePunishments] = useState<Punishment[]>([]);
  const [loading, setLoading] = useState<boolean>(true);
  const [userKey, setUserKey] = useState<1 | 2 | null>(null);
  // True when there are enabled alarms but the OS refused to arm any of them
  // (almost always because the exact-alarm permission is revoked).
  const [alarmsBlocked, setAlarmsBlocked] = useState<boolean>(false);

  const fetchAlarmsData = async () => {
    if (!coupleId || !userId) return;
    setLoading(true);
    try {
      // 0. Fetch Couple to determine userKey
      const { data: coupleData } = await supabase
        .from('couples')
        .select('user_1_id, user_2_id')
        .eq('id', coupleId)
        .single();

      if (coupleData) {
        if (coupleData.user_1_id === userId) {
          setUserKey(1);
        } else if (coupleData.user_2_id === userId) {
          setUserKey(2);
        }
      }

      // 1. Fetch Alarms
      const { data: alarmsList } = await supabase
        .from('alarms')
        .select('*')
        .eq('couple_id', coupleId);
      
      if (alarmsList) setAlarms(alarmsList);

      // 2. Fetch Active Punishments
      const { data: punishments } = await supabase
        .from('punishments')
        .select('*')
        .eq('couple_id', coupleId)
        .eq('is_active', true);
      
      if (punishments) setActivePunishments(punishments);
    } catch (e) {
      console.error('[Alarms Hook] Fetch error:', e);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchAlarmsData();

    if (!coupleId) return;

    // Realtime channel updates
    const alarmsChannel = supabase
      .channel(`alarms-sync:${coupleId}`)
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'alarms', filter: `couple_id=eq.${coupleId}` },
        () => fetchAlarmsData()
      )
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'punishments', filter: `couple_id=eq.${coupleId}` },
        () => fetchAlarmsData()
      )
      .subscribe();

    return () => {
      supabase.removeChannel(alarmsChannel);
    };
  }, [coupleId, userId]);

  // Schedule real OS-level alarms (notifee, exact SET_ALARM_CLOCK triggers) so
  // they ring even when the app is killed or the phone is locked / in Doze.
  useEffect(() => {
    if (!coupleId) return;
    syncCoupleAlarms(alarms)
      .then((result) => {
        // Flag when we have enabled alarms that the OS won't actually fire, so
        // the UI can prompt for a fix instead of the alarm silently never
        // ringing. Exact-alarm permission being off is the decisive signal:
        // notifee still *stores* the triggers (so `armed` looks healthy), but
        // Android never arms them.
        setAlarmsBlocked(
          result.expected > 0 && (result.armed === 0 || !result.exactAlarmAllowed),
        );
      })
      .catch((e) => {
        console.error('[Alarms] Failed to schedule notifee alarms:', e);
        setAlarmsBlocked(true);
      });
  }, [alarms, coupleId]);

  const toggleAlarm = async (alarmId: string, enabled: boolean) => {
    const { error } = await supabase
      .from('alarms')
      .update({ is_enabled: enabled, updated_at: new Date().toISOString() })
      .eq('id', alarmId);

    if (error) console.error('[Alarms Sync] Toggle failed:', error);
  };

  const addAlarm = async ({ alarmId, hour, minute, daysActive, syncMode, purpose }: AddAlarmInput) => {
    if (!coupleId) return null;

    const alarm_time = `${String(hour).padStart(2, '0')}:${String(minute).padStart(2, '0')}:00`;
    const sanitizedDays = Array.from(new Set(daysActive))
      .filter((day) => day >= 0 && day <= 6)
      .sort((a, b) => a - b);

    const payload = {
      purpose: purpose.trim() || null,
      alarm_time,
      days_active: sanitizedDays,
      sync_mode: syncMode,
      updated_at: new Date().toISOString(),
    };

    const saveAlarm = (body: Partial<typeof payload>) => {
      if (alarmId) {
        return supabase.from('alarms').update(body).eq('id', alarmId).select('*').single();
      }

      return supabase
        .from('alarms')
        .insert({
          ...body,
          couple_id: coupleId,
          is_enabled: true,
          user_1_status: 'idle',
          user_2_status: 'idle',
          snooze_count_1: 0,
          snooze_count_2: 0,
        })
        .select('*')
        .single();
    };

    let { data, error } = await saveAlarm(payload);

    if (error?.code === 'PGRST204' && error.message.includes('purpose')) {
      const { purpose: _purpose, ...fallbackPayload } = payload;
      const fallbackResult = await saveAlarm(fallbackPayload);
      data = fallbackResult.data;
      error = fallbackResult.error;
    }

    if (error?.code === 'PGRST204' && error.message.includes('updated_at')) {
      const { purpose: _purpose, updated_at: _updatedAt, ...fallbackPayload } = payload;
      const fallbackResult = await saveAlarm(fallbackPayload);
      data = fallbackResult.data;
      error = fallbackResult.error;
    }

    if (!data && !error) return null;

    if (error) {
      console.error('[Alarms Sync] Save alarm failed:', error);
      return null;
    }

    if (data) {
      const alarmData = {
        ...(data as Alarm),
        purpose: (data as Alarm).purpose ?? (purpose.trim() || null),
      } as Alarm;

      setAlarms((current) => {
        if (alarmId) {
          return current.map((alarm) => (alarm.id === alarmId ? alarmData : alarm));
        }
        return [alarmData, ...current];
      });
    }

    return data as Alarm;
  };

  const deleteAlarm = async (alarmId: string) => {
    const { error } = await supabase.from('alarms').delete().eq('id', alarmId);
    if (error) console.error('[Alarms Sync] Delete failed:', error);
  };

  // Snooze tracking with F3 Snooze Punishment trigger
  const triggerAlarmSnooze = async (alarmId: string, userKey: 1 | 2) => {
    const alarm = alarms.find((a) => a.id === alarmId);
    if (!alarm || !coupleId || !userId) return;

    const currentSnoozeCount = userKey === 1 ? alarm.snooze_count_1 : alarm.snooze_count_2;
    const nextSnoozeCount = currentSnoozeCount + 1;

    const updates: Partial<Alarm> = {
      updated_at: new Date().toISOString(),
    };

    if (userKey === 1) {
      updates.snooze_count_1 = nextSnoozeCount;
      updates.user_1_status = 'snoozed';
    } else {
      updates.snooze_count_2 = nextSnoozeCount;
      updates.user_2_status = 'snoozed';
    }

    // A. Perform alarm DB update
    await supabase.from('alarms').update(updates).eq('id', alarmId);

    // B. Re-ring as a REAL full-screen notifee alarm in 5 minutes (loops the
    //    sound, re-surfaces the branded ring screen, fires over the lock
    //    screen) rather than a plain heads-up notification.
    await snoozeAlarm(
      alarmId,
      alarm.purpose || 'NOVIA Alarm',
      `Snooze ${nextSnoozeCount} — wake up, love 💛`,
      5,
    );

    // C. Escalating, couple-flirty punishments — all mirrored to the partner via
    //    the realtime punishments feed. 1st snooze is a grace (no punishment);
    //    the creative flirty penalty lands from the 2nd snooze; a playful
    //    lockout from the 3rd.
    if (nextSnoozeCount >= 3) {
      await triggerPunishment('alarm_skip', 'visual_restriction', pickRandom(FLIRTY_LOCKDOWNS));
    } else if (nextSnoozeCount >= 2) {
      await triggerPunishment('alarm_skip', 'penalty_status', pickRandom(FLIRTY_PUNISHMENTS));
    }
  };

  // Dismiss Alarm
  const dismissAlarm = async (alarmId: string, userKey: 1 | 2) => {
    const updates: Partial<Alarm> = {
      updated_at: new Date().toISOString(),
    };

    if (userKey === 1) {
      updates.snooze_count_1 = 0;
      updates.user_1_status = 'dismissed';
    } else {
      updates.snooze_count_2 = 0;
      updates.user_2_status = 'dismissed';
    }

    await supabase.from('alarms').update(updates).eq('id', alarmId);
  };

  // Trigger Punishment Engine
  const triggerPunishment = async (source: Punishment['source'], penaltyType: Punishment['penalty_type'], description: string) => {
    if (!coupleId || !userId) return;
    
    await supabase.from('punishments').insert({
      couple_id: coupleId,
      offender_id: userId,
      source,
      penalty_type: penaltyType,
      description,
      is_active: true,
      created_at: new Date().toISOString(),
    });
  };

  // Resolve active punishment (e.g. partner unlocks it)
  const resolvePunishment = async (punishmentId: string) => {
    await supabase
      .from('punishments')
      .update({ is_active: false, resolved_at: new Date().toISOString() })
      .eq('id', punishmentId);
  };

  return {
    alarms,
    activePunishments,
    loading,
    userKey,
    alarmsBlocked,
    promptExactAlarmPermission,
    addAlarm,
    deleteAlarm,
    toggleAlarm,
    triggerAlarmSnooze,
    dismissAlarm,
    triggerPunishment,
    resolvePunishment,
  };
}
