import React, { useEffect, useState } from 'react';
import { ActivityIndicator, Pressable, StyleSheet, Text, useWindowDimensions, View } from 'react-native';
import * as Haptics from 'expo-haptics';
import { MapPin, Flag } from 'lucide-react-native';

import { Card, Button, Field, Label, ui } from '../components/ui';
import { Globe } from './Globe';
import { PACES, useJourney } from './useJourney';
import { Place, searchPlaces, distanceKm } from './places';
import { C, F, R } from '../theme';

/**
 * Walk Together: the co-op side of the step duel. Your combined steps carry
 * one light along a route between two places that matter to you.
 */
export function WalkTogether({ coupleId, me }: { coupleId: string; me: string }) {
  const { journey, derived, walked, avgDaily, loading, start } = useJourney(coupleId, me);
  const [planning, setPlanning] = useState(false);
  const { width } = useWindowDimensions();
  const size = Math.min(width - 36 - 32, 340);

  if (loading) {
    return (
      <Card>
        <Label>Walk together</Label>
        <ActivityIndicator color={C.inkSoft} />
      </Card>
    );
  }

  if (!journey || planning || (journey.completed_at && planning)) {
    return (
      <Plan
        avgDaily={avgDaily}
        onCancel={journey ? () => setPlanning(false) : undefined}
        onStart={async (a, b, days) => {
          await start(a, b, days);
          setPlanning(false);
        }}
      />
    );
  }

  const d = derived!;
  const arrived = d.progress >= 1;
  const pct = Math.round(d.progress * 100);
  const fmt = (n: number) => Math.round(n).toLocaleString('en-IN');

  return (
    <Card>
      <Label>Walk together</Label>
      <Text style={styles.route}>
        {journey.from_name} <Text style={{ color: C.inkFaint }}>→</Text> {journey.to_name}
      </Text>
      <View style={{ alignItems: 'center' }}>
        <Globe size={size} from={d.from} to={d.to} here={d.here} progress={d.progress} />
      </View>
      <View style={styles.track}>
        <View style={[styles.fill, { width: `${Math.max(2, pct)}%` }]} />
      </View>
      {arrived ? (
        <Text style={styles.big}>You made it to {journey.to_name}.</Text>
      ) : (
        <Text style={styles.big}>
          {fmt(d.kmDone)} <Text style={styles.unit}>of {fmt(d.km)} km</Text>
        </Text>
      )}
      <Text style={ui.soft}>
        {arrived
          ? `${fmt(walked)} steps between you. It's a star in your sky now.`
          : `${pct}% there · ${fmt(walked)} steps together · about ${d.daysLeft} ${d.daysLeft === 1 ? 'day' : 'days'} to go at your pace`}
      </Text>
      {arrived && <Button title="Plan the next journey" onPress={() => setPlanning(true)} />}
    </Card>
  );
}

function PlaceField({ label, value, onPick, icon }: { label: string; value: Place | null; onPick: (p: Place | null) => void; icon: React.ReactNode }) {
  const [q, setQ] = useState('');
  const [results, setResults] = useState<Place[]>([]);
  const [searching, setSearching] = useState(false);

  useEffect(() => {
    if (value || q.trim().length < 2) {
      setResults([]);
      return;
    }
    let live = true;
    const t = setTimeout(async () => {
      setSearching(true);
      const r = await searchPlaces(q);
      if (live) {
        setResults(r);
        setSearching(false);
      }
    }, 350);
    return () => {
      live = false;
      clearTimeout(t);
    };
  }, [q, value]);

  if (value) {
    return (
      <Pressable onPress={() => onPick(null)} style={styles.picked} accessibilityRole="button" accessibilityHint="Tap to change">
        {icon}
        <View style={{ flex: 1 }}>
          <Text style={ui.body}>{value.name}</Text>
          <Text style={ui.soft}>{value.country}</Text>
        </View>
        <Text style={styles.change}>Change</Text>
      </Pressable>
    );
  }
  return (
    <View style={{ gap: 6 }}>
      <Field placeholder={label} value={q} onChangeText={setQ} autoCorrect={false} />
      {searching && <Text style={ui.soft}>Searching…</Text>}
      {results.map((p) => (
        <Pressable
          key={`${p.name}-${p.lat}-${p.lng}`}
          onPress={() => {
            Haptics.selectionAsync();
            onPick(p);
            setQ('');
          }}
          style={styles.result}
        >
          <Text style={ui.body}>{p.name}</Text>
          <Text style={ui.soft}>{p.country}</Text>
        </Pressable>
      ))}
    </View>
  );
}

