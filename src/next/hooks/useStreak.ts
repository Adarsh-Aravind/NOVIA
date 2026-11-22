import { useCallback, useEffect, useState } from 'react';
import { AppState } from 'react-native';
import { supabase } from '../../services/supabase';
import { useChannelSuffix } from '../../services/realtime';
import { toLocalISODate } from '../../utils/dateUtils';

export interface Streak {
  /** Consecutive days you both opened NOVIA Next, up to today or yesterday. */
  days: number;
  /** Whether each of you has shown up today yet. */
  meToday: boolean;
  partnerToday: boolean;
  /** Longest run on record. */
  best: number;
}

const EMPTY: Streak = { days: 0, meToday: false, partnerToday: false, best: 0 };

function shift(iso: string, delta: number): string {
  const [y, m, d] = iso.split('-').map(Number);
  return toLocalISODate(new Date(y, m - 1, d + delta));
}

/**
 * The Together streak: a day counts when you both open NOVIA Next. Opening
 * the app records today for you (once a day, on launch and on every return
 * to the foreground), and the count updates live when your partner opens it.
 *
 * A streak survives until the end of today: if you both showed up yesterday,
 * it still stands this morning, waiting for today to be claimed.
 */
export function useStreak(coupleId: string | null, me: string | null): Streak {
  // Per-instance name: see services/realtime.ts.
  const channelSuffix = useChannelSuffix();
  const [streak, setStreak] = useState<Streak>(EMPTY);

  const load = useCallback(async () => {
    if (!coupleId || !me) return;
    const since = shift(toLocalISODate(new Date()), -400);
    const { data } = await supabase.from('together_days').select('user_id, day').eq('couple_id', coupleId).gte('day', since);
    const mine = new Set<string>();
    const theirs = new Set<string>();
    for (const r of data ?? []) (r.user_id === me ? mine : theirs).add(r.day);
    const both = (d: string) => mine.has(d) && theirs.has(d);

    const today = toLocalISODate(new Date());
    let day = both(today) ? today : shift(today, -1);
    let days = 0;
    while (both(day)) {
      days++;
      day = shift(day, -1);
    }

    let best = 0;
    let run = 0;
    [...mine].filter((d) => theirs.has(d)).sort().forEach((d, i, arr) => {
      run = i > 0 && shift(arr[i - 1], 1) === d ? run + 1 : 1;
      best = Math.max(best, run);
    });

    setStreak({ days, meToday: mine.has(today), partnerToday: theirs.has(today), best });
  }, [coupleId, me]);

  const checkIn = useCallback(async () => {
    if (!coupleId || !me) return;
    await supabase
      .from('together_days')
      .upsert({ couple_id: coupleId, user_id: me, day: toLocalISODate(new Date()) }, { onConflict: 'couple_id,user_id,day', ignoreDuplicates: true });
    load();
  }, [coupleId, me, load]);

  useEffect(() => {
    if (!coupleId || !me) return;
    checkIn();
    const sub = AppState.addEventListener('change', (s) => s === 'active' && checkIn());
    const ch = supabase
      .channel(`next-streak:${coupleId}:${channelSuffix}`)
      .on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'together_days', filter: `couple_id=eq.${coupleId}` }, load)
      .subscribe();
    return () => {
      sub.remove();
      supabase.removeChannel(ch);
    };
  }, [coupleId, me, checkIn, load]);

  return streak;
}
