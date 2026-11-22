import React, { useState } from 'react';
import { StyleSheet, Text, View } from 'react-native';
import { Page, Card, Label, Button, ui } from '../components/ui';
import { Recap } from '../recap/Recap';
import { monthStart, useRecap } from '../recap/useRecap';
import type { Profile } from '../../types';
import { C, F } from '../theme';

interface Props {
  profile: Profile;
  partner: Profile | null;
  coupleId: string;
  bottomInset: number;
  signOut: () => void;
}

// What the current app has that this preview does not show yet. Said plainly,
// so nobody wonders where a feature went.
const STILL_IN_NOVIA = ['Detected payments', 'Chat & ideas (assistant)', 'Period logging and hospital visits', 'Word of the day'];

export function YouScreen({ profile, partner, coupleId, bottomInset, signOut }: Props) {
  const [month, setMonth] = useState<Date | null>(null);
  const recap = useRecap(coupleId, profile.id, month);
  const now = new Date();
  const last = monthStart(now, -1);
  const label = (d: Date) => d.toLocaleDateString('en-GB', { month: 'long' });

  return (
    <Page kicker="NOVIA Next · preview" title="You" bottomInset={bottomInset}>
      <Card>
        <Label>Your month in stars</Label>
        <Text style={ui.soft}>A short story of your month together: the walk-off, your best day, what you made.</Text>
        <View style={styles.row}>
          <View style={{ flex: 1 }}>
            <Button title={label(last)} onPress={() => setMonth(last)} />
          </View>
          <View style={{ flex: 1 }}>
            <Button title={`${label(now)} so far`} kind="ghost" onPress={() => setMonth(monthStart(now))} />
          </View>
        </View>
      </Card>
      {month && recap && (
        <Recap
          data={recap}
          myName={profile.display_name || 'You'}
          partnerName={partner?.display_name || 'Your partner'}
          onClose={() => setMonth(null)}
        />
      )}
      <Card>
        <View style={styles.pair}>
          <View style={[styles.light, { backgroundColor: C.me }]} />
          <View style={{ flex: 1 }}>
            <Text style={ui.h2}>{profile.display_name || 'You'}</Text>
            <Text style={ui.soft}>Ember. Your light.</Text>
          </View>
        </View>
        <View style={styles.pair}>
          <View style={[styles.light, { backgroundColor: C.partner }]} />
          <View style={{ flex: 1 }}>
            <Text style={ui.h2}>{partner?.display_name || 'Not paired'}</Text>
            <Text style={ui.soft}>Moonlight. Their light.</Text>
          </View>
        </View>
      </Card>

      <Card>
        <Label>Still in the current NOVIA app</Label>
        {STILL_IN_NOVIA.map((f) => (
          <Text key={f} style={ui.body}>· {f}</Text>
        ))}
        <Text style={ui.soft}>This preview shares the same account and data, so anything you do here shows up there too.</Text>
      </Card>

      <Button title="Sign out of NOVIA Next" kind="ghost" onPress={signOut} />
      <Text style={[styles.foot]}>Signing out here does not sign you out of the current app.</Text>
    </Page>
  );
}

const styles = StyleSheet.create({
  pair: { flexDirection: 'row', alignItems: 'center', gap: 14 },
  row: { flexDirection: 'row', gap: 10 },
  light: { width: 28, height: 28, borderRadius: 14 },
  foot: { fontFamily: F.body, fontSize: 12, color: C.inkFaint, textAlign: 'center' },
});
