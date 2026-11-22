import React, { useCallback, useEffect, useState } from 'react';
import { ScrollView, StyleSheet, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import * as Haptics from 'expo-haptics';
import { Button, Card, Field, Label, ui } from '../components/ui';
import { supabase } from '../../services/supabase';
import type { Profile } from '../../types';
import { C, F } from '../theme';

interface Props {
  profile: Profile | null;
  signOut: () => void;
  /** Re-reads the profile; called once a pairing has happened. */
  refetch: () => void;
}

interface Incoming {
  id: string;
  from_user: string;
  display_name: string;
  created_at: string;
}

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

/**
 * Pairing, with consent. You send your partner a request using their sync
 * key; they see it here (with your name) and accept or decline. If they had
 * already asked you, sending yours pairs you straight away. Nobody can pair
 * with you on their own any more (see 20261123_pair_consent_and_locations.sql).
 */
export function PairScreen({ profile, signOut, refetch }: Props) {
  const insets = useSafeAreaInsets();
  const [key, setKey] = useState('');
  const [incoming, setIncoming] = useState<Incoming[]>([]);
  const [outgoing, setOutgoing] = useState<{ to_user: string; created_at: string } | null>(null);
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    const [inc, out] = await Promise.all([supabase.rpc('incoming_pair_requests'), supabase.rpc('outgoing_pair_request')]);
    if (!inc.error) setIncoming((inc.data as Incoming[]) ?? []);
    if (!out.error) setOutgoing(((out.data as { to_user: string; created_at: string }[]) ?? [])[0] ?? null);
  }, []);

  // Check every few seconds, so an accepted request moves you into the app
  // without a restart.
  const refetchRef = React.useRef(refetch);
  refetchRef.current = refetch;
  useEffect(() => {
    load();
    const id = setInterval(() => {
      load();
      refetchRef.current();
    }, 5000);
    return () => clearInterval(id);
  }, [load]);

  const send = async () => {
    const k = key.trim();
    setError(null);
    setMessage(null);
    if (!UUID.test(k)) return setError('That doesn’t look like a sync key. It’s the long code shown on your partner’s screen.');
    setBusy(true);
    const { data, error: err } = await supabase.rpc('pair_with_partner', { partner_uuid: k });
    setBusy(false);
    if (err) return setError(err.message);
    if (data) {
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
      refetch();
      return;
    }
    setKey('');
    setMessage('Request sent. Ask your partner to open NOVIA; your request will be waiting for them to accept.');
    load();
  };

  const respond = async (r: Incoming, accept: boolean) => {
    setBusy(true);
    setError(null);
    const { error: err } = await supabase.rpc('respond_pair_request', { request: r.id, accept });
    setBusy(false);
    if (err) return setError(err.message);
    if (accept) {
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
      refetch();
    }
    load();
  };

  return (
    <ScrollView style={styles.root} contentContainerStyle={{ paddingTop: insets.top + 60, paddingHorizontal: 22, gap: 14, paddingBottom: insets.bottom + 30 }} keyboardShouldPersistTaps="handled">
      <Text style={styles.title}>Find your other light</Text>

      {incoming.map((r) => (
        <Card key={r.id} style={{ borderColor: C.partner }}>
          <Label>Request</Label>
          <Text style={ui.h2}>{r.display_name} wants to pair with you</Text>
          <Text style={ui.soft}>Accept only if you know this is your partner. You’ll share notes, plans, dates, moods, health records and payments.</Text>
          <View style={styles.row}>
            <View style={{ flex: 1 }}>
              <Button title="Accept" onPress={() => respond(r, true)} disabled={busy} />
            </View>
            <View style={{ flex: 1 }}>
              <Button title="Decline" kind="ghost" onPress={() => respond(r, false)} disabled={busy} />
            </View>
          </View>
        </Card>
      ))}

      <Card>
        <Label>Your sync key</Label>
        <Text selectable style={styles.key}>{profile?.id ?? '…'}</Text>
        <Text style={ui.soft}>Send this to your partner so they can ask to pair with you. You’ll get to accept it.</Text>
      </Card>

      {outgoing ? (
        <Card>
          <Label>Waiting</Label>
          <Text style={ui.body}>Your request is waiting for your partner to accept it.</Text>
          <Button
            title="Cancel request"
            kind="ghost"
            onPress={async () => {
              await supabase.rpc('cancel_pair_request');
              setMessage(null);
              load();
            }}
          />
        </Card>
      ) : (
        <>
          <Field placeholder="Paste your partner’s sync key" value={key} onChangeText={setKey} autoCapitalize="none" autoCorrect={false} />
          <Button title={busy ? 'Sending…' : 'Send pairing request'} onPress={send} disabled={!key.trim() || busy} />
        </>
      )}
      {message && <Text style={[ui.soft, { color: C.ink }]}>{message}</Text>}
      {error && <Text style={styles.error}>{error}</Text>}
      <Button title="Sign out" kind="ghost" onPress={signOut} />
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: C.night },
  title: { fontFamily: F.display, fontSize: 32, lineHeight: 36, color: C.ink, letterSpacing: -0.8 },
  key: { fontFamily: F.semibold, fontSize: 14, color: C.star },
  row: { flexDirection: 'row', gap: 10 },
  error: { fontFamily: F.medium, fontSize: 14, lineHeight: 20, color: C.danger },
});
