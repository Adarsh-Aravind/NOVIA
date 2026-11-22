import React, { useMemo, useState } from 'react';
import { StyleSheet, Text, View } from 'react-native';
import * as Haptics from 'expo-haptics';
import { Check, Plus, Trash2 } from 'lucide-react-native';

import { Press } from '../components/Press';
import { RepairRoom } from './RepairRoom';
import { ChatIdeas } from './ChatIdeas';
import { Page, Card, Field, Segments, Empty, Button, Label, ui } from '../components/ui';
import { Sheet, Choice, DateField } from '../components/Sheet';
import { useRealtimeNotes } from '../../hooks/useRealtimeNotes';
import { useTodos } from '../../hooks/useTodos';
import { useMilestones } from '../../hooks/useMilestones';
import { useBucket } from '../hooks/useBucket';
import { daysUntilNext } from '../../utils/milestoneMath';
import { parseLocalDate, toLocalISODate } from '../../utils/dateUtils';
import type { Profile, SharedNote, TodoRecurrence, MilestoneRecurrence } from '../../types';
import { C, F, R } from '../theme';

type Section = 'notes' | 'ideas' | 'plans' | 'someday' | 'dates' | 'repair';

interface Props {
  profile: Profile;
  partner: Profile | null;
  coupleId: string;
  bottomInset: number;
}

/**
 * Everything the two of you keep together, in one place: notes, ideas (the
 * assistant), plans, the someday list, dates and repairs. Colour tells you
 * who wrote what. Press and hold anything to act on it.
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
            { key: 'ideas', label: 'Ideas' },
            { key: 'plans', label: 'Plans' },
            { key: 'someday', label: 'Someday' },
            { key: 'dates', label: 'Dates' },
            { key: 'repair', label: 'Repair' },
          ]}
        />
      }
    >
      {section === 'notes' && <Notes coupleId={coupleId} me={me} partnerName={partnerName} who={who} />}
      {section === 'ideas' && <ChatIdeas coupleId={coupleId} me={me} />}
      {section === 'plans' && <Plans coupleId={coupleId} me={me} who={who} />}
      {section === 'someday' && <Someday coupleId={coupleId} me={me} who={who} />}
      {section === 'dates' && <Dates coupleId={coupleId} me={me} />}
      {section === 'repair' && <RepairRoom coupleId={coupleId} me={me} partnerName={partnerName} />}
    </Page>
  );
}

function Composer({
  placeholder,
  onSubmit,
  onTyping,
  onMore,
}: {
  placeholder: string;
  onSubmit: (t: string) => Promise<unknown> | void;
  onTyping?: (on: boolean) => void;
  onMore?: (t: string) => void;
}) {
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
    <View style={{ gap: 6 }}>
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
      {onMore && (
        <Text
          style={styles.more}
          onPress={() => {
            onMore(text.trim());
            setText('');
          }}
        >
          More options: date, time, repeat
        </Text>
      )}
    </View>
  );
}

/** Long-press menu shared by every list: optional extras, then delete. */
function ActionSheet({
  visible,
  title,
  onClose,
  onDelete,
  deleteLabel = 'Delete',
  children,
}: {
  visible: boolean;
  title: string;
  onClose: () => void;
  onDelete?: () => void;
  deleteLabel?: string;
  children?: React.ReactNode;
}) {
  const [confirm, setConfirm] = useState(false);
  return (
    <Sheet
      visible={visible}
      title={title}
      onClose={() => {
        setConfirm(false);
        onClose();
      }}
    >
      {children}
      {onDelete &&
        (confirm ? (
          <View style={{ gap: 8 }}>
            <Text style={ui.soft}>This can’t be undone, and it disappears from both phones.</Text>
            <Button
              title={`Yes, ${deleteLabel.toLowerCase()}`}
              kind="danger"
              onPress={() => {
                setConfirm(false);
                onDelete();
                onClose();
              }}
            />
            <Button title="Keep it" kind="ghost" onPress={() => setConfirm(false)} />
          </View>
        ) : (
          <Press onPress={() => setConfirm(true)} style={styles.deleteRow} accessibilityRole="button">
            <Trash2 size={18} color={C.danger} />
            <Text style={styles.deleteText}>{deleteLabel}</Text>
          </Press>
        ))}
    </Sheet>
  );
}

const REACTIONS = ['❤️', '😂', '👍', '🥺', '🔥'];

