import React, { useMemo, useState } from 'react';
import { StyleSheet, Text, View } from 'react-native';
import { Press } from '../components/Press';
import * as Haptics from 'expo-haptics';
import { Check, Plus } from 'lucide-react-native';

import { RepairRoom } from './RepairRoom';
import { Page, Card, Field, Segments, Empty, ui } from '../components/ui';
import { useRealtimeNotes } from '../../hooks/useRealtimeNotes';
import { useTodos } from '../../hooks/useTodos';
import { useMilestones } from '../../hooks/useMilestones';
import { useBucket } from '../hooks/useBucket';
import { daysUntilNext } from '../../utils/milestoneMath';
import { parseLocalDate } from '../../utils/dateUtils';
import type { Profile } from '../../types';
import { C, F, R } from '../theme';

type Section = 'notes' | 'plans' | 'someday' | 'dates' | 'repair';

interface Props {
  profile: Profile;
  partner: Profile | null;
  coupleId: string;
  bottomInset: number;
}

/**
 * Everything the two of you keep together, in one place: notes, plans,
 * someday-list and dates. In the current app these are four separate
 * screens reached from the hub; here they are four views of one page.
 * Colour tells you who wrote what.
 */
export function UsScreen({ profile, partner, coupleId, bottomInset }: Props) {
  const [section, setSection] = useState<Section>('notes');
  const me = profile.id;
  const partnerName = partner?.display_name || 'Partner';
  const who = (id: string | null | undefined) => (id === me ? C.me : id ? C.partner : C.star);

  return (
    <Page
      kicker={`${profile.display_name || 'You'} & ${partnerName}`}
      title="Us"
      bottomInset={bottomInset}
      header={
        <Segments
          value={section}
          onChange={setSection}
          options={[
            { key: 'notes', label: 'Notes' },
            { key: 'plans', label: 'Plans' },
            { key: 'someday', label: 'Someday' },
            { key: 'dates', label: 'Dates' },
            { key: 'repair', label: 'Repair' },
          ]}
        />
      }
    >
      {section === 'notes' && <Notes coupleId={coupleId} me={me} partnerName={partnerName} who={who} />}
      {section === 'plans' && <Plans coupleId={coupleId} me={me} who={who} />}
      {section === 'someday' && <Someday coupleId={coupleId} me={me} who={who} />}
      {section === 'dates' && <Dates coupleId={coupleId} me={me} />}
      {section === 'repair' && <RepairRoom coupleId={coupleId} me={me} partnerName={partnerName} />}
    </Page>
  );
}

function Composer({ placeholder, onSubmit, onTyping }: { placeholder: string; onSubmit: (t: string) => Promise<unknown> | void; onTyping?: (on: boolean) => void }) {
  const [text, setText] = useState('');
  const send = async () => {
    const t = text.trim();
    if (!t) return;
    setText('');
    onTyping?.(false);
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    await onSubmit(t);
  };
  return (
    <View style={styles.composer}>
      <Field
        value={text}
        onChangeText={(t) => {
          setText(t);
          onTyping?.(t.length > 0);
        }}
        placeholder={placeholder}
        style={{ flex: 1 }}
        returnKeyType="done"
        onSubmitEditing={send}
      />
      <Press onPress={send} style={[styles.add, !text.trim() && { opacity: 0.4 }]} accessibilityRole="button" accessibilityLabel="Add">
        <Plus size={20} color={C.night} />
      </Press>
    </View>
  );
}

function Notes({ coupleId, me, partnerName, who }: { coupleId: string; me: string; partnerName: string; who: (id?: string | null) => string }) {
  const { notes, isPartnerTyping, setTyping, addNote, toggleReaction } = useRealtimeNotes(coupleId, me);
  return (
    <>
      <Composer placeholder="Leave a note for both of you" onSubmit={addNote} onTyping={setTyping} />
      {isPartnerTyping && <Text style={[ui.soft, { color: C.partner, paddingHorizontal: 4 }]}>{partnerName} is writing…</Text>}
      {notes.length === 0 ? (
        <Empty title="No notes yet" body="Anything you write here shows up on both phones at once, and becomes a star in your sky." />
      ) : (
        <View style={styles.grid}>
          {notes.map((n) => {
            const reactions = Object.values(n.reactions ?? {});
            return (
              <Press
                key={n.id}
                depth={0.985}
                haptic={false}
                onLongPress={() => {
                  Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
                  toggleReaction(n, '❤️');
                }}
              >
                <Card style={{ borderTopColor: who(n.created_by), borderTopWidth: 2 }}>
                  <Text style={ui.body}>{n.content}</Text>
                  <View style={ui.row}>
                    <Text style={[styles.meta, { color: who(n.created_by) }]}>{n.created_by === me ? 'You' : partnerName}</Text>
                    <Text style={styles.meta}>{new Date(n.created_at).toLocaleDateString('en-GB', { day: 'numeric', month: 'short' })}</Text>
                    {reactions.length > 0 && <Text style={styles.react}>{reactions.join(' ')}</Text>}
                  </View>
                </Card>
              </Press>
            );
          })}
        </View>
      )}
      {notes.length > 0 && <Text style={[ui.soft, { textAlign: 'center' }]}>Press and hold a note to heart it.</Text>}
    </>
  );
}

