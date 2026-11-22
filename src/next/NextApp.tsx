import React, { useState } from 'react';
import { StatusBar, StyleSheet, View } from 'react-native';
import { GestureHandlerRootView } from 'react-native-gesture-handler';
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

/**
 * NOVIA Next. The redesign, booted by EXPO_PUBLIC_NEXT=1 (see index.ts).
 *
 * It reuses the current app's data hooks and backend unchanged and replaces
 * only what you see: a sky instead of a dashboard, four places instead of five
 * tabs and a side menu.
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

  if (resetting !== null) {
    return <ResetScreen initialEmail={resetting} onDone={() => setResetting(null)} onCancel={() => setResetting(null)} />;
  }
  if (auth.loading && !auth.profile) return <View style={styles.root} />;
  if (!auth.session) return <AuthScreen signIn={auth.signIn} signUp={auth.signUp} onForgot={(email) => setResetting(email)} />;
  if (!auth.profile || !auth.coupleId) {
    return <PairScreen profile={auth.profile} pairPartner={auth.pairPartner} signOut={auth.signOut} />;
  }

  const dockSpace = insets.bottom + 76;
  const common = { profile: auth.profile, partner: auth.partnerProfile, coupleId: auth.coupleId, bottomInset: dockSpace };

  return (
    <View style={styles.root}>
      {tab === 'sky' && <SkyScreen {...common} />}
      {tab === 'us' && <UsScreen {...common} />}
      {tab === 'care' && <CareScreen {...common} />}
      {tab === 'you' && <YouScreen {...common} signOut={auth.signOut} />}
      <Dock tab={tab} onChange={setTab} bottom={insets.bottom} />
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: C.night },
});
