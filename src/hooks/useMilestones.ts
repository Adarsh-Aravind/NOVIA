import { useEffect, useState } from 'react';
import { supabase } from '../services/supabase';
import { Milestone, MilestoneRecurrence } from '../types';

/**
 * Shared relationship milestones (first date, anniversaries, one-off dates).
 *
 * Couple-scoped and realtime, mirroring useTodos: both partners see the same
 * list, and each device schedules its own local notifications from it so both
 * get the "On this day" heads-up.
 */
export function useMilestones(coupleId: string | null, userId: string | null) {
  const [milestones, setMilestones] = useState<Milestone[]>([]);
  const [loading, setLoading] = useState<boolean>(true);

  const fetchMilestones = async () => {
    if (!coupleId) return;
    const { data, error } = await supabase
      .from('milestones')
      .select('*')
      .eq('couple_id', coupleId)
      .order('milestone_date', { ascending: true });

    if (error) {
      console.error('[Milestones] Fetch error:', error);
    } else {
      setMilestones((data || []) as Milestone[]);
    }
  };

  useEffect(() => {
    if (!coupleId) {
      setMilestones([]);
      setLoading(false);
      return;
    }

    setLoading(true);
    fetchMilestones().finally(() => setLoading(false));

    const channel = supabase
      .channel(`milestones-sync:${coupleId}`)
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'milestones', filter: `couple_id=eq.${coupleId}` },
        () => fetchMilestones()
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [coupleId]);

  const addMilestone = async (input: {
    title: string;
    date: string; // 'YYYY-MM-DD'
    recurrence: MilestoneRecurrence;
    emoji?: string;
  }) => {
    if (!coupleId || !userId || !input.title.trim() || !input.date) return null;

    const { data, error } = await supabase
      .from('milestones')
      .insert({
        couple_id: coupleId,
        title: input.title.trim(),
        milestone_date: input.date,
        recurrence: input.recurrence,
        emoji: input.emoji?.trim() || null,
        created_by: userId,
      })
      .select('*')
      .single();

    if (error) {
      console.error('[Milestones] Add failed:', error);
      return null;
    }
    await fetchMilestones();
    return data as Milestone;
  };

  const deleteMilestone = async (id: string) => {
    const { error } = await supabase.from('milestones').delete().eq('id', id);
    if (error) console.error('[Milestones] Delete failed:', error);
    else await fetchMilestones();
  };

  return { milestones, loading, addMilestone, deleteMilestone };
}