function Notes({ coupleId, me, partnerName, who }: { coupleId: string; me: string; partnerName: string; who: (id?: string | null) => string }) {
  const { notes, isPartnerTyping, setTyping, addNote, toggleReaction, removeNote } = useRealtimeNotes(coupleId, me);
  const [picked, setPicked] = useState<SharedNote | null>(null);
  const mine = picked?.reactions?.[me];
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
              <Press key={n.id} depth={0.985} haptic={false} delayLongPress={300} onLongPress={() => {
                Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
                setPicked(n);
              }}>
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
      {notes.length > 0 && <Text style={[ui.soft, { textAlign: 'center' }]}>Press and hold a note to react or delete it.</Text>}
      <ActionSheet
        visible={!!picked}
        title="React"
        onClose={() => setPicked(null)}
        onDelete={picked && picked.created_by === me ? () => removeNote(picked.id) : undefined}
        deleteLabel="Delete note"
      >
        <View style={styles.reactRow}>
          {REACTIONS.map((e) => (
            <Press
              key={e}
              onPress={() => {
                if (picked) toggleReaction(picked, e);
                setPicked(null);
              }}
              style={[styles.reactBtn, mine === e && styles.reactOn]}
              accessibilityRole="button"
              accessibilityLabel={`React ${e}`}
            >
              <Text style={styles.reactEmoji}>{e}</Text>
            </Press>
          ))}
        </View>
      </ActionSheet>
    </>
  );
}

const TIMES = [
  { key: '09:00', label: 'Morning · 9:00' },
  { key: '12:30', label: 'Lunch · 12:30' },
  { key: '18:00', label: 'Evening · 6 pm' },
  { key: '21:00', label: 'Night · 9 pm' },
] as const;
const REPEATS: readonly TodoRecurrence[] = ['once', 'weekly', 'monthly', 'yearly'];
const REPEAT_LABEL: Record<TodoRecurrence, string> = { once: 'Once', weekly: 'Every week', monthly: 'Every month', yearly: 'Every year' };

function Plans({ coupleId, me, who }: { coupleId: string; me: string; who: (id?: string | null) => string }) {
  const { todos, addTodo, toggleTodo, deleteTodo } = useTodos(coupleId, me);
  const [form, setForm] = useState<{ title: string } | null>(null);
  const [picked, setPicked] = useState<string | null>(null);
  const open = todos.filter((t) => !t.is_completed);
  const done = todos.filter((t) => t.is_completed);
  const pickedTodo = todos.find((t) => t.id === picked);
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
        onMore={(t) => setForm({ title: t })}
      />
      {open.length === 0 && done.length === 0 && <Empty title="Nothing planned" body="Plans remind both of you. Finished ones become stars." />}
      {open.length > 0 && (
        <Card>
          {open.map((t) => (
            <CheckRow
              key={t.id}
              title={t.title}
              sub={`${new Date(t.due_at).toLocaleString('en-GB', { day: 'numeric', month: 'short', hour: 'numeric', minute: '2-digit' })}${t.recurrence !== 'once' ? ` · ${REPEAT_LABEL[t.recurrence].toLowerCase()}` : ''}${t.notes ? ` · ${t.notes}` : ''}`}
              done={false}
              colour={who(t.created_by)}
              onToggle={() => toggleTodo(t.id, true)}
              onLongPress={() => setPicked(t.id)}
            />
          ))}
        </Card>
      )}
      {done.length > 0 && (
        <Card style={{ opacity: 0.75 }}>
          <Text style={styles.meta}>Done · {done.length}</Text>
          {done.slice(0, 12).map((t) => (
            <CheckRow key={t.id} title={t.title} done colour={who(t.created_by)} onToggle={() => toggleTodo(t.id, false)} onLongPress={() => setPicked(t.id)} />
          ))}
        </Card>
      )}
      {open.length + done.length > 0 && <Text style={[ui.soft, { textAlign: 'center' }]}>Press and hold a plan to delete it.</Text>}
      <PlanForm visible={!!form} initialTitle={form?.title ?? ''} onClose={() => setForm(null)} onSave={addTodo} />
      <ActionSheet visible={!!pickedTodo} title={pickedTodo?.title ?? ''} onClose={() => setPicked(null)} onDelete={() => picked && deleteTodo(picked)} deleteLabel="Delete plan" />
    </>
  );
}

