import React, { useState } from 'react';
import { KeyboardAvoidingView, ScrollView, StyleSheet, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { supabase } from '../../services/supabase';
import { Button, Card, Field } from '../components/ui';
import { C, F } from '../theme';

type Step = 'email' | 'verify' | 'password' | 'done';

/**
 * Forgot password, without needing the email's link to open the app.
 *
 * Supabase sends its standard reset email. Its link carries a one-time token,
 * and verifyOtp({ token_hash, type: 'recovery' }) accepts that token directly,
 * so you copy the link from the email and paste it here instead of tapping it.
 * If the project's email template is ever changed to include {{ .Token }}, the
 * same box takes the six-digit code too.
 *
 * Verifying signs you in with a recovery session; the new password is then
 * set with updateUser. The parent keeps this screen up until that's done, even
 * though a session now exists.
 */
export function ResetScreen({ initialEmail, onDone, onCancel }: { initialEmail: string; onDone: () => void; onCancel: () => void }) {
  const insets = useSafeAreaInsets();
  const [step, setStep] = useState<Step>('email');
  const [email, setEmail] = useState(initialEmail);
  const [proof, setProof] = useState('');
  const [password, setPassword] = useState('');
  const [again, setAgain] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const run = async (fn: () => Promise<void>) => {
    setBusy(true);
    setError(null);
    try {
      await fn();
    } catch (e: any) {
      setError(e?.message ?? 'Something went wrong. Try again.');
    } finally {
      setBusy(false);
    }
  };

  const send = () =>
    run(async () => {
      const addr = email.trim();
      if (!addr.includes('@')) throw new Error('Enter the email you signed up with.');
      const { error: err } = await supabase.auth.resetPasswordForEmail(addr);
      if (err) throw new Error(err.message);
      setStep('verify');
    });

  const verify = () =>
    run(async () => {
      const input = proof.trim();
      if (!input) throw new Error('Paste the link from the email.');
      let result;
      if (/^\d{6,10}$/.test(input)) {
        result = await supabase.auth.verifyOtp({ email: email.trim(), token: input, type: 'recovery' });
      } else {
        const m = input.match(/[?&#](?:token_hash|token)=([^&#\s]+)/);
        if (!m) throw new Error('That doesn’t look like the reset link. Long-press the link in the email, choose Copy link, and paste it here.');
        result = await supabase.auth.verifyOtp({ token_hash: decodeURIComponent(m[1]), type: 'recovery' });
      }
      if (result.error) {
        throw new Error(
          /expired|invalid/i.test(result.error.message)
            ? 'That link has expired or was already used. Send a new email and paste the newest link.'
            : result.error.message
        );
      }
      setStep('password');
    });

  const save = () =>
    run(async () => {
      if (password.length < 6) throw new Error('Use at least 6 characters.');
      if (password !== again) throw new Error('The two passwords don’t match.');
      const { error: err } = await supabase.auth.updateUser({ password });
      if (err) throw new Error(err.message);
      setStep('done');
    });

  return (
    <KeyboardAvoidingView style={styles.root} behavior="height">
      <ScrollView contentContainerStyle={[styles.body, { paddingTop: insets.top + 60, paddingBottom: insets.bottom + 32 }]} keyboardShouldPersistTaps="handled">
        <Text style={styles.title}>
          {step === 'done' ? 'You’re back in.' : step === 'password' ? 'Choose a new password' : 'Reset your password'}
        </Text>

        {step === 'email' && (
          <>
            <Text style={styles.sub}>We’ll email you a reset link. Your account, notes and partner stay exactly as they are.</Text>
            <Field placeholder="Email" value={email} onChangeText={setEmail} autoCapitalize="none" keyboardType="email-address" autoComplete="email" />
            <Button title={busy ? 'Sending…' : 'Send reset email'} onPress={send} disabled={busy} />
          </>
        )}

        {step === 'verify' && (
          <>
            <Text style={styles.sub}>
              If {email.trim()} has a NOVIA account, the email is on its way. It can take a minute and may land in spam. Nothing coming? Check it’s the exact address you signed up with.
            </Text>
            <Card>
              <Step n="1" text="Open the email on this phone." />
              <Step n="2" text="Don’t tap the link. Long-press it and choose Copy link." />
              <Step n="3" text="Come back here and paste it below." />
            </Card>
            <Field placeholder="Paste the reset link" value={proof} onChangeText={setProof} autoCapitalize="none" autoCorrect={false} multiline />
            <Button title={busy ? 'Checking…' : 'Continue'} onPress={verify} disabled={busy} />
            <Button title="Send the email again" kind="ghost" onPress={send} disabled={busy} />
          </>
        )}

        {step === 'password' && (
          <>
            <Text style={styles.sub}>This replaces your old password in the current NOVIA app too.</Text>
            <Field placeholder="New password" value={password} onChangeText={setPassword} secureTextEntry autoComplete="new-password" />
            <Field placeholder="New password again" value={again} onChangeText={setAgain} secureTextEntry autoComplete="new-password" />
            <Button title={busy ? 'Saving…' : 'Save password'} onPress={save} disabled={busy} />
          </>
        )}

        {step === 'done' && (
          <>
            <Text style={styles.sub}>Your new password is saved. Use it next time you sign in, here or in the current NOVIA app.</Text>
            <Button title="Open NOVIA Next" onPress={onDone} />
          </>
        )}

        {error && <Text style={styles.error}>{error}</Text>}

        {step !== 'done' && step !== 'password' && <Button title="Back to sign in" kind="ghost" onPress={onCancel} />}
      </ScrollView>
    </KeyboardAvoidingView>
  );
}

function Step({ n, text }: { n: string; text: string }) {
  return (
    <View style={styles.step}>
      <Text style={styles.stepN}>{n}</Text>
      <Text style={styles.stepText}>{text}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: C.night },
  body: { paddingHorizontal: 24, gap: 12 },
  title: { fontFamily: F.display, fontSize: 34, lineHeight: 38, color: C.ink, letterSpacing: -0.8, marginBottom: 4 },
  sub: { fontFamily: F.body, fontSize: 15, lineHeight: 22, color: C.inkSoft },
  step: { flexDirection: 'row', gap: 12, alignItems: 'flex-start' },
  stepN: { fontFamily: F.display, fontSize: 16, color: C.star, width: 16 },
  stepText: { flex: 1, fontFamily: F.body, fontSize: 14.5, lineHeight: 20, color: C.ink },
  error: { fontFamily: F.medium, fontSize: 14, lineHeight: 20, color: C.danger },
});
