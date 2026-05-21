import { useEffect, useState } from 'react';
import { supabase } from '../services/supabase';
import { Alarm, Punishment } from '../types';
import { cancelScheduledNotificationsByPrefix, scheduleLocalNotification, scheduleSharedReminder } from '../services/notification';

type AddAlarmInput = {
  alarmId?: string;
  hour: number;
  minute: number;
  daysActive: number[];
  syncMode: Alarm['sync_mode'];
  purpose: string;
};

function nextAlarmDate(alarm: Alarm) {
  const [hour, minute] = alarm.alarm_time.split(':').map(Number);
  const now = new Date();
  const activeDays = alarm.days_active.length > 0 ? alarm.days_active : [0, 1, 2, 3, 4, 5, 6];

  for (let offset = 0; offset < 8; offset += 1) {
    const candidate = new Date(now);
    candidate.setDate(now.getDate() + offset);
    candidate.setHours(hour, minute, 0, 0);

    if (activeDays.includes(candidate.getDay()) && candidate.getTime() > now.getTime()) {
      return candidate;
    }
  }

  return null;
}

export function useAlarms(coupleId: string | null, userId: string | null) {
  const [alarms, setAlarms] = useState<Alarm[]>([]);
  const [activePunishments, setActivePunishments] = useState<Punishment[]>([]);
  const [loading, setLoading] = useState<boolean>(true);
  const [userKey, setUserKey] = useState<1 | 2 | null>(null);

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

  useEffect(() => {
    const scheduleSharedAlarms = async () => {
      if (!coupleId) return;

      await cancelScheduledNotificationsByPrefix(`alarm:${coupleId}:`);
      await Promise.all(
        alarms
          .filter((alarm) => alarm.is_enabled)
          .map(async (alarm) => {
            const fireDate = nextAlarmDate(alarm);
            if (!fireDate) return null;

            return scheduleSharedReminder({
              reminderKey: `alarm:${coupleId}:${alarm.id}`,
              title: alarm.purpose || 'NOVIA Alarm',
              body: `${alarm.alarm_time.slice(0, 5)} ${alarm.sync_mode} alarm is ringing for both partners.`,
              date: fireDate,
              channelId: 'alarm-channel',
            });
          })
      );
    };

    scheduleSharedAlarms();
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

    // B. Schedule local high-priority snooze notification in 5 minutes (300s)
    await scheduleLocalNotification({
      title: "NOVIA Alarm",
      body: `Wake up! Snooze active (${nextSnoozeCount}/3).`,
      trigger: { seconds: 300 } as any,
      channelId: 'alarm-channel',
    });

    // C. Check snooze limit boundary for automatic punishment trigger
    if (nextSnoozeCount >= 3) {
      await triggerPunishment(
        'alarm_skip',
        'visual_restriction',
        `Snoozed alarm 3 times! All access is locked until partner resolves this.`
      );
    } else {
      await triggerPunishment(
        'alarm_skip',
        'penalty_status',
        `Snoozed the alarm! (Snooze count: ${nextSnoozeCount}/3)`
      );
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
    addAlarm,
    deleteAlarm,
    toggleAlarm,
    triggerAlarmSnooze,
    dismissAlarm,
    triggerPunishment,
    resolvePunishment,
  };
}
