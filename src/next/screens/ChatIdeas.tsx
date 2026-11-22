import React, { useRef, useState } from 'react';
import { ActivityIndicator, StyleSheet, Text, View } from 'react-native';
import * as Haptics from 'expo-haptics';
import { Send, Sparkles, Plus, Check } from 'lucide-react-native';

import { Press } from '../components/Press';
import { Card, Field, Segments, Empty, ui } from '../components/ui';
import { chatWithAI, generateIdeas, ChatMessage } from '../../services/groq';
import { useRealtimeNotes } from '../../hooks/useRealtimeNotes';
import { C, F, R } from '../theme';

type Mode = 'ideas' | 'chat';

/** Turns a Groq error into something a person can act on. */
function explain(error: string): string {
  if (/rejected the API key|No Groq key/i.test(error)) {
    return 'Ideas and chat aren’t set up yet: this build has no working Groq key. Add a new key and rebuild, and this will work.';
  }
  return error;
}

/**
 * Ideas and the assistant, ported from the old app's Chat & Ideas.
 *
 * Ideas: describe what you're after ("a cheap date this weekend", "what to
 * say after an argument") and get a few specific suggestions; tap one to save
 * it as a note. Chat: ask anything. Only what you type is sent, never moods,
 * cycle data, steps or payments, and the last 20 messages are sent each turn.
 */
export function ChatIdeas({ coupleId, me }: { coupleId: string; me: string }) {
  const [mode, setMode] = useState<Mode>('ideas');
  return (
    <>
      <Segments
        value={mode}
        onChange={setMode}
        options={[
          { key: 'ideas', label: 'Get ideas' },
          { key: 'chat', label: 'Ask anything' },
        ]}
      />
      {mode === 'ideas' ? <Ideas coupleId={coupleId} me={me} /> : <Chat />}
    </>
  );
}

const PROMPTS = ['A cheap date this weekend', 'A small surprise for tonight', 'What to say after an argument', 'A gift under ₹1000'];

function Ideas({ coupleId, me }: { coupleId: string; me: string }) {
  const { addNote } = useRealtimeNotes(coupleId, me);
  const [ask, setAsk] = useState('');
  const [ideas, setIdeas] = useState<string[]>([]);
  const [saved, setSaved] = useState<Set<number>>(new Set());
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const run = async (prompt: string) => {
    const p = prompt.trim();
    if (!p || busy) return;
    setAsk(p);
    setBusy(true);
    setError(null);
    setSaved(new Set());
    const res = await generateIdeas(p);
    setBusy(false);
    if (res.error) setError(explain(res.error));
    setIdeas(res.ideas ?? []);
  };

  return (
    <>
      <View style={styles.row}>
        <Field placeholder="What are you looking for?" value={ask} onChangeText={setAsk} style={{ flex: 1 }} returnKeyType="go" onSubmitEditing={() => run(ask)} />
        <Press onPress={() => run(ask)} style={[styles.go, (!ask.trim() || busy) && { opacity: 0.4 }]} accessibilityRole="button" accessibilityLabel="Get ideas">
          {busy ? <ActivityIndicator color={C.night} /> : <Sparkles size={20} color={C.night} />}
        </Press>
      </View>
      {ideas.length === 0 && !busy && !error && (
        <View style={styles.prompts}>
          {PROMPTS.map((p) => (
            <Press key={p} onPress={() => run(p)} style={styles.prompt} accessibilityRole="button">
              <Text style={styles.promptText}>{p}</Text>
            </Press>
          ))}
        </View>
      )}
      {error && <Text style={styles.error}>{error}</Text>}
      {ideas.map((idea, i) => (
        <Card key={`${i}-${idea.slice(0, 12)}`}>
          <Text style={ui.body}>{idea}</Text>
          <Press
            onPress={async () => {
              if (saved.has(i)) return;
              Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
              await addNote(idea);
              setSaved(new Set(saved).add(i));
            }}
            style={styles.save}
            accessibilityRole="button"
          >
            {saved.has(i) ? <Check size={16} color={C.star} /> : <Plus size={16} color={C.star} />}
            <Text style={styles.saveText}>{saved.has(i) ? 'Saved to notes' : 'Save to notes'}</Text>
          </Press>
        </Card>
      ))}
    </>
  );
}

function Chat() {
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [draft, setDraft] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const live = useRef(true);
  React.useEffect(() => () => {
    live.current = false;
  }, []);

  const send = async () => {
    const text = draft.trim();
    if (!text || busy) return;
    const next = [...messages, { role: 'user' as const, content: text }];
    setMessages(next);
    setDraft('');
    setBusy(true);
    setError(null);
    const res = await chatWithAI(next.slice(-20));
    if (!live.current) return;
    setBusy(false);
    if (res.error) {
      setError(explain(res.error));
      return;
    }
    setMessages([...next, { role: 'assistant' as const, content: res.reply }]);
  };

  return (
    <>
      {messages.length === 0 && !error && <Empty title="Ask anything" body="Relationship questions, plans, or something else entirely. Only what you type here is sent." />}
      {messages.map((m, i) => (
        <View key={i} style={[styles.bubble, m.role === 'user' ? styles.mine : styles.theirs]}>
          <Text style={ui.body}>{m.content}</Text>
        </View>
      ))}
      {busy && <ActivityIndicator color={C.inkSoft} style={{ alignSelf: 'flex-start', marginLeft: 8 }} />}
      {error && <Text style={styles.error}>{error}</Text>}
      <View style={styles.row}>
        <Field placeholder="Message" value={draft} onChangeText={setDraft} style={{ flex: 1 }} multiline />
        <Press onPress={send} style={[styles.go, (!draft.trim() || busy) && { opacity: 0.4 }]} accessibilityRole="button" accessibilityLabel="Send">
          <Send size={18} color={C.night} />
        </Press>
      </View>
    </>
  );
}

const styles = StyleSheet.create({
  row: { flexDirection: 'row', gap: 8, alignItems: 'flex-end' },
  go: { width: 48, height: 48, borderRadius: 24, backgroundColor: C.star, alignItems: 'center', justifyContent: 'center' },
  prompts: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  prompt: { paddingHorizontal: 12, paddingVertical: 8, borderRadius: R.pill, borderWidth: 1, borderColor: C.line },
  promptText: { fontFamily: F.medium, fontSize: 13, color: C.inkSoft },
  save: { flexDirection: 'row', alignItems: 'center', gap: 6, alignSelf: 'flex-start', paddingVertical: 4 },
  saveText: { fontFamily: F.semibold, fontSize: 13, color: C.star },
  error: { fontFamily: F.medium, fontSize: 14, lineHeight: 20, color: C.danger },
  bubble: { padding: 12, borderRadius: R.md, maxWidth: '88%' },
  mine: { alignSelf: 'flex-end', backgroundColor: C.meSoft },
  theirs: { alignSelf: 'flex-start', backgroundColor: C.panel, borderWidth: 1, borderColor: C.line },
});
