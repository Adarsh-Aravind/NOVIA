import React, { useState } from 'react';
import { ScrollView, StyleSheet, Text } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Button, Card, Field, Label, ui } from '../components/ui';
import type { Profile } from '../../types';
import { C, F } from '../theme';

interface Props {
  profile: Profile | null;
  pairPartner: (key: string) => Promise<unknown>;
  signOut: () => void;
}

export function PairScreen({ profile, pairPartner, signOut }: Props) {
  const insets = useSafeAreaInsets();
  const [key, setKey] = useState('');
  return (
    <ScrollView style={styles.root} contentContainerStyle={{ paddingTop: insets.top + 60, paddingHorizontal: 22, gap: 14, paddingBottom: insets.bottom + 30 }}>
      <Text style={styles.title}>Find your other light</Text>
      <Text style={ui.soft}>Send your partner your sync key, or paste theirs. Anyone with your key can pair with you, so share it only with them.</Text>
      <Card>
        <Label>Your sync key</Label>
        <Text selectable style={styles.key}>{profile?.id ?? '…'}</Text>
      </Card>
      <Field placeholder="Paste your partner’s key" value={key} onChangeText={setKey} autoCapitalize="none" />
      <Button title="Pair" onPress={() => key.trim() && pairPartner(key.trim())} disabled={!key.trim()} />
      <Button title="Sign out" kind="ghost" onPress={signOut} />
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: C.night },
  title: { fontFamily: F.display, fontSize: 32, lineHeight: 36, color: C.ink, letterSpacing: -0.8 },
  key: { fontFamily: F.semibold, fontSize: 14, color: C.star },
});
