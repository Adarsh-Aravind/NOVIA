import React, { useEffect, useState } from 'react';
import { Image, StyleSheet, Switch, Text, View } from 'react-native';
import * as Haptics from 'expo-haptics';
import { Camera } from 'lucide-react-native';

import { Press } from '../components/Press';
import { Page, Card, Label, Button, Field, ui } from '../components/ui';
import { Sheet } from '../components/Sheet';
import { Recap } from '../recap/Recap';
import { Payments } from './Payments';
import { configureNext, remindersEnabled, setRemindersEnabled } from '../notify/notify';
import { monthStart, useRecap } from '../recap/useRecap';
import { pickProfilePhoto } from '../../services/profilePhoto';
import { fetchAppUpdates, getLastSeenUpdateAt, markUpdatesSeen, unseenUpdates } from '../../services/updates';
import { getWordOfDay } from '../../constants/vocabulary';
import type { AppUpdate, Profile } from '../../types';
import { C, F, R } from '../theme';

interface Props {
  profile: Profile;
  partner: Profile | null;
  coupleId: string;
  bottomInset: number;
  signOut: () => void;
  onRemindersChanged: () => void;
  updateDisplayName: (name: string) => Promise<unknown>;
  updateAvatar: (dataUri: string | null) => Promise<void>;
  unpairPartner: () => Promise<unknown>;
}

export function YouScreen({ profile, partner, coupleId, bottomInset, signOut, onRemindersChanged, updateDisplayName, updateAvatar, unpairPartner }: Props) {
  const [month, setMonth] = useState<Date | null>(null);
  const [reminders, setReminders] = useState(true);
  const [editingName, setEditingName] = useState<string | null>(null);
  const [photoMenu, setPhotoMenu] = useState(false);
  const [photoError, setPhotoError] = useState<string | null>(null);
  const [unpairing, setUnpairing] = useState(false);
  const [copied, setCopied] = useState(false);
  const [updates, setUpdates] = useState<AppUpdate[]>([]);
  const [newCount, setNewCount] = useState(0);
  const [showUpdates, setShowUpdates] = useState(false);
  const partnerName = partner?.display_name || 'Your partner';
  const word = getWordOfDay();

  useEffect(() => {
    remindersEnabled().then(setReminders);
    (async () => {
      const all = await fetchAppUpdates().catch(() => [] as AppUpdate[]);
      setUpdates(all);
      setNewCount(unseenUpdates(all, await getLastSeenUpdateAt()).length);
    })();
  }, []);

  const toggleReminders = async (on: boolean) => {
    setReminders(on);
    if (on) await configureNext();
    await setRemindersEnabled(on);
    onRemindersChanged();
  };

  const changePhoto = async () => {
    setPhotoMenu(false);
    setPhotoError(null);
    const r = await pickProfilePhoto();
    if (r.cancelled) return;
    if (r.error || !r.dataUri) return setPhotoError(r.error ?? 'Couldn’t use that photo.');
    try {
      await updateAvatar(r.dataUri);
    } catch (e: any) {
      setPhotoError(e?.message ?? 'Couldn’t save the photo.');
    }
  };

  const recap = useRecap(coupleId, profile.id, month);
  const now = new Date();
  const last = monthStart(now, -1);
  const label = (d: Date) => d.toLocaleDateString('en-GB', { month: 'long' });

  return (
    <Page kicker="NOVIA" title="You" bottomInset={bottomInset}>
      {/* Profile */}
      <Card>
        <View style={styles.profile}>
          <Press onPress={() => setPhotoMenu(true)} style={styles.avatarWrap} accessibilityRole="button" accessibilityLabel="Change profile photo">
            {profile.avatar_url ? (
              <Image source={{ uri: profile.avatar_url }} style={styles.avatar} />
            ) : (
              <View style={[styles.avatar, styles.avatarEmpty]}>
                <Text style={styles.initial}>{(profile.display_name || 'Y').charAt(0).toUpperCase()}</Text>
              </View>
            )}
            <View style={styles.cam}>
              <Camera size={13} color={C.night} />
            </View>
          </Press>
          <View style={{ flex: 1, gap: 2 }}>
            <Press onPress={() => setEditingName(profile.display_name || '')} depth={0.98} accessibilityRole="button" accessibilityLabel="Edit your name">
              <Text style={styles.name}>{profile.display_name || 'Add your name'}</Text>
            </Press>
            <Text style={ui.soft}>
              Ember · paired with <Text style={{ color: C.partner }}>{partnerName}</Text>
            </Text>
          </View>
        </View>
        {photoError && <Text style={styles.error}>{photoError}</Text>}
      </Card>

      {/* Word of the day */}
      <Card>
        <Label>Word of the day</Label>
        <Text style={styles.word}>{word.word}</Text>
        <Text style={ui.body}>{word.meaning}</Text>
        {word.example ? <Text style={[ui.soft, { fontStyle: 'italic' }]}>“{word.example}”</Text> : null}
      </Card>

      <Payments me={profile.id} partnerName={partnerName} />

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
      {month && recap && <Recap data={recap} myName={profile.display_name || 'You'} partnerName={partnerName} onClose={() => setMonth(null)} />}

      <Card>
        <View style={styles.row}>
          <View style={{ flex: 1, gap: 4 }}>
            <Text style={ui.h2}>Reminders</Text>
            <Text style={ui.soft}>Plans, dates, the cycle heads-up and the word of the day, on both phones.</Text>
          </View>
          <Switch
            value={reminders}
            onValueChange={toggleReminders}
            trackColor={{ false: 'rgba(255,255,255,0.2)', true: C.me }}
            thumbColor={C.star}
            accessibilityLabel="Reminders"
          />
        </View>
        <Text style={ui.soft}>Nudges from {partnerName} always come through.</Text>
      </Card>

      {updates.length > 0 && (
        <Card>
          <Press
            onPress={async () => {
              setShowUpdates(!showUpdates);
              if (!showUpdates && updates[0]) {
                await markUpdatesSeen(updates[0].created_at);
                setNewCount(0);
              }
            }}
            depth={0.98}
            style={styles.row}
            accessibilityRole="button"
          >
            <Text style={[ui.h2, { flex: 1 }]}>What’s new</Text>
            {newCount > 0 && (
              <View style={styles.badge}>
                <Text style={styles.badgeText}>{newCount}</Text>
              </View>
            )}
          </Press>
          {showUpdates &&
            updates.slice(0, 8).map((u) => (
              <View key={u.id} style={{ gap: 2 }}>
                <Text style={ui.body}>
                  {u.title} <Text style={ui.soft}>· {u.version}</Text>
                </Text>
                <Text style={ui.soft}>{u.body}</Text>
              </View>
            ))}
        </Card>
      )}

      <Card>
        <Label>Pairing</Label>
        <Text style={ui.soft}>Your sync key. Anyone with it can pair with you, so only share it with {partnerName}.</Text>
        <Press
          onPress={async () => {
            try {
              const Clipboard = require('expo-clipboard');
              await Clipboard.setStringAsync(profile.id);
              setCopied(true);
              Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
            } catch {
              setCopied(false);
            }
          }}
          depth={0.98}
          accessibilityRole="button"
        >
          <Text selectable style={styles.key}>{profile.id}</Text>
          <Text style={styles.link}>{copied ? 'Copied' : 'Press and hold the key to copy it'}</Text>
        </Press>
        <Button title={`Unpair from ${partnerName}`} kind="danger" onPress={() => setUnpairing(true)} />
      </Card>

      <Button title="Sign out" kind="ghost" onPress={signOut} />

      {/* Sheets */}
      <Sheet visible={editingName !== null} title="Your name" onClose={() => setEditingName(null)}>
        <Field value={editingName ?? ''} onChangeText={setEditingName} placeholder="What should NOVIA call you?" autoCapitalize="words" />
        <Button
          title="Save"
          onPress={async () => {
            const n = (editingName ?? '').trim();
            if (n) await updateDisplayName(n);
            setEditingName(null);
          }}
        />
      </Sheet>
      <Sheet visible={photoMenu} title="Profile photo" onClose={() => setPhotoMenu(false)}>
        <Button title="Choose a photo" onPress={changePhoto} />
        {profile.avatar_url && (
          <Button
            title="Remove photo"
            kind="danger"
            onPress={async () => {
              setPhotoMenu(false);
              await updateAvatar(null).catch(() => undefined);
            }}
          />
        )}
      </Sheet>
      <Sheet visible={unpairing} title={`Unpair from ${partnerName}?`} onClose={() => setUnpairing(false)}>
        <Text style={ui.body}>
          You’ll stop sharing notes, plans, dates, the sky and everything else with {partnerName}, on both phones. Pairing again needs one of your sync keys.
        </Text>
        <Button
          title="Yes, unpair"
          kind="danger"
          onPress={async () => {
            setUnpairing(false);
            await unpairPartner();
          }}
        />
        <Button title="Keep us paired" kind="ghost" onPress={() => setUnpairing(false)} />
      </Sheet>
    </Page>
  );
}

