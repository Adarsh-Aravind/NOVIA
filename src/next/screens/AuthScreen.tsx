import React, { useState } from 'react';
import { KeyboardAvoidingView, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Button, Field } from '../components/ui';
import { C, F } from '../theme';

interface Props {
  signIn: (email: string, password: string) => Promise<unknown>;
  signUp: (email: string, password: string, name: string) => Promise<unknown>;
  onForgot: (email: string) => void;
}

export function AuthScreen({ signIn, signUp, onForgot }: Props) {
  const insets = useSafeAreaInsets();
  const [mode, setMode] = useState<'in' | 'up'>('in');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [name, setName] = useState('');
  const [busy, setBusy] = useState(false);

  const submit = async () => {
    if (!email.trim() || !password) return;
    setBusy(true);
    try {
      if (mode === 'in') await signIn(email.trim(), password);
      else await signUp(email.trim(), password, name.trim());
    } finally {
      setBusy(false);
    }
  };

  return (
    <KeyboardAvoidingView style={styles.root} behavior="height">
      <ScrollView contentContainerStyle={[styles.body, { paddingTop: insets.top + 80, paddingBottom: insets.bottom + 32 }]} keyboardShouldPersistTaps="handled">
        <View style={styles.lights}>
          <View style={[styles.light, { backgroundColor: C.me, shadowColor: C.me }]} />
          <View style={[styles.light, styles.lightB, { backgroundColor: C.partner, shadowColor: C.partner }]} />
        </View>
        <Text style={styles.title}>Two lights,{'\n'}one sky.</Text>
        <Text style={styles.sub}>Sign in with your NOVIA account. Your notes, plans and dates come with you.</Text>
        <View style={styles.form}>
          {mode === 'up' && <Field placeholder="Your name" value={name} onChangeText={setName} autoCapitalize="words" />}
          <Field placeholder="Email" value={email} onChangeText={setEmail} autoCapitalize="none" keyboardType="email-address" autoComplete="email" />
          <Field placeholder="Password" value={password} onChangeText={setPassword} secureTextEntry autoComplete="password" />
          <Button title={busy ? 'One moment…' : mode === 'in' ? 'Sign in' : 'Create account'} onPress={submit} disabled={busy} />
          {mode === 'in' && (
            <Pressable onPress={() => onForgot(email.trim())} style={styles.forgot} accessibilityRole="button" hitSlop={8}>
              <Text style={styles.forgotText}>Forgot password?</Text>
            </Pressable>
          )}
          <Button
            title={mode === 'in' ? 'New here? Create an account' : 'Have an account? Sign in'}
            kind="ghost"
            onPress={() => setMode(mode === 'in' ? 'up' : 'in')}
          />
        </View>
      </ScrollView>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: C.night },
  body: { paddingHorizontal: 24, gap: 14 },
  lights: { height: 90, marginBottom: 8 },
  light: { position: 'absolute', width: 54, height: 54, borderRadius: 27, left: 4, top: 26, elevation: 18, shadowOpacity: 1, shadowRadius: 20 },
  lightB: { left: 56, top: 0, width: 46, height: 46 },
  title: { fontFamily: F.display, fontSize: 44, lineHeight: 46, color: C.ink, letterSpacing: -1.2 },
  sub: { fontFamily: F.body, fontSize: 15, lineHeight: 22, color: C.inkSoft, maxWidth: 320 },
  form: { gap: 10, marginTop: 18 },
  forgot: { alignSelf: 'center', paddingVertical: 8 },
  forgotText: { fontFamily: F.semibold, fontSize: 14, color: C.star },
});
