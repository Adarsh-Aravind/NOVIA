import { useCallback, useEffect, useMemo, useState } from 'react';
import { supabase } from '../../services/supabase';
import { parseLocalDate, toLocalISODate } from '../../utils/dateUtils';

/**
 * Your Sky: every shared moment the two of you have made, as one star each.
 *
 * Nothing new is stored. The stars are read from what the app already holds:
 * notes, finished todos, bucket-list items you did, milestones, step-duel days and
 * complaints you talked through and resolved. They are laid out in time order
 * as a phyllotaxis spiral (the sunflower-seed pattern), oldest at the heart
 * where the two lights sit and newest at the rim. So the sky is a picture of
 * your actual history, no two couples get the same one, and it grows outward a
 * little every time you do something together.
 */
export type StarKind = 'milestone' | 'journey' | 'bucket' | 'repair' | 'walk' | 'note' | 'todo';
export type StarOwner = 'me' | 'partner' | 'us';

export interface Star {
  id: string;
  kind: StarKind;
  owner: StarOwner;
  at: Date;
  label: string;
  /** Polar position around the sky's heart: radius 0..1, angle in radians. */
  r: number;
  a: number;
  size: number;
  /** 0 = far, 2 = near. Near stars move more when the phone tilts. */
  depth: 0 | 1 | 2;
}

const SIZE: Record<StarKind, number> = { milestone: 3.6, journey: 3.4, bucket: 2.8, repair: 2.4, walk: 1.9, note: 1.6, todo: 1.3 };
const GOLDEN = Math.PI * (3 - Math.sqrt(5));

/** FNV-1a, so a star keeps its exact place across launches and phones. */
function hash(s: string): number {
  let h = 2166136261;
  for (let i = 0; i < s.length; i++) {
    h ^= s.charCodeAt(i);
    h = Math.imul(h, 16777619);
  }
  return (h >>> 0) / 4294967295;
}

function owner(by: string | null | undefined, me: string | null): StarOwner {
  if (!by) return 'us';
  return by === me ? 'me' : 'partner';
}

function clip(text: string, n = 60): string {
  const t = (text || '').replace(/\s+/g, ' ').trim();
  return t.length > n ? `${t.slice(0, n - 1)}…` : t;
}

type Raw = Omit<Star, 'r' | 'a' | 'size' | 'depth'>;

export function useConstellation(coupleId: string | null, userId: string | null) {
  const [raw, setRaw] = useState<Raw[]>([]);
  const [loading, setLoading] = useState(true);

  const load = useCallback(async () => {
    if (!coupleId) return;
    const [notes, todos, bucket, miles, repairs, walks, trips] = await Promise.all([
      supabase.from('notes').select('id, content, created_by, created_at').eq('couple_id', coupleId).limit(500),
      supabase.from('todos').select('id, title, created_by, created_at').eq('couple_id', coupleId).eq('is_completed', true).limit(300),
      supabase.from('bucket_list').select('id, title, completed_by, completed_at, created_at').eq('couple_id', coupleId).eq('is_completed', true).limit(200),
      supabase.from('milestones').select('id, title, emoji, milestone_date').eq('couple_id', coupleId).limit(200),
      supabase.from('complaints').select('id, title, updated_at').eq('couple_id', coupleId).eq('status', 'resolved').limit(200),
      supabase.from('step_counts').select('user_id, step_date, steps').eq('couple_id', coupleId).limit(1000),
      supabase.from('journeys').select('id, from_name, to_name, completed_at').eq('couple_id', coupleId).not('completed_at', 'is', null).limit(100),
    ]);

    const out: Raw[] = [];
    for (const n of notes.data ?? []) {
      out.push({ id: n.id, kind: 'note', owner: owner(n.created_by, userId), at: new Date(n.created_at), label: clip(n.content) || 'A note' });
    }
    for (const t of todos.data ?? []) {
      out.push({ id: t.id, kind: 'todo', owner: owner(t.created_by, userId), at: new Date(t.created_at), label: clip(t.title) });
    }
    for (const b of bucket.data ?? []) {
      out.push({ id: b.id, kind: 'bucket', owner: 'us', at: new Date(b.completed_at ?? b.created_at), label: clip(b.title) });
    }
    for (const m of miles.data ?? []) {
      out.push({ id: m.id, kind: 'milestone', owner: 'us', at: parseLocalDate(m.milestone_date), label: `${m.emoji ? `${m.emoji} ` : ''}${clip(m.title)}` });
    }
    for (const c of repairs.data ?? []) {
      out.push({ id: c.id, kind: 'repair', owner: 'us', at: new Date(c.updated_at), label: clip(c.title) });
    }

    for (const j of trips.data ?? []) {
      out.push({ id: j.id, kind: 'journey', owner: 'us', at: new Date(j.completed_at), label: `Walked from ${j.from_name} to ${j.to_name}` });
    }

    // One star per step-duel day, coloured by whoever walked further. Today
    // is left out until it's over, so the star doesn't change hands mid-day.
    const days = new Map<string, { mine: number | null; theirs: number | null }>();
    for (const s of walks.data ?? []) {
      const d = days.get(s.step_date) ?? { mine: null, theirs: null };
      if (s.user_id === userId) d.mine = s.steps;
      else d.theirs = s.steps;
      days.set(s.step_date, d);
    }
    const today = toLocalISODate(new Date());
    days.forEach(({ mine, theirs }, date) => {
      if (date === today || ((mine ?? 0) === 0 && (theirs ?? 0) === 0)) return;
      const m = mine ?? 0;
      const t = theirs ?? 0;
      const fmt = (n: number) => n.toLocaleString('en-IN');
      out.push({
        id: `walk-${coupleId}-${date}`,
        kind: 'walk',
        owner: m === t ? 'us' : m > t ? 'me' : 'partner',
        at: parseLocalDate(date),
        label: theirs === null ? `You walked ${fmt(m)} steps` : mine === null ? `They walked ${fmt(t)} steps` : `You ${fmt(m)} · them ${fmt(t)} steps`,
      });
    });
    setRaw(out.filter((s) => !isNaN(s.at.getTime())));
    setLoading(false);
  }, [coupleId, userId]);

  useEffect(() => {
    load();
  }, [load]);

  const stars = useMemo<Star[]>(() => {
    const sorted = [...raw].sort((x, y) => x.at.getTime() - y.at.getTime());
    const n = Math.max(sorted.length, 1);
    return sorted.map((s, i) => {
      const h = hash(s.id);
      return {
        ...s,
        // sqrt keeps the spiral evenly dense from heart to rim.
        r: Math.min(1, Math.sqrt((i + 0.5) / n) * (0.92 + 0.08 * h)),
        a: i * GOLDEN + (h - 0.5) * 0.35,
        size: SIZE[s.kind] * (0.85 + 0.3 * h),
        depth: (s.kind === 'milestone' || s.kind === 'journey' ? 2 : Math.floor(h * 3)) as 0 | 1 | 2,
      };
    });
  }, [raw]);

  const first = stars.length ? stars[0].at : null;
  return { stars, first, loading, reload: load };
}
