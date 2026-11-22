import React, { useEffect, useState } from 'react';
import { StatusBar, StyleSheet, View } from 'react-native';
import { GestureHandlerRootView } from 'react-native-gesture-handler';
import Animated, { FadeIn } from 'react-native-reanimated';
import { SafeAreaProvider, useSafeAreaInsets } from 'react-native-safe-area-context';
import { useFonts } from 'expo-font';
import { BricolageGrotesque_500Medium } from '@expo-google-fonts/bricolage-grotesque/500Medium';
import { BricolageGrotesque_700Bold } from '@expo-google-fonts/bricolage-grotesque/700Bold';
import { Manrope_400Regular } from '@expo-google-fonts/manrope/400Regular';
import { Manrope_500Medium } from '@expo-google-fonts/manrope/500Medium';
import { Manrope_600SemiBold } from '@expo-google-fonts/manrope/600SemiBold';
import { Manrope_700Bold } from '@expo-google-fonts/manrope/700Bold';

import { useAuth } from '../hooks/useAuth';
import { C } from './theme';
import { Dock, TabKey } from './components/Dock';
import { SkyScreen } from './screens/SkyScreen';
import { UsScreen } from './screens/UsScreen';
import { CareScreen } from './screens/CareScreen';
import { YouScreen } from './screens/YouScreen';
import { AuthScreen } from './screens/AuthScreen';
import { PairScreen } from './screens/PairScreen';
import { ResetScreen } from './screens/ResetScreen';
import { Reminders } from './notify/Reminders';
import { configureNext } from './notify/notify';
import { useStreak } from './hooks/useStreak';
import { TogetherProvider } from './hooks/useTogether';
import { MoneyProvider } from './hooks/useMoney';
import { checkAndApplyUpdate } from '../services/updates';
import { clearWidgetState } from './widgets/state';

/**
 * NOVIA. The app's root: fonts, gesture handling, sign-in, pairing, and the
 * four places (Sky, Us, Care, You) in a floating dock.
 *
 * Over-the-air updates are checked on launch and applied straight away, as
 * the original app did (services/updates.ts); a JS-only change ships without
 * a reinstall.
 */
export default function NextApp() {
  const [fontsLoaded] = useFonts({
    BricolageGrotesque_500Medium,
    BricolageGrotesque_700Bold,
    Manrope_400Regular,
    Manrope_500Medium,
    Manrope_600SemiBold,
    Manrope_700Bold,
  });

  return (
    <GestureHandlerRootView style={styles.root}>
      <SafeAreaProvider>
        <StatusBar barStyle="light-content" translucent backgroundColor="transparent" />
        {fontsLoaded ? <Root /> : <View style={styles.root} />}
      </SafeAreaProvider>
    </GestureHandlerRootView>
  );
}

function Root() {
  const auth = useAuth();
  const insets = useSafeAreaInsets();
  const [tab, setTab] = useState<TabKey>('sky');
  // Held open while a password reset is in progress: verifying the reset link
  // creates a session, which would otherwise jump straight into the app before
  // the new password is chosen.
  const [resetting, setResetting] = useState<string | null>(null);
  // Bumped when the reminders switch changes, so the scheduler re-reads it.
  const [reminderVersion, setReminderVersion] = useState(0);
  const streak = useStreak(auth.coupleId, auth.profile?.id ?? null);

  // Channels and the notification permission, once per launch.
  useEffect(() => {
    if (auth.session) configureNext().catch(() => undefined);
  }, [auth.session]);

  // Signed out or unpaired: blank the home/lock-screen widgets, so they stop
  // showing your details and their nudge button stops working.
  useEffect(() => {
    if (!auth.loading && (!auth.session || !auth.coupleId)) clearWidgetState().catch(() => undefined);
  }, [auth.loading, auth.session, auth.coupleId]);

  // Pick up any over-the-air update on launch.
  useEffect(() => {
    checkAndApplyUpdate().catch(() => undefined);
  }, []);

  if (resetting !== null) {
    return <ResetScreen initialEmail={resetting} onDone={() => setResetting(null)} onCancel={() => setResetting(null)} />;
  }
  if (auth.loading && !auth.profile) return <View style={styles.root} />;
  if (!auth.session) return <AuthScreen signIn={auth.signIn} signUp={auth.signUp} onForgot={(email) => setResetting(email)} />;
  if (!auth.profile || !auth.coupleId) {
    return <PairScreen profile={auth.profile} signOut={auth.signOut} refetch={auth.refetchAuth} />;
  }

  const dockSpace = insets.bottom + 76;
  const common = { profile: auth.profile, partner: auth.partnerProfile, coupleId: auth.coupleId, bottomInset: dockSpace };

  return (
    <TogetherProvider coupleId={auth.coupleId} userId={auth.profile.id} partnerName={auth.partnerProfile?.display_name || 'Your partner'}>
    <MoneyProvider coupleId={auth.coupleId} partnerName={auth.partnerProfile?.display_name ?? null}>
    <View style={styles.root}>
      <Reminders
        coupleId={auth.coupleId}
        me={auth.profile.id}
        partnerName={auth.partnerProfile?.display_name || 'Your partner'}
        version={reminderVersion}
      />
      {/* Each place fades in over its first frames instead of popping in
          while it sets itself up. Fading only in (not out as well) keeps a
          single heavy screen on the GPU at a time. Reanimated drops the fade
          when the system's reduce-motion setting is on. */}
      <Animated.View key={tab} entering={FadeIn.duration(200)} style={styles.root}>
        {tab === 'sky' && <SkyScreen {...common} streak={streak} />}
        {tab === 'us' && <UsScreen {...common} />}
        {tab === 'care' && <CareScreen {...common} />}
        {tab === 'you' && (
          <YouScreen
            {...common}
            signOut={auth.signOut}
            onRemindersChanged={() => setReminderVersion((v) => v + 1)}
            updateDisplayName={auth.updateDisplayName}
            updateAvatar={auth.updateAvatar}
            unpairPartner={auth.unpairPartner}
          />
        )}
      </Animated.View>
      <Dock tab={tab} onChange={setTab} bottom={insets.bottom} />
    </View>
    </MoneyProvider>
    </TogetherProvider>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: C.night },
});
