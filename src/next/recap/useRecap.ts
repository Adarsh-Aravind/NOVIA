import { useEffect, useState } from 'react';
import { supabase } from '../../services/supabase';
import { toLocalISODate } from '../../utils/dateUtils';

export interface RecapData {
  monthLabel: string;
  nextMonthLabel: string;
  daysInMonth: number;
  myWins: number;
  partnerWins: number;
  ties: number;
  mySteps: number;
  partnerSteps: number;
  bestDay: { date: string; steps: number } | null;
  notes: number;
  someday: number;
  repairs: number;
  /** Everything above that would have become a star this month. */
  newStars: number;
}

/** First day of the month containing `d`, offset by `delta` months. */
export function monthStart(d: Date, delta = 0): Date {
  return new Date(d.getFullYear(), d.getMonth() + delta, 1);
}

/**
 * Last month at a glance, computed from what's already stored: step-duel
 * days, notes, someday-list items done and repairs settled. Nothing new is
 * saved for it.
 */
export function useRecap(coupleId: string | null, userId: string | null, month: Date | null) {
  const [data, setData] = useState<RecapData | null>(null);

  useEffect(() => {
    if (!coupleId || !userId || !month) return;
    let live = true;
    (async () => {
      const from = monthStart(month);
      const to = monthStart(month, 1);
      const fromISO = toLocalISODate(from);
      const toISO = toLocalISODate(to);
      const [steps, notes, bucket, repairs] = await Promise.all([
        supabase.from('step_counts').select('user_id, step_date, steps').eq('couple_id', coupleId).gte('step_date', fromISO).lt('step_date', toISO),
        supabase.from('notes').select('id', { count: 'exact', head: true }).eq('couple_id', coupleId).gte('created_at', from.toISOString()).lt('created_at', to.toISOString()),
        supabase.from('bucket_list').select('id', { count: 'exact', head: true }).eq('couple_id', coupleId).eq('is_completed', true).gte('completed_at', from.toISOString()).lt('completed_at', to.toISOString()),
        supabase.from('complaints').select('id', { count: 'exact', head: true }).eq('couple_id', coupleId).eq('status', 'resolved').gte('updated_at', from.toISOString()).lt('updated_at', to.toISOString()),
      ]);

      const days = new Map<string, { mine: number; theirs: number }>();
      for (const s of steps.data ?? []) {
        const d = days.get(s.step_date) ?? { mine: 0, theirs: 0 };
        if (s.user_id === userId) d.mine += s.steps ?? 0;
        else d.theirs += s.steps ?? 0;
        days.set(s.step_date, d);
      }
      let myWins = 0;
      let partnerWins = 0;
      let ties = 0;
      let mySteps = 0;
      let partnerSteps = 0;
      let bestDay: RecapData['bestDay'] = null;
      days.forEach(({ mine, theirs }, date) => {
        mySteps += mine;
        partnerSteps += theirs;
        if (mine === 0 && theirs === 0) return;
        if (mine > theirs) myWins++;
        else if (theirs > mine) partnerWins++;
        else ties++;
        if (!bestDay || mine + theirs > bestDay.steps) bestDay = { date, steps: mine + theirs };
      });

      const n = notes.count ?? 0;
      const b = bucket.count ?? 0;
      const r = repairs.count ?? 0;
      if (!live) return;
      setData({
        monthLabel: from.toLocaleDateString('en-GB', { month: 'long', year: 'numeric' }),
        nextMonthLabel: to.toLocaleDateString('en-GB', { month: 'long' }),
        daysInMonth: Math.round((to.getTime() - from.getTime()) / 86_400_000),
        myWins,
        partnerWins,
        ties,
        mySteps,
        partnerSteps,
        bestDay,
        notes: n,
        someday: b,
        repairs: r,
        newStars: n + b + r + myWins + partnerWins + ties,
      });
    })();
    return () => {
      live = false;
    };
  }, [coupleId, userId, month]);

  return data;
}
