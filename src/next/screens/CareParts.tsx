import React, { useCallback, useEffect, useState } from 'react';
import { StyleSheet, Text, View } from 'react-native';
import { ChevronDown, ChevronUp } from 'lucide-react-native';

import { Press } from '../components/Press';
import { Card, Label, Field, Button, Empty, ui } from '../components/ui';
import { Sheet, Choice, DateField } from '../components/Sheet';
import { supabase } from '../../services/supabase';
import { parseLocalDate, toLocalISODate } from '../../utils/dateUtils';
import type { PeriodRecord, Profile } from '../../types';
import { C, F } from '../theme';

/**
 * The cycle log and the hospital visit log, ported from the old Health tab.
 * Same tables and the same symptom encoding ("bleeding:light" and so on), so
 * predictions and both apps read them identically.
 */

const BLEEDING = ['none', 'spotting', 'light', 'heavy'] as const;
const PHYSICAL = ['none', 'cramps', 'tender', 'bloating', 'energized'] as const;
const FLUID = ['none', 'dry', 'sticky', 'creamy', 'eggwhite'] as const;
const EMOTION = ['calm', 'irritable', 'sad', 'anxious', 'happy'] as const;
const ENERGY = ['low', 'normal', 'stressed', 'high'] as const;

const cap = (s: string) => s.charAt(0).toUpperCase() + s.slice(1);
const LABELS: Record<string, string> = { tender: 'Tender breasts', eggwhite: 'Egg-white (fertile)' };
const nice = (s: string) => LABELS[s] ?? cap(s);

export function CycleLog({
  records,
  addPeriodLog,
  refresh,
}: {
  records: PeriodRecord[];
  addPeriodLog: (start: string, end: string | null, symptoms: string[], notes: string | null) => Promise<boolean>;
  refresh: () => Promise<unknown> | void;
}) {
  const [open, setOpen] = useState(false);
  const [start, setStart] = useState<string | null>(toLocalISODate(new Date()));
  const [end, setEnd] = useState<string | null>(null);
  const [bleeding, setBleeding] = useState<(typeof BLEEDING)[number]>('none');
  const [physical, setPhysical] = useState<(typeof PHYSICAL)[number]>('none');
  const [fluid, setFluid] = useState<(typeof FLUID)[number]>('none');
  const [emotion, setEmotion] = useState<(typeof EMOTION)[number]>('calm');
  const [energy, setEnergy] = useState<(typeof ENERGY)[number]>('normal');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const save = async () => {
    if (!start) return setError('Choose the day it started.');
    if (end && end < start) return setError('The end can’t be before the start.');
    setBusy(true);
    setError(null);
    const symptoms: string[] = [];
    if (bleeding !== 'none') symptoms.push(`bleeding:${bleeding}`);
    if (physical !== 'none') symptoms.push(`physical:${physical}`);
    if (fluid !== 'none') symptoms.push(`fluid:${fluid}`);
    if (emotion !== 'calm') symptoms.push(`emotion:${emotion}`);
    if (energy !== 'normal') symptoms.push(`energy:${energy}`);
    const ok = await addPeriodLog(start, end, symptoms, null);
    setBusy(false);
    if (!ok) return setError('Couldn’t save it. Check your connection and try again; nothing you entered is lost.');
    await refresh();
    setOpen(false);
    setEnd(null);
    setBleeding('none');
    setPhysical('none');
    setFluid('none');
    setEmotion('calm');
    setEnergy('normal');
  };

  const recent = [...records].sort((a, b) => b.start_date.localeCompare(a.start_date)).slice(0, 4);
  const fmt = (d: string) => parseLocalDate(d).toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' });

  return (
    <>
      <Button title="Log a period" kind="ghost" onPress={() => setOpen(true)} />
      {recent.length > 0 && (
        <View style={{ gap: 4 }}>
          <Label>Recent</Label>
          {recent.map((r) => (
            <Text key={r.id} style={ui.soft}>
              {fmt(r.start_date)}
              {r.end_date ? ` to ${fmt(r.end_date)}` : ''}
              {r.symptoms?.length ? ` · ${r.symptoms.map((x) => nice(x.split(':')[1] ?? x)).join(', ')}` : ''}
            </Text>
          ))}
        </View>
      )}
      <Sheet visible={open} title="Log a period" onClose={() => setOpen(false)}>
        <DateField label="Started" value={start} onChange={setStart} />
        <DateField label="Ended" value={end} onChange={setEnd} optional />
        <Label>How it is today</Label>
        <Text style={styles.q}>Flow</Text>
        <Choice options={BLEEDING} value={bleeding} onChange={setBleeding} label={nice} colour={C.partner} />
        <Text style={styles.q}>Body</Text>
        <Choice options={PHYSICAL} value={physical} onChange={setPhysical} label={nice} colour={C.partner} />
        <Text style={styles.q}>Discharge</Text>
        <Choice options={FLUID} value={fluid} onChange={setFluid} label={nice} colour={C.partner} />
        <Text style={styles.q}>Mood</Text>
        <Choice options={EMOTION} value={emotion} onChange={setEmotion} label={nice} colour={C.partner} />
        <Text style={styles.q}>Energy</Text>
        <Choice options={ENERGY} value={energy} onChange={setEnergy} label={nice} colour={C.partner} />
        {error && <Text style={styles.error}>{error}</Text>}
        <Button title={busy ? 'Saving…' : 'Save'} onPress={save} disabled={busy} />
      </Sheet>
    </>
  );
}