function Plans({ coupleId, me, who }: { coupleId: string; me: string; who: (id?: string | null) => string }) {
  const { todos, addTodo, toggleTodo } = useTodos(coupleId, me);
  const open = todos.filter((t) => !t.is_completed);
  const done = todos.filter((t) => t.is_completed);
  return (
    <>
      <Composer
        placeholder="Add something to do together"
        onSubmit={(title) => {
          const due = new Date();
          due.setDate(due.getDate() + 1);
          due.setHours(10, 0, 0, 0);
          return addTodo({ title, dueAt: due, recurrence: 'once' });
        }}
      />
      {open.length === 0 && done.length === 0 && <Empty title="Nothing planned" body="Plans remind both of you. Finished ones become stars." />}
      {open.length > 0 && (
        <Card>
          {open.map((t) => (
            <CheckRow key={t.id} title={t.title} sub={new Date(t.due_at).toLocaleString('en-GB', { day: 'numeric', month: 'short', hour: 'numeric', minute: '2-digit' })} done={false} colour={who(t.created_by)} onToggle={() => toggleTodo(t.id, true)} />
          ))}
        </Card>
      )}
      {done.length > 0 && (
        <Card style={{ opacity: 0.75 }}>
          <Text style={styles.meta}>Done · {done.length}</Text>
          {done.slice(0, 8).map((t) => (
            <CheckRow key={t.id} title={t.title} done colour={who(t.created_by)} onToggle={() => toggleTodo(t.id, false)} />
          ))}
        </Card>
      )}
    </>
  );
}

function Someday({ coupleId, me, who }: { coupleId: string; me: string; who: (id?: string | null) => string }) {
  const { items, add, toggle } = useBucket(coupleId, me);
  const open = items.filter((i) => !i.is_completed);
  const done = items.filter((i) => i.is_completed);
  return (
    <>
      <Composer placeholder="Somewhere to go, something to try" onSubmit={add} />
      {items.length === 0 && <Empty title="Your someday list is empty" body="Things you want to do together. Each one you do becomes a bright star." />}
      {open.length > 0 && (
        <Card>
          {open.map((i) => (
            <CheckRow key={i.id} title={i.title} sub={i.description ?? undefined} done={false} colour={who(i.created_by)} onToggle={() => {
              Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
              toggle(i);
            }} />
          ))}
        </Card>
      )}
      {done.length > 0 && (
        <Card>
          <Text style={styles.meta}>Done together · {done.length}</Text>
          {done.map((i) => (
            <CheckRow key={i.id} title={i.title} sub={i.completed_at ? new Date(i.completed_at).toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' }) : undefined} done colour={C.star} onToggle={() => toggle(i)} />
          ))}
        </Card>
      )}
    </>
  );
}

function Dates({ coupleId, me }: { coupleId: string; me: string }) {
  const { milestones } = useMilestones(coupleId, me);
  const list = useMemo(
    () =>
      milestones
        .map((m) => ({ m, days: daysUntilNext(m, new Date()) }))
        .sort((a, b) => (a.days ?? 1e9) - (b.days ?? 1e9)),
    [milestones]
  );
  if (list.length === 0) return <Empty title="No dates yet" body="Anniversaries and firsts. They become the brightest stars, joined into your story line." />;
  return (
    <Card>
      {list.map(({ m, days }) => (
        <View key={m.id} style={styles.dateRow}>
          <Text style={styles.emoji}>{m.emoji || '✦'}</Text>
          <View style={{ flex: 1 }}>
            <Text style={ui.body}>{m.title}</Text>
            <Text style={ui.soft}>{parseLocalDate(m.milestone_date).toLocaleDateString('en-GB', { day: 'numeric', month: 'long', year: 'numeric' })}</Text>
          </View>
          <Text style={styles.days}>{days === 0 ? 'Today' : days === null ? 'Past' : `${days}d`}</Text>
        </View>
      ))}
    </Card>
  );
}

function CheckRow({ title, sub, done, colour, onToggle }: { title: string; sub?: string; done: boolean; colour: string; onToggle: () => void }) {
  return (
    <Press onPress={onToggle} style={styles.check} accessibilityRole="checkbox" accessibilityState={{ checked: done }}>
      <View style={[styles.box, { borderColor: colour }, done && { backgroundColor: colour }]}>{done && <Check size={14} color={C.night} strokeWidth={3} />}</View>
      <View style={{ flex: 1 }}>
        <Text style={[ui.body, done && { color: C.inkSoft, textDecorationLine: 'line-through' }]}>{title}</Text>
        {sub ? <Text style={ui.soft}>{sub}</Text> : null}
      </View>
    </Press>
  );
}

const styles = StyleSheet.create({
  composer: { flexDirection: 'row', gap: 8, alignItems: 'center' },
  add: { width: 48, height: 48, borderRadius: 24, backgroundColor: C.star, alignItems: 'center', justifyContent: 'center' },
  grid: { gap: 10 },
  meta: { fontFamily: F.semibold, fontSize: 12, color: C.inkSoft },
  react: { marginLeft: 'auto', fontSize: 14 },
  check: { flexDirection: 'row', alignItems: 'center', gap: 12, paddingVertical: 4 },
  box: { width: 24, height: 24, borderRadius: 8, borderWidth: 1.5, alignItems: 'center', justifyContent: 'center' },
  dateRow: { flexDirection: 'row', alignItems: 'center', gap: 12, paddingVertical: 4 },
  emoji: { fontSize: 22, width: 30, textAlign: 'center', color: C.star },
  days: { fontFamily: F.display, fontSize: 16, color: C.star, fontVariant: ['tabular-nums'] },
});