function PlanForm({
  visible,
  initialTitle,
  onClose,
  onSave,
}: {
  visible: boolean;
  initialTitle: string;
  onClose: () => void;
  onSave: (input: { title: string; notes?: string; dueAt: Date; recurrence: TodoRecurrence }) => Promise<unknown>;
}) {
  const [title, setTitle] = useState(initialTitle);
  const [notes, setNotes] = useState('');
  const [date, setDate] = useState<string | null>(toLocalISODate(new Date()));
  const [time, setTime] = useState<(typeof TIMES)[number]['key']>('18:00');
  const [repeat, setRepeat] = useState<TodoRecurrence>('once');
  const [error, setError] = useState<string | null>(null);
  React.useEffect(() => {
    if (visible) {
      setTitle(initialTitle);
      setNotes('');
      setDate(toLocalISODate(new Date()));
      setRepeat('once');
      setError(null);
    }
  }, [visible, initialTitle]);
  const save = async () => {
    if (!title.trim() || !date) return setError('Give it a name and a date.');
    const due = parseLocalDate(date);
    const [h, m] = time.split(':').map(Number);
    due.setHours(h, m, 0, 0);
    if (repeat === 'once' && due.getTime() < Date.now()) return setError('That time has already passed today. Pick a later time or another day.');
    await onSave({ title: title.trim(), notes: notes.trim() || undefined, dueAt: due, recurrence: repeat });
    onClose();
  };
  return (
    <Sheet visible={visible} title="New plan" onClose={onClose}>
      <Field placeholder="What to do" value={title} onChangeText={setTitle} />
      <Field placeholder="Notes (optional)" value={notes} onChangeText={setNotes} multiline />
      <DateField label="Remind us on" value={date} onChange={setDate} />
      <Label>At</Label>
      <Choice options={TIMES.map((t) => t.key)} value={time} onChange={setTime} label={(k) => TIMES.find((t) => t.key === k)!.label} />
      <Label>Repeat</Label>
      <Choice options={REPEATS} value={repeat} onChange={setRepeat} label={(r) => REPEAT_LABEL[r]} />
      {error && <Text style={styles.error}>{error}</Text>}
      <Button title="Save plan" onPress={save} />
    </Sheet>
  );
}

