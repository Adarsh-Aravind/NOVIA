import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { StyleSheet, Text, View } from 'react-native';
import { Press } from '../components/Press';
import { ChevronLeft, ChevronRight, Sun, CloudSun, Cloud, CloudDrizzle, CloudRain, CloudLightning, Moon } from 'lucide-react-native';
import { Card, Label, ui } from '../components/ui';
import { supabase } from '../../services/supabase';
import { useChannelSuffix } from '../../services/realtime';
import { toLocalISODate } from '../../utils/dateUtils';
import { C, F } from '../theme';

/**
 * Weather of us: both of your moods, day by day, as weather. Two weeks at a
 * time, paging back as far as your history goes.
 *
 * Moods come from mood_logs, which a database trigger fills whenever either
 * app changes a mood. Before that table existed, the old daily check-ins
 * (an emoji a day, July to September) supply the early history, read in
 * place.
 */

type Kind = 'sunny' | 'fair' | 'cloudy' | 'drizzle' | 'rain' | 'storm' | 'spent';

const ICON: Record<Kind, typeof Sun> = {
  sunny: Sun,
  fair: CloudSun,
  cloudy: Cloud,
  drizzle: CloudDrizzle,
  rain: CloudRain,
  storm: CloudLightning,
  spent: Moon,
};

const WORD: Record<Kind, string> = {
  sunny: 'sunny',
  fair: 'fair',
  cloudy: 'cloudy',
  drizzle: 'grey',
  rain: 'rainy',
  storm: 'stormy',
  spent: 'worn out',
};

const FROM_MOOD: Record<string, Kind> = {
  Happy: 'sunny',
  Neutral: 'fair',
  'Low Energy': 'cloudy',
  Exhausted: 'spent',
  Overwhelmed: 'storm',
};

const FROM_FEELING: Record<string, Kind> = {
  '😄': 'sunny',
  '🙂': 'fair',
  '😐': 'cloudy',
  '😔': 'drizzle',
  '😢': 'rain',
};

const DAYS = 14;

function shift(iso: string, delta: number): string {
  const [y, m, d] = iso.split('-').map(Number);
  return toLocalISODate(new Date(y, m - 1, d + delta));
}