const styles = StyleSheet.create({
  profile: { flexDirection: 'row', alignItems: 'center', gap: 16 },
  avatarWrap: { width: 64, height: 64 },
  avatar: { width: 64, height: 64, borderRadius: 32, borderWidth: 2, borderColor: C.me },
  avatarEmpty: { backgroundColor: C.meSoft, alignItems: 'center', justifyContent: 'center' },
  initial: { fontFamily: F.display, fontSize: 26, color: C.me },
  cam: { position: 'absolute', right: -2, bottom: -2, width: 24, height: 24, borderRadius: 12, backgroundColor: C.star, alignItems: 'center', justifyContent: 'center' },
  name: { fontFamily: F.display, fontSize: 24, color: C.ink, letterSpacing: -0.4 },
  word: { fontFamily: F.display, fontSize: 28, color: C.star, letterSpacing: -0.5 },
  row: { flexDirection: 'row', gap: 12, alignItems: 'center' },
  badge: { minWidth: 22, height: 22, borderRadius: 11, paddingHorizontal: 6, backgroundColor: C.me, alignItems: 'center', justifyContent: 'center' },
  badgeText: { fontFamily: F.bold, fontSize: 12, color: C.night },
  key: { fontFamily: F.semibold, fontSize: 13.5, color: C.star },
  link: { fontFamily: F.medium, fontSize: 12.5, color: C.inkSoft, marginTop: 4 },
  error: { fontFamily: F.medium, fontSize: 13.5, color: C.danger },
});