interface Visit {
  id: string;
  user_id: string;
  record_date: string;
  notes: string | null;
  value_json: { reason?: string; test_results?: string } | null;
}

/** Both partners' hospital visits, newest first, and a form to add one. */
export function HospitalVisits({ profile, partner }: { profile: Profile; partner: Profile | null }) {
  const [visits, setVisits] = useState<Visit[]>([]);
  const [openId, setOpenId] = useState<string | null>(null);
  const [adding, setAdding] = useState(false);
  const [date, setDate] = useState<string | null>(toLocalISODate(new Date()));
  const [reason, setReason] = useState('');
  const [results, setResults] = useState('');
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    const ids = [profile.id, partner?.id].filter(Boolean) as string[];
    const { data } = await supabase
      .from('medical_vault')
      .select('id, user_id, record_date, notes, value_json')
      .eq('metric_type', 'hospital_visit')
      .in('user_id', ids)
      .order('record_date', { ascending: false });
    setVisits((data as Visit[]) ?? []);
  }, [profile.id, partner?.id]);

  useEffect(() => {
    load();
  }, [load]);

  const save = async () => {
    if (!reason.trim()) return setError('Add the reason for the visit.');
    const { error: err } = await supabase.from('medical_vault').insert({
      user_id: profile.id,
      metric_type: 'hospital_visit',
      value_json: { reason: reason.trim(), test_results: results.trim() },
      // parseLocalDate, not new Date(str): a bare date parses as UTC midnight.
      record_date: date ? parseLocalDate(date).toISOString() : new Date().toISOString(),
      notes: results.trim() || null,
    });
    if (err) return setError(err.message);
    setAdding(false);
    setReason('');
    setResults('');
    setError(null);
    load();
  };

  return (
    <Card>
      <Label>Hospital visits</Label>
      {visits.length === 0 ? (
        <Empty title="No visits logged" body="A shared record of visits, reasons and results, so neither of you has to remember." />
      ) : (
        visits.map((v) => {
          const mine = v.user_id === profile.id;
          const isOpen = openId === v.id;
          return (
            <Press key={v.id} depth={0.99} onPress={() => setOpenId(isOpen ? null : v.id)} style={styles.visit} accessibilityRole="button">
              <View style={ui.row}>
                <View style={[styles.dot, { backgroundColor: mine ? C.me : C.partner }]} />
                <View style={{ flex: 1 }}>
                  <Text style={ui.body}>{v.value_json?.reason || 'Visit'}</Text>
                  <Text style={ui.soft}>
                    {new Date(v.record_date).toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' })} · {mine ? 'You' : partner?.display_name || 'Partner'}
                  </Text>
                </View>
                {isOpen ? <ChevronUp size={18} color={C.inkSoft} /> : <ChevronDown size={18} color={C.inkSoft} />}
              </View>
              {isOpen && <Text style={[ui.body, { marginTop: 6 }]}>{v.value_json?.test_results || v.notes || 'No results or notes recorded.'}</Text>}
            </Press>
          );
        })
      )}
      <Button title="Add a visit" kind="ghost" onPress={() => setAdding(true)} />
      <Sheet visible={adding} title="Hospital visit" onClose={() => setAdding(false)}>
        <DateField label="When" value={date} onChange={setDate} />
        <Field placeholder="Reason" value={reason} onChangeText={setReason} />
        <Field placeholder="Test results or doctor’s notes (optional)" value={results} onChangeText={setResults} multiline />
        {error && <Text style={styles.error}>{error}</Text>}
        <Button title="Save visit" onPress={save} />
      </Sheet>
    </Card>
  );
}

/** The season's stakes: what the loser of the step duel owes. */
export function Stakes({ forfeit, setForfeit }: { forfeit: string | null; setForfeit: (t: string) => Promise<void> }) {
  const [open, setOpen] = useState(false);
  const [text, setText] = useState(forfeit ?? '');
  return (
    <>
      <Press onPress={() => { setText(forfeit ?? ''); setOpen(true); }} depth={0.98} style={styles.stakes} accessibilityRole="button">
        <Text style={ui.soft}>Stakes</Text>
        <Text style={[ui.body, { flex: 1, textAlign: 'right' }]} numberOfLines={2}>
          {forfeit ? `Loser: ${forfeit}` : 'Set what the loser owes'}
        </Text>
      </Press>
      <Sheet visible={open} title="This season’s stakes" onClose={() => setOpen(false)}>
        <Field placeholder="Like “cooks dinner for a week”" value={text} onChangeText={setText} />
        <Button
          title="Save stakes"
          onPress={async () => {
            if (!text.trim()) return;
            await setForfeit(text.trim());
            setOpen(false);
          }}
        />
      </Sheet>
    </>
  );
}

const styles = StyleSheet.create({
  q: { fontFamily: F.semibold, fontSize: 13, color: C.inkSoft, marginTop: 2 },
  error: { fontFamily: F.medium, fontSize: 13.5, color: C.danger },
  visit: { paddingVertical: 6 },
  dot: { width: 8, height: 8, borderRadius: 4 },
  stakes: { flexDirection: 'row', alignItems: 'center', gap: 12, paddingTop: 10, borderTopWidth: StyleSheet.hairlineWidth, borderTopColor: C.line },
});