export function WeatherOfUs({ coupleId, me, partnerName }: { coupleId: string; me: string; partnerName: string }) {
  // Per-instance name: see services/realtime.ts.
  const channelSuffix = useChannelSuffix();
  // Map of 'YYYY-MM-DD' -> weather, per person. Later entries in a day win.
  const [mine, setMine] = useState<Map<string, Kind>>(new Map());
  const [theirs, setTheirs] = useState<Map<string, Kind>>(new Map());
  const [earliest, setEarliest] = useState<string | null>(null);
  const [page, setPage] = useState(0);

  const load = useCallback(async () => {
    const [logs, checks] = await Promise.all([
      supabase.from('mood_logs').select('user_id, mood, logged_at').eq('couple_id', coupleId).order('logged_at', { ascending: true }).limit(2000),
      supabase.from('check_ins').select('user_id, feeling, check_in_date').eq('couple_id', coupleId).order('check_in_date', { ascending: true }).limit(2000),
    ]);
    const a = new Map<string, Kind>();
    const b = new Map<string, Kind>();
    let first: string | null = null;
    const put = (user: string, day: string, kind: Kind | undefined) => {
      if (!kind) return;
      (user === me ? a : b).set(day, kind);
      if (!first || day < first) first = day;
    };
    for (const c of checks.data ?? []) put(c.user_id, c.check_in_date, FROM_FEELING[c.feeling]);
    for (const l of logs.data ?? []) put(l.user_id, toLocalISODate(new Date(l.logged_at)), FROM_MOOD[l.mood]);
    setMine(a);
    setTheirs(b);
    setEarliest(first);
  }, [coupleId, me]);

  useEffect(() => {
    load();
    const ch = supabase
      .channel(`next-weather:${coupleId}:${channelSuffix}`)
      .on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'mood_logs', filter: `couple_id=eq.${coupleId}` }, load)
      .subscribe();
    return () => {
      supabase.removeChannel(ch);
    };
  }, [coupleId, load]);

  const today = toLocalISODate(new Date());
  const end = shift(today, -page * DAYS);
  const days = useMemo(() => Array.from({ length: DAYS }, (_, i) => shift(end, i - DAYS + 1)), [end]);
  const canGoBack = earliest !== null && days[0] > earliest;

  const summary = (m: Map<string, Kind>) => {
    const counts = new Map<Kind, number>();
    for (const d of days) {
      const k = m.get(d);
      if (k) counts.set(k, (counts.get(k) ?? 0) + 1);
    }
    if (!counts.size) return 'no reports';
    const [top, n] = [...counts.entries()].sort((x, y) => y[1] - x[1])[0];
    const total = [...counts.values()].reduce((x, y) => x + y, 0);
    return n / total >= 0.6 ? `mostly ${WORD[top]}` : 'mixed';
  };

  const fmtRange = () => {
    const f = (iso: string) => {
      const [y, m, d] = iso.split('-').map(Number);
      return new Date(y, m - 1, d).toLocaleDateString('en-GB', { day: 'numeric', month: 'short' });
    };
    return `${f(days[0])} to ${f(days[DAYS - 1])}`;
  };

  return (
    <Card>
      <View style={ui.row}>
        <Label>Weather of us</Label>
        <View style={{ flex: 1 }} />
        <Press onPress={() => setPage(page + 1)} disabled={!canGoBack} hitSlop={10} accessibilityLabel="Earlier" style={{ opacity: canGoBack ? 1 : 0.3 }}>
          <ChevronLeft size={20} color={C.ink} />
        </Press>
        <Press onPress={() => setPage(Math.max(0, page - 1))} disabled={page === 0} hitSlop={10} accessibilityLabel="Later" style={{ opacity: page === 0 ? 0.3 : 1 }}>
          <ChevronRight size={20} color={C.ink} />
        </Press>
      </View>
      <Text style={ui.soft}>{page === 0 ? 'The last two weeks' : fmtRange()}</Text>

      <Row name="You" colour={C.me} map={mine} days={days} today={today} />
      <Row name={partnerName} colour={C.partner} map={theirs} days={days} today={today} />

      <View style={styles.axis}>
        <View style={styles.axisName} />
        {days.map((d) => {
          const [y, m, dd] = d.split('-').map(Number);
          return (
            <Text key={d} style={[styles.axisDay, d === today && { color: C.ink }]}>
              {new Date(y, m - 1, dd).toLocaleDateString('en-GB', { weekday: 'narrow' })}
            </Text>
          );
        })}
      </View>

      <Text style={ui.soft}>
        You: {summary(mine)} · {partnerName}: {summary(theirs)}
      </Text>
    </Card>
  );
}

function Row({ name, colour, map, days, today }: { name: string; colour: string; map: Map<string, Kind>; days: string[]; today: string }) {
  return (
    <View style={styles.row}>
      <Text style={[styles.name, { color: colour }]} numberOfLines={1}>
        {name}
      </Text>
      {days.map((d) => {
        const k = map.get(d);
        const Icon = k ? ICON[k] : null;
        return (
          <View key={d} style={[styles.cell, d === today && styles.today]}>
            {Icon ? <Icon size={15} color={colour} strokeWidth={2.2} /> : <View style={styles.empty} />}
          </View>
        );
      })}
    </View>
  );
}

const styles = StyleSheet.create({
  row: { flexDirection: 'row', alignItems: 'center' },
  name: { width: 56, fontFamily: F.semibold, fontSize: 12 },
  cell: { flex: 1, height: 26, alignItems: 'center', justifyContent: 'center', borderRadius: 6 },
  today: { backgroundColor: 'rgba(255,255,255,0.1)' },
  empty: { width: 3, height: 3, borderRadius: 2, backgroundColor: 'rgba(255,255,255,0.25)' },
  axis: { flexDirection: 'row', alignItems: 'center' },
  axisName: { width: 56 },
  axisDay: { flex: 1, textAlign: 'center', fontFamily: F.semibold, fontSize: 10, color: C.inkFaint },
});