function Plan({ avgDaily, onStart, onCancel }: { avgDaily: number; onStart: (a: Place, b: Place, days: number) => Promise<void>; onCancel?: () => void }) {
  const [from, setFrom] = useState<Place | null>(null);
  const [to, setTo] = useState<Place | null>(null);
  const [pace, setPace] = useState(1);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const days = PACES[pace].days;

  return (
    <Card>
      <Label>Walk together</Label>
      <Text style={ui.h2}>Walk somewhere, together</Text>
      <Text style={ui.soft}>Pick two places that mean something: where you met, where you dream of going. Your combined steps carry you there on a globe.</Text>
      <PlaceField label="Start: where it began" value={from} onPick={setFrom} icon={<MapPin size={18} color={C.ink} />} />
      <PlaceField label="Destination: somewhere you'd love to go" value={to} onPick={setTo} icon={<Flag size={18} color={C.partner} />} />
      {from && to && <Text style={ui.soft}>{Math.round(distanceKm(from, to)).toLocaleString('en-IN')} km as the crow flies</Text>}
      <Label>How long should it take?</Label>
      <View style={styles.paces}>
        {PACES.map((p, i) => (
          <Pressable key={p.key} onPress={() => setPace(i)} style={[styles.pace, pace === i && styles.paceOn]} accessibilityRole="button" accessibilityState={{ selected: pace === i }}>
            <Text style={[styles.paceText, pace === i && { color: C.ink }]}>{p.label}</Text>
          </Pressable>
        ))}
      </View>
      <Text style={ui.soft}>
        At your usual {avgDaily.toLocaleString('en-IN')} steps a day between you, that's {(avgDaily * days).toLocaleString('en-IN')} steps.
      </Text>
      {error && <Text style={{ color: C.danger, fontFamily: F.medium }}>{error}</Text>}
      <Button
        title={busy ? 'Starting…' : 'Start walking'}
        disabled={!from || !to || busy}
        onPress={async () => {
          if (!from || !to) return;
          setBusy(true);
          setError(null);
          try {
            await onStart(from, to, days);
            Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
          } catch (e: any) {
            setError(e?.message ?? 'Could not start. Try again.');
          } finally {
            setBusy(false);
          }
        }}
      />
      {onCancel && <Button title="Cancel" kind="ghost" onPress={onCancel} />}
    </Card>
  );
}

const styles = StyleSheet.create({
  route: { fontFamily: F.display, fontSize: 22, color: C.ink, letterSpacing: -0.3 },
  track: { height: 8, borderRadius: 4, backgroundColor: 'rgba(255,255,255,0.07)', overflow: 'hidden' },
  fill: { height: 8, borderRadius: 4, backgroundColor: C.me },
  big: { fontFamily: F.display, fontSize: 26, color: C.ink, letterSpacing: -0.5 },
  unit: { fontFamily: F.medium, fontSize: 15, color: C.inkSoft },
  picked: { flexDirection: 'row', alignItems: 'center', gap: 12, padding: 12, borderRadius: R.md, backgroundColor: 'rgba(255,255,255,0.06)' },
  change: { fontFamily: F.semibold, fontSize: 13, color: C.star },
  result: { paddingHorizontal: 12, paddingVertical: 8, borderRadius: R.sm, backgroundColor: 'rgba(255,255,255,0.04)' },
  paces: { flexDirection: 'row', gap: 8 },
  pace: { flex: 1, height: 40, borderRadius: R.pill, borderWidth: 1, borderColor: C.line, alignItems: 'center', justifyContent: 'center' },
  paceOn: { borderColor: C.star, backgroundColor: 'rgba(255,255,255,0.08)' },
  paceText: { fontFamily: F.semibold, fontSize: 13, color: C.inkSoft },
});
