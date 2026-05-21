import { useEffect, useState } from 'react';
import { supabase } from '../services/supabase';
import { Reminder } from '../types';

export function useReminders(coupleId: string | null, userId: string | null) {
  const [reminders, setReminders] = useState<Reminder[]>([]);
  const [loading, setLoading] = useState<boolean>(true);

  const fetchReminders = async () => {
    if (!coupleId) return;
    setLoading(true);
    try {
      const { data, error } = await supabase
        .from('reminders')
        .select('*')
        .eq('couple_id', coupleId)
        .order('created_at', { ascending: false });

      if (error) {
        console.error('[Reminders Hook] Fetch error:', error);
      } else {
        setReminders((data || []) as Reminder[]);
      }
    } catch (e) {
      console.error('[Reminders Hook] Unexpected error:', e);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchReminders();

    if (!coupleId) return;

    // Setup realtime listener for synchronization
    const remindersChannel = supabase
      .channel(`reminders-sync:${coupleId}`)
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'reminders', filter: `couple_id=eq.${coupleId}` },
        () => fetchReminders()
      )
      .subscribe();

    return () => {
      supabase.removeChannel(remindersChannel);
    };
  }, [coupleId, userId]);

  const addReminder = async (title: string, category: string, recurrence: string = 'none', metadata: any = {}) => {
    if (!coupleId || !userId || !title.trim()) return null;

    const payload = {
      couple_id: coupleId,
      title: title.trim(),
      category,
      due_date: new Date().toISOString(),
      is_completed: false,
      recurrence,
      metadata,
      created_by: userId,
    };

    const { data, error } = await supabase
      .from('reminders')
      .insert(payload)
      .select('*')
      .single();

    if (error) {
      console.error('[Reminders Sync] Add failed:', error);
      return null;
    }

    // Proactively fetch updated list
    await fetchReminders();
    return data as Reminder;
  };

  const toggleReminder = async (reminderId: string, completed: boolean) => {
    const { error } = await supabase
      .from('reminders')
      .update({ is_completed: completed })
      .eq('id', reminderId);

    if (error) {
      console.error('[Reminders Sync] Toggle failed:', error);
    } else {
      await fetchReminders();
    }
  };

  const deleteReminder = async (reminderId: string) => {
    const { error } = await supabase
      .from('reminders')
      .delete()
      .eq('id', reminderId);

    if (error) {
      console.error('[Reminders Sync] Delete failed:', error);
    } else {
      await fetchReminders();
    }
  };

  return {
    reminders,
    loading,
    addReminder,
    toggleReminder,
    deleteReminder,
  };
}
