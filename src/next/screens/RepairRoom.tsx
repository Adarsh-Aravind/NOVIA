import React, { useEffect, useState } from 'react';
import { StyleSheet, Text, View } from 'react-native';
import { Press } from '../components/Press';
import * as Haptics from 'expo-haptics';
import { Check, ChevronDown, ChevronUp, Send } from 'lucide-react-native';

import { Card, Button, Field, Label, Empty, ui } from '../components/ui';
import { useComplaints } from '../../hooks/useComplaints';
import { supabase } from '../../services/supabase';
import type { Complaint } from '../../types';
import { C, F, R } from '../theme';

/**
 * The Repair Room, replacing the Complaint Box.
 *
 * A complaint box makes one person the plaintiff. A repair starts from the
 * same place (something hurt) but is built to end: say what you feel and what
 * you need, make one small ask, optionally cool down first, talk it through,
 * and it's repaired only when you have *both* said "we're good". Each repair
 * then becomes a bright star in your sky.
 *
 * Same table as the old box, so the current app still shows these (title and
 * a readable body), and old complaints show here.
 */

type Repair = Complaint & {
  feel?: string | null;
  need?: string | null;
  ask?: string | null;
  cool_until?: string | null;
  repaired_by?: string[] | null;
};

const FEELINGS = ['Hurt', 'Unheard', 'Ignored', 'Overwhelmed', 'Anxious', 'Taken for granted'];
const NEEDS = ['Reassurance', 'Space', 'An apology', 'Help', 'To talk', 'A hug'];
const COOL = [
  { label: 'Talk now', mins: 0 },
  { label: '30 min', mins: 30 },
  { label: '2 hours', mins: 120 },
  { label: 'Tonight', mins: -1 },
];

function coolUntil(mins: number): string | null {
  if (mins === 0) return null;
  const d = new Date();
  if (mins === -1) {
    d.setHours(Math.max(d.getHours() + 1, 20), 30, 0, 0);
  } else {
    d.setMinutes(d.getMinutes() + mins);
  }
  return d.toISOString();
}

