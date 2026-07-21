import { useEffect, useMemo, useState } from 'react';
import { supabase } from '../services/supabase';
import { CheckIn } from '../types';

/** Format a Date as local 'YYYY-MM-DD' (matches the DATE column semantics). */
function toLocalISODate(d: Date): string {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${y}-${m}-${day}`;
}

/**
 * Consecutive-day streak ending today (or yesterday, so the streak isn't lost
 * until a full day is actually missed). Walks backwards from the cursor while
 * each day is present in the set.
 */
function computeStreak(dates: Set<string>): number {
  const cursor = new Date();
  cursor.setHours(0, 0, 0, 0);

  // Today not logged yet is fine — keep the streak alive from yesterday. Two
  // missed days in a row breaks it.
  if (!dates.has(toLocalISODate(cursor))) {
    cursor.setDate(cursor.getDate() - 1);
    if (!dates.has(toLocalISODate(cursor))) return 0;
  }

  let streak = 0;
  while (dates.has(toLocalISODate(cursor))) {
    streak++;
    cursor.setDate(cursor.getDate() - 1);
  }
  return streak;
}

/**
 * Daily check-ins for both partners. Reads the couple's rows (RLS permits it),
 * derives each partner's current entry and streak, and upserts the caller's own
 * entry on the (user_id, check_in_date) pair so re-submitting amends today
 * rather than stacking duplicates.
 */
export function useCheckIns(
  coupleId: string | null,
  userId: string | null,
  partnerId: string | null | undefined
) {
  const [checkIns, setCheckIns] = useState<CheckIn[]>([]);
  const [loading, setLoading] = useState<boolean>(true);

  const fetchCheckIns = async () => {
    if (!coupleId) return;
    const { data, error } = await supabase
      .from('check_ins')
      .select('*')
      .eq('couple_id', coupleId)
      .order('check_in_date', { ascending: false });

    if (error) {
      console.error('[CheckIns] Fetch error:', error);
    } else {
      setCheckIns((data || []) as CheckIn[]);
    }
  };

  useEffect(() => {
    if (!coupleId) {
      setCheckIns([]);
      setLoading(false);
      return;
    }

    setLoading(true);
    fetchCheckIns().finally(() => setLoading(false));

    const channel = supabase
      .channel(`checkins-sync:${coupleId}`)
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'check_ins', filter: `couple_id=eq.${coupleId}` },
        () => fetchCheckIns()
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [coupleId]);

  const today = toLocalISODate(new Date());

  const myCheckIns = useMemo(
    () => checkIns.filter((c) => c.user_id === userId),
    [checkIns, userId]
  );
  const partnerCheckIns = useMemo(
    () => checkIns.filter((c) => partnerId && c.user_id === partnerId),
    [checkIns, partnerId]
  );

  const myToday = myCheckIns.find((c) => c.check_in_date === today) || null;
  const partnerToday = partnerCheckIns.find((c) => c.check_in_date === today) || null;

  const myStreak = useMemo(
    () => computeStreak(new Set(myCheckIns.map((c) => c.check_in_date))),
    [myCheckIns]
  );
  const partnerStreak = useMemo(
    () => computeStreak(new Set(partnerCheckIns.map((c) => c.check_in_date))),
    [partnerCheckIns]
  );

  const submitCheckIn = async (feeling: string, gratitude?: string) => {
    if (!coupleId || !userId || !feeling) return null;

    const { data, error } = await supabase
      .from('check_ins')
      .upsert(
        {
          couple_id: coupleId,
          user_id: userId,
          check_in_date: today,
          feeling,
          gratitude: gratitude?.trim() || null,
          updated_at: new Date().toISOString(),
        },
        { onConflict: 'user_id,check_in_date' }
      )
      .select('*')
      .single();

    if (error) {
      console.error('[CheckIns] Submit failed:', error);
      return null;
    }
    await fetchCheckIns();
    return data as CheckIn;
  };

  return {
    checkIns,
    myToday,
    partnerToday,
    myStreak,
    partnerStreak,
    submitCheckIn,
    loading,
  };
}