function Someday({ coupleId, me, who }: { coupleId: string; me: string; who: (id?: string | null) => string }) {
  const { items, add, toggle, remove } = useBucket(coupleId, me);
  const [picked, setPicked] = useState<string | null>(null);
  const open = items.filter((i) => !i.is_completed);
  const done = items.filter((i) => i.is_completed);
  const pickedItem = items.find((i) => i.id === picked);
  return (
    <>
      <Composer placeholder="Somewhere to go, something to try" onSubmit={add} />
      {items.length === 0 && <Empty title="Your someday list is empty" body="Things you want to do together. Each one you do becomes a bright star." />}
      {open.length > 0 && (
        <Card>
          {open.map((i) => (
            <CheckRow
              key={i.id}
              title={i.title}
              sub={i.description ?? undefined}
              done={false}
              colour={who(i.created_by)}
              onToggle={() => {
                Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
                toggle(i);
              }}
              onLongPress={() => setPicked(i.id)}
            />
          ))}
        </Card>
      )}
      {done.length > 0 && (
        <Card>
          <Text style={styles.meta}>Done together · {done.length}</Text>
          {done.map((i) => (
            <CheckRow
              key={i.id}
              title={i.title}
              sub={i.completed_at ? new Date(i.completed_at).toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' }) : undefined}
              done
              colour={C.star}
              onToggle={() => toggle(i)}
              onLongPress={() => setPicked(i.id)}
            />
          ))}
        </Card>
      )}
      <ActionSheet visible={!!pickedItem} title={pickedItem?.title ?? ''} onClose={() => setPicked(null)} onDelete={() => picked && remove(picked)} deleteLabel="Remove from the list" />
    </>
  );
}

const EMOJI = ['💍', '💛', '🎂', '🌹', '✈️', '🏠', '✨'];
const M_REPEATS: readonly MilestoneRecurrence[] = ['yearly', 'monthly', 'once'];
const M_LABEL: Record<MilestoneRecurrence, string> = { yearly: 'Every year', monthly: 'Every month', once: 'Just once' };

function Dates({ coupleId, me }: { coupleId: string; me: string }) {
  const { milestones, addMilestone, deleteMilestone } = useMilestones(coupleId, me);
  const [adding, setAdding] = useState(false);
  const [picked, setPicked] = useState<string | null>(null);
  const [title, setTitle] = useState('');
  const [date, setDate] = useState<string | null>(null);
  const [emoji, setEmoji] = useState('💛');
  const [repeat, setRepeat] = useState<MilestoneRecurrence>('yearly');
  const [error, setError] = useState<string | null>(null);
  const list = useMemo(
    () => milestones.map((m) => ({ m, days: daysUntilNext(m, new Date()) })).sort((a, b) => (a.days ?? 1e9) - (b.days ?? 1e9)),
    [milestones]
  );
  const pickedM = milestones.find((m) => m.id === picked);
  const save = async () => {
    if (!title.trim() || !date) return setError('Give it a name and a date.');
    await addMilestone({ title: title.trim(), date, recurrence: repeat, emoji });
    setAdding(false);
    setTitle('');
    setDate(null);
    setError(null);
  };
  return (
    <>
      <Button title="Add a date" onPress={() => setAdding(true)} />
      {list.length === 0 ? (
        <Empty title="No dates yet" body="Anniversaries and firsts. You both get a reminder, and they become the brightest stars." />
      ) : (
        <Card>
          {list.map(({ m, days }) => (
            <Press key={m.id} depth={0.98} haptic={false} delayLongPress={300} onLongPress={() => setPicked(m.id)} style={styles.dateRow}>
              <Text style={styles.emoji}>{m.emoji || '✦'}</Text>
              <View style={{ flex: 1 }}>
                <Text style={ui.body}>{m.title}</Text>
                <Text style={ui.soft}>
                  {parseLocalDate(m.milestone_date).toLocaleDateString('en-GB', { day: 'numeric', month: 'long', year: 'numeric' })} · {M_LABEL[m.recurrence].toLowerCase()}
                </Text>
              </View>
              <Text style={styles.days}>{days === 0 ? 'Today' : days === null ? 'Past' : `${days}d`}</Text>
            </Press>
          ))}
        </Card>
      )}
      <Sheet visible={adding} title="New date" onClose={() => setAdding(false)}>
        <Field placeholder="What it is, like “First date”" value={title} onChangeText={setTitle} />
        <DateField label="The day" value={date} onChange={setDate} />
        <Label>Repeat</Label>
        <Choice options={M_REPEATS} value={repeat} onChange={setRepeat} label={(r) => M_LABEL[r]} />
        <Label>Emoji</Label>
        <Choice options={EMOJI} value={emoji} onChange={setEmoji} />
        {error && <Text style={styles.error}>{error}</Text>}
        <Button title="Save date" onPress={save} />
      </Sheet>
      <ActionSheet visible={!!pickedM} title={pickedM?.title ?? ''} onClose={() => setPicked(null)} onDelete={() => picked && deleteMilestone(picked)} deleteLabel="Delete date" />
    </>
  );
}

function CheckRow({
  title,
  sub,
  done,
  colour,
  onToggle,
  onLongPress,
}: {
  title: string;
  sub?: string;
  done: boolean;
  colour: string;
  onToggle: () => void;
  onLongPress?: () => void;
}) {
  return (
    <Press onPress={onToggle} onLongPress={onLongPress} delayLongPress={300} style={styles.check} accessibilityRole="checkbox" accessibilityState={{ checked: done }}>
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
  more: { fontFamily: F.semibold, fontSize: 13, color: C.star, paddingHorizontal: 4 },
  grid: { gap: 10 },
  meta: { fontFamily: F.semibold, fontSize: 12, color: C.inkSoft },
  react: { marginLeft: 'auto', fontSize: 14 },
  reactRow: { flexDirection: 'row', justifyContent: 'space-between' },
  reactBtn: { width: 56, height: 56, borderRadius: 28, alignItems: 'center', justifyContent: 'center', backgroundColor: 'rgba(255,255,255,0.06)' },
  reactOn: { backgroundColor: C.meSoft, borderWidth: 1, borderColor: C.me },
  reactEmoji: { fontSize: 26 },
  deleteRow: { flexDirection: 'row', alignItems: 'center', gap: 10, paddingVertical: 12 },
  deleteText: { fontFamily: F.semibold, fontSize: 15, color: C.danger },
  error: { fontFamily: F.medium, fontSize: 13.5, color: C.danger },
  check: { flexDirection: 'row', alignItems: 'center', gap: 12, paddingVertical: 4 },
  box: { width: 24, height: 24, borderRadius: 8, borderWidth: 1.5, alignItems: 'center', justifyContent: 'center' },
  dateRow: { flexDirection: 'row', alignItems: 'center', gap: 12, paddingVertical: 4, borderRadius: R.sm },
  emoji: { fontSize: 22, width: 30, textAlign: 'center', color: C.star },
  days: { fontFamily: F.display, fontSize: 16, color: C.star, fontVariant: ['tabular-nums'] },
});