export function RepairRoom({ coupleId, me, partnerName }: { coupleId: string; me: string; partnerName: string }) {
  const { complaints, repliesFor, addReply } = useComplaints(coupleId, me);
  const [composing, setComposing] = useState(false);
  const repairs = complaints as Repair[];
  const open = repairs.filter((r) => r.status !== 'resolved');
  const done = repairs.filter((r) => r.status === 'resolved');

  return (
    <>
      {composing ? (
        <Compose coupleId={coupleId} me={me} onDone={() => setComposing(false)} />
      ) : (
        <Press onPress={() => setComposing(true)} style={styles.start} accessibilityRole="button">
          <Text style={styles.startTitle}>Something hurt?</Text>
          <Text style={ui.soft}>Start a repair. Say what you feel and need, and fix it together.</Text>
        </Press>
      )}

      {open.length === 0 && done.length === 0 && !composing && (
        <Empty title="Nothing to repair" body="When something goes wrong, this is where you put it right. Every repair becomes a bright star." />
      )}

      {open.map((r) => (
        <RepairCard key={r.id} repair={r} me={me} partnerName={partnerName} replies={repliesFor(r.id)} addReply={addReply} />
      ))}

      {done.length > 0 && (
        <Card style={{ opacity: 0.8 }}>
          <Label>Repaired · {done.length}</Label>
          {done.map((r) => (
            <View key={r.id} style={styles.doneRow}>
              <View style={styles.doneStar} />
              <View style={{ flex: 1 }}>
                <Text style={ui.body}>{r.title}</Text>
                <Text style={ui.soft}>{new Date(r.updated_at).toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' })}</Text>
              </View>
            </View>
          ))}
        </Card>
      )}
    </>
  );
}

function Chips({ options, value, onChange, colour }: { options: string[]; value: string; onChange: (v: string) => void; colour: string }) {
  return (
    <View style={styles.chips}>
      {options.map((o) => {
        const on = value === o;
        return (
          <Press
            key={o}
            onPress={() => onChange(on ? '' : o)}
            style={[styles.chip, on && { borderColor: colour, backgroundColor: 'rgba(255,255,255,0.08)' }]}
            accessibilityRole="button"
            accessibilityState={{ selected: on }}
          >
            <Text style={[styles.chipText, on && { color: C.ink }]}>{o}</Text>
          </Press>
        );
      })}
    </View>
  );
}

function Compose({ coupleId, me, onDone }: { coupleId: string; me: string; onDone: () => void }) {
  const [what, setWhat] = useState('');
  const [feel, setFeel] = useState('');
  const [need, setNeed] = useState('');
  const [ask, setAsk] = useState('');
  const [cool, setCool] = useState(0);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const submit = async () => {
    if (!what.trim()) {
      setError('Give it a short name first, like “Late again tonight”.');
      return;
    }
    setBusy(true);
    setError(null);
    // The body keeps the old app readable: it shows the same words as text.
    const body = [feel && `I feel ${feel.toLowerCase()}.`, need && `I need ${need.toLowerCase()}.`, ask.trim() && `One ask: ${ask.trim()}`]
      .filter(Boolean)
      .join(' ');
    const { error: err } = await supabase.from('complaints').insert({
      couple_id: coupleId,
      created_by: me,
      title: what.trim(),
      body,
      feel: feel || null,
      need: need || null,
      ask: ask.trim() || null,
      cool_until: coolUntil(COOL[cool].mins),
    });
    setBusy(false);
    if (err) {
      setError(err.message);
      return;
    }
    Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
    onDone();
  };

  return (
    <Card>
      <Label>What happened</Label>
      <Field placeholder="A short name, like “Late again tonight”" value={what} onChangeText={setWhat} />
      <Label>I feel</Label>
      <Chips options={FEELINGS} value={feel} onChange={setFeel} colour={C.me} />
      <Label>I need</Label>
      <Chips options={NEEDS} value={need} onChange={setNeed} colour={C.partner} />
      <Label>One small ask</Label>
      <Field placeholder="Something doable, like “text me if you’re running late”" value={ask} onChangeText={setAsk} multiline />
      <Label>Cool down first?</Label>
      <View style={styles.chips}>
        {COOL.map((c, i) => (
          <Press key={c.label} onPress={() => setCool(i)} style={[styles.chip, cool === i && { borderColor: C.star, backgroundColor: 'rgba(255,255,255,0.08)' }]}>
            <Text style={[styles.chipText, cool === i && { color: C.ink }]}>{c.label}</Text>
          </Press>
        ))}
      </View>
      {error && <Text style={styles.error}>{error}</Text>}
      <Button title={busy ? 'Sending…' : 'Start the repair'} onPress={submit} disabled={busy} />
      <Button title="Not now" kind="ghost" onPress={onDone} />
    </Card>
  );
}

function RepairCard({
  repair,
  me,
  partnerName,
  replies,
  addReply,
}: {
  repair: Repair;
  me: string;
  partnerName: string;
  replies: { id: string; author_id: string; body: string; created_at: string }[];
  addReply: (id: string, body: string) => Promise<unknown>;
}) {
  const [openThread, setOpenThread] = useState(false);
  const [reply, setReply] = useState('');
  const [now, setNow] = useState(Date.now());
  const mine = repair.created_by === me;
  const by = repair.repaired_by ?? [];
  const iConfirmed = by.includes(me);
  const theyConfirmed = by.some((id) => id !== me);
  const coolMs = repair.cool_until ? new Date(repair.cool_until).getTime() - now : 0;

  useEffect(() => {
    if (coolMs <= 0) return;
    const id = setInterval(() => setNow(Date.now()), 30_000);
    return () => clearInterval(id);
  }, [coolMs]);

  const confirm = async () => {
    Haptics.notificationAsync(iConfirmed ? Haptics.NotificationFeedbackType.Warning : Haptics.NotificationFeedbackType.Success);
    await supabase.rpc('confirm_repair', { complaint: repair.id, confirmed: !iConfirmed });
  };

  const send = async () => {
    const t = reply.trim();
    if (!t) return;
    setReply('');
    await addReply(repair.id, t);
  };

  const who = mine ? 'You' : partnerName;
  const colour = mine ? C.me : C.partner;

  return (
    <Card>
      <View style={ui.row}>
        <View style={[styles.dot, { backgroundColor: colour }]} />
        <Text style={[styles.meta, { color: colour }]}>{who} started this</Text>
        <Text style={[styles.meta, { marginLeft: 'auto' }]}>
          {new Date(repair.created_at).toLocaleDateString('en-GB', { day: 'numeric', month: 'short' })}
        </Text>
      </View>
      <Text style={ui.h2}>{repair.title}</Text>

      {repair.feel || repair.need || repair.ask ? (
        <View style={styles.lines}>
          {repair.feel ? <Line k={mine ? 'I feel' : `${partnerName} feels`} v={repair.feel} /> : null}
          {repair.need ? <Line k={mine ? 'I need' : `${partnerName} needs`} v={repair.need} /> : null}
          {repair.ask ? <Line k="One ask" v={repair.ask} /> : null}
        </View>
      ) : repair.body ? (
        <Text style={ui.body}>{repair.body}</Text>
      ) : null}

      {coolMs > 0 && (
        <View style={styles.cool}>
          <Text style={styles.coolText}>
            Cooling down · talk at {new Date(repair.cool_until!).toLocaleTimeString('en-GB', { hour: 'numeric', minute: '2-digit' })}
          </Text>
        </View>
      )}

      <Press onPress={() => setOpenThread(!openThread)} style={styles.threadToggle} accessibilityRole="button">
        <Text style={styles.meta}>{replies.length ? `${replies.length} ${replies.length === 1 ? 'reply' : 'replies'}` : 'Talk it through'}</Text>
        {openThread ? <ChevronUp size={16} color={C.inkSoft} /> : <ChevronDown size={16} color={C.inkSoft} />}
      </Press>
      {openThread && (
        <View style={{ gap: 8 }}>
          {replies.map((r) => (
            <View key={r.id} style={[styles.bubble, r.author_id === me ? styles.bubbleMe : styles.bubbleThem]}>
              <Text style={ui.body}>{r.body}</Text>
            </View>
          ))}
          <View style={ui.row}>
            <Field placeholder={coolMs > 0 ? 'Still cooling down. Write when ready.' : 'Say it kindly'} value={reply} onChangeText={setReply} style={{ flex: 1 }} />
            <Press onPress={send} style={styles.send} accessibilityRole="button" accessibilityLabel="Send reply">
              <Send size={18} color={C.night} />
            </Press>
          </View>
        </View>
      )}

      <View style={styles.confirmRow}>
        <View style={styles.confirmDots}>
          <View style={[styles.confirmDot, { borderColor: C.me }, iConfirmed && { backgroundColor: C.me }]} />
          <View style={[styles.confirmDot, { borderColor: C.partner }, theyConfirmed && { backgroundColor: C.partner }]} />
        </View>
        <Text style={[ui.soft, { flex: 1 }]}>
          {iConfirmed && theyConfirmed
            ? 'Repaired'
            : iConfirmed
              ? `Waiting for ${partnerName}`
              : theyConfirmed
                ? `${partnerName} says you're good`
                : 'Both tap when it’s settled'}
        </Text>
        <Press onPress={confirm} style={[styles.good, iConfirmed && styles.goodOn]} accessibilityRole="button" accessibilityState={{ checked: iConfirmed }}>
          {iConfirmed && <Check size={14} color={C.night} strokeWidth={3} />}
          <Text style={[styles.goodText, iConfirmed && { color: C.night }]}>{iConfirmed ? 'We’re good' : 'We’re good?'}</Text>
        </Press>
      </View>
    </Card>
  );
}

function Line({ k, v }: { k: string; v: string }) {
  return (
    <View style={styles.line}>
      <Text style={styles.lineK}>{k}</Text>
      <Text style={styles.lineV}>{v}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  start: {
    padding: 18,
    borderRadius: R.lg,
    borderWidth: 1,
    borderColor: C.lineStrong,
    borderStyle: 'dashed',
    gap: 4,
  },
  startTitle: { fontFamily: F.display, fontSize: 20, color: C.ink },
  chips: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  chip: { paddingHorizontal: 12, paddingVertical: 8, borderRadius: R.pill, borderWidth: 1, borderColor: C.line },
  chipText: { fontFamily: F.medium, fontSize: 13, color: C.inkSoft },
  error: { fontFamily: F.medium, fontSize: 13.5, color: C.danger },
  dot: { width: 8, height: 8, borderRadius: 4 },
  meta: { fontFamily: F.semibold, fontSize: 12, color: C.inkSoft },
  lines: { gap: 6 },
  line: { flexDirection: 'row', gap: 10 },
  lineK: { width: 104, fontFamily: F.semibold, fontSize: 13, color: C.inkFaint },
  lineV: { flex: 1, fontFamily: F.medium, fontSize: 14, color: C.ink },
  cool: { alignSelf: 'flex-start', paddingHorizontal: 10, paddingVertical: 6, borderRadius: R.pill, backgroundColor: 'rgba(185,168,255,0.12)' },
  coolText: { fontFamily: F.semibold, fontSize: 12.5, color: C.partner },
  threadToggle: { flexDirection: 'row', alignItems: 'center', gap: 6, paddingVertical: 2 },
  bubble: { padding: 10, borderRadius: R.md, maxWidth: '88%' },
  bubbleMe: { alignSelf: 'flex-end', backgroundColor: C.meSoft },
  bubbleThem: { alignSelf: 'flex-start', backgroundColor: C.partnerSoft },
  send: { width: 44, height: 44, borderRadius: 22, backgroundColor: C.star, alignItems: 'center', justifyContent: 'center' },
  confirmRow: { flexDirection: 'row', alignItems: 'center', gap: 10, paddingTop: 10, borderTopWidth: StyleSheet.hairlineWidth, borderTopColor: C.line },
  confirmDots: { flexDirection: 'row', gap: 4 },
  confirmDot: { width: 12, height: 12, borderRadius: 6, borderWidth: 1.5 },
  good: { flexDirection: 'row', alignItems: 'center', gap: 6, paddingHorizontal: 14, height: 36, borderRadius: R.pill, borderWidth: 1, borderColor: C.lineStrong },
  goodOn: { backgroundColor: C.star, borderColor: C.star },
  goodText: { fontFamily: F.bold, fontSize: 13, color: C.ink },
  doneRow: { flexDirection: 'row', alignItems: 'center', gap: 12 },
  doneStar: { width: 10, height: 10, borderRadius: 5, backgroundColor: C.star },
});
