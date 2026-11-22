import { useCallback, useEffect, useMemo, useState } from 'react';
import { supabase } from '../../services/supabase';
import { toLocalISODate } from '../../utils/dateUtils';
import { along, distanceKm, Place } from './places';

export interface Journey {
  id: string;
  couple_id: string;
  from_name: string;
  from_lat: number;
  from_lng: number;
  to_name: string;
  to_lat: number;
  to_lng: number;
  target_steps: number;
  started_on: string;
  completed_at: string | null;
  created_by: string | null;
  created_at: string;
}

/** How long a journey is meant to take, in days. */
export const PACES = [
  { key: 'fortnight', label: 'Two weeks', days: 14 },
  { key: 'season', label: 'A season', days: 90 },
  { key: 'year', label: 'A year', days: 365 },
] as const;

const FALLBACK_DAILY = 8000;

/**
 * Walk Together: one shared journey at a time. Progress is your combined
 * steps since the start day (from the step duel's step_counts), against a
 * target sized from your own recent walking, so a "season" really takes about
 * a season for the two of you.
 */
export function useJourney(coupleId: string | null, userId: string | null) {
  const [journey, setJourney] = useState<Journey | null>(null);
  const [walked, setWalked] = useState(0);
  const [avgDaily, setAvgDaily] = useState(FALLBACK_DAILY);
  const [loading, setLoading] = useState(true);

  const load = useCallback(async () => {
    if (!coupleId) return;
    const [{ data: js }, { data: steps }] = await Promise.all([
      supabase.from('journeys').select('*').eq('couple_id', coupleId).order('created_at', { ascending: false }).limit(1),
      supabase.from('step_counts').select('step_date, steps').eq('couple_id', coupleId).order('step_date', { ascending: false }).limit(400),
    ]);
    const j = (js?.[0] as Journey) ?? null;
    setJourney(j);

    const rows = steps ?? [];
    // Average combined steps per day over the last 30 days that have any data.
    const cutoff = toLocalISODate(new Date(Date.now() - 30 * 86_400_000));
    const perDay = new Map<string, number>();
    for (const r of rows) if (r.step_date >= cutoff) perDay.set(r.step_date, (perDay.get(r.step_date) ?? 0) + (r.steps ?? 0));
    const vals = [...perDay.values()].filter((v) => v > 0);
    setAvgDaily(vals.length >= 3 ? Math.round(vals.reduce((a, b) => a + b, 0) / vals.length) : FALLBACK_DAILY);

    setWalked(j ? rows.filter((r) => r.step_date >= j.started_on).reduce((a, r) => a + (r.steps ?? 0), 0) : 0);
    setLoading(false);
  }, [coupleId]);

  useEffect(() => {
    if (!coupleId) return;
    load();
    const ch = supabase
      .channel(`next-journey:${coupleId}`)
      .on('postgres_changes', { event: '*', schema: 'public', table: 'journeys', filter: `couple_id=eq.${coupleId}` }, load)
      .on('postgres_changes', { event: '*', schema: 'public', table: 'step_counts', filter: `couple_id=eq.${coupleId}` }, load)
      .subscribe();
    return () => {
      supabase.removeChannel(ch);
    };
  }, [coupleId, load]);

  const derived = useMemo(() => {
    if (!journey) return null;
    const from = { lat: journey.from_lat, lng: journey.from_lng };
    const to = { lat: journey.to_lat, lng: journey.to_lng };
    const progress = Math.min(1, walked / journey.target_steps);
    const km = distanceKm(from, to);
    return {
      from,
      to,
      progress,
      km,
      kmDone: km * progress,
      here: along(from, to, progress),
      stepsLeft: Math.max(0, journey.target_steps - walked),
      daysLeft: Math.ceil(Math.max(0, journey.target_steps - walked) / Math.max(avgDaily, 1)),
    };
  }, [journey, walked, avgDaily]);

  // Mark arrival once, from whichever phone notices first.
  useEffect(() => {
    if (journey && derived && derived.progress >= 1 && !journey.completed_at) {
      supabase.from('journeys').update({ completed_at: new Date().toISOString() }).eq('id', journey.id).is('completed_at', null).then(load);
    }
  }, [journey, derived, load]);

  const start = async (from: Place, to: Place, days: number) => {
    if (!coupleId || !userId) return;
    const { error } = await supabase.from('journeys').insert({
      couple_id: coupleId,
      created_by: userId,
      from_name: from.name,
      from_lat: from.lat,
      from_lng: from.lng,
      to_name: to.name,
      to_lat: to.lat,
      to_lng: to.lng,
      target_steps: Math.max(1000, Math.round(avgDaily * days)),
      started_on: toLocalISODate(new Date()),
    });
    if (error) throw new Error(error.message);
    await load();
  };

  return { journey, walked, avgDaily, loading, derived, start, reload: load };
}
