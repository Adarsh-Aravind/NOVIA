import React, { useState, useEffect, useRef } from 'react';
import {
  StyleSheet,
  Text,
  View,
  TextInput,
  TouchableOpacity,
  ScrollView,
  SafeAreaView,
  StatusBar,
  ActivityIndicator,
  Platform,
  Alert,
  KeyboardAvoidingView,
  Animated,
  Easing,
  Modal,
  AppState,
  Dimensions,
  BackHandler
} from 'react-native';
import { Calendar } from 'react-native-calendars';
import Constants from 'expo-constants';
import * as Updates from 'expo-updates';
import { Menu, Settings as SettingsIcon, LogOut, X, Heart, Check, Square, CheckSquare, Home, FileText, Wallet, Activity, ListChecks, MessageSquareWarning, ChevronLeft, Send, BookOpen, Sparkles, ScrollText, CalendarHeart, Flame, Footprints, Trophy } from 'lucide-react-native';
import Svg, { Defs, LinearGradient as SvgLinearGradient, RadialGradient, Rect, Stop, Filter, FeTurbulence, FeColorMatrix, FeComposite } from 'react-native-svg';
import * as Notifications from 'expo-notifications';
import { TodoRecurrence, AppUpdate, Milestone, MilestoneRecurrence } from './src/types';
import { useAuth } from './src/hooks/useAuth';
import { useRealtimeNotes } from './src/hooks/useRealtimeNotes';
import { useMood } from './src/hooks/useMood';
import { useTodos } from './src/hooks/useTodos';
import { usePeriods } from './src/hooks/usePeriods';
import { useComplaints } from './src/hooks/useComplaints';
import { useMilestones } from './src/hooks/useMilestones';
import { useCheckIns } from './src/hooks/useCheckIns';
import { useSteps } from './src/hooks/useSteps';
import { Skeleton } from './src/components/common/Skeleton';
import { configureNotificationsAsync, PRIORITY_CHANNEL } from './src/services/notification';
import { cancelScheduledNotificationsByPrefix, scheduleSharedReminder, scheduleLocalNotification } from './src/services/notification';
import { supabase } from './src/services/supabase';
import { applyPendingUpdate, checkAndApplyUpdate, fetchAppUpdates, fetchUpdateInBackground, getLastSeenUpdateAt, markUpdatesSeen, unseenUpdates } from './src/services/updates';
import { claimNotification, getOrCreateBaseline, pruneNotifiedMarkers } from './src/services/notifyOnce';
import { withLock } from './src/utils/asyncLock';
import {
  isOverdue,
  isRecurring,
  nextDueDate,
  parseLocalDate,
  summarizeFinances,
  toLocalISODate,
} from './src/utils/financeMath';
import {
  daysUntilNext,
  elapsedAt,
  formatElapsed,
  nextOccurrence,
  occursOn,
} from './src/utils/milestoneMath';
import { FinanceItem } from './src/types';
import { getWordOfDay } from './src/constants/vocabulary';
import { useFonts } from 'expo-font';
import { Fraunces_600SemiBold } from '@expo-google-fonts/fraunces/600SemiBold';
import { Fraunces_700Bold } from '@expo-google-fonts/fraunces/700Bold';
import { Manrope_400Regular } from '@expo-google-fonts/manrope/400Regular';
import { Manrope_500Medium } from '@expo-google-fonts/manrope/500Medium';
import { Manrope_600SemiBold } from '@expo-google-fonts/manrope/600SemiBold';
import { Manrope_700Bold } from '@expo-google-fonts/manrope/700Bold';
import { Manrope_800ExtraBold } from '@expo-google-fonts/manrope/800ExtraBold';
import { FONTS, PALETTE, THEME } from './src/constants/theme';

// Quick emoji reactions available on each shared note.
const NOTE_REACTIONS = ['❤️', '😂', '👍', '🥺', '🔥'] as const;

// Daily check-in feelings, ordered brightest → lowest.
const CHECK_IN_FEELINGS: { emoji: string; label: string }[] = [
  { emoji: '😄', label: 'Great' },
  { emoji: '🙂', label: 'Good' },
  { emoji: '😐', label: 'Okay' },
  { emoji: '😔', label: 'Low' },
  { emoji: '😢', label: 'Rough' },
];

// Emoji palette offered when creating a milestone.
const MILESTONE_EMOJIS = ['💛', '💍', '🌹', '🎉', '✈️', '🏡', '🎂', '⭐'] as const;

const PHASE_COLORS = THEME.colors.phase;

function SpaceBackdrop() {
  return (
    <Svg pointerEvents="none" style={StyleSheet.absoluteFill} width="100%" height="100%" viewBox="0 0 390 844" preserveAspectRatio="xMidYMid slice">
      <Defs>
        {/* Warm lime/moss light falling from the top-right into deep forest */}
        <RadialGradient id="topRightGlow" cx="92%" cy="4%" r="115%" fx="92%" fy="4%">
          <Stop offset="0%" stopColor={PALETTE.lime} stopOpacity="0.42" />
          <Stop offset="26%" stopColor={PALETTE.moss} stopOpacity="0.30" />
          <Stop offset="60%" stopColor={PALETTE.forest} stopOpacity="0.16" />
          <Stop offset="100%" stopColor={PALETTE.forestDeep} stopOpacity="0" />
        </RadialGradient>

        {/* Cooler counter-light from the lower left, so the ground isn't flat */}
        <RadialGradient id="bottomLeftGlow" cx="4%" cy="88%" r="95%" fx="4%" fy="88%">
          <Stop offset="0%" stopColor={PALETTE.forest} stopOpacity="0.34" />
          <Stop offset="55%" stopColor={PALETTE.forest} stopOpacity="0.10" />
          <Stop offset="100%" stopColor={PALETTE.forestDeep} stopOpacity="0" />
        </RadialGradient>

        {/* Bottom fade so content sinks away behind the floating tab dock */}
        <SvgLinearGradient id="bottomFade" x1="0%" y1="100%" x2="0%" y2="0%">
          <Stop offset="0%" stopColor={PALETTE.forestDeep} stopOpacity="1.0" />
          <Stop offset="28%" stopColor={PALETTE.forestDeep} stopOpacity="1.0" />
          <Stop offset="38%" stopColor={PALETTE.forestDeep} stopOpacity="0.95" />
          <Stop offset="55%" stopColor={PALETTE.forestDeep} stopOpacity="0.40" />
          <Stop offset="80%" stopColor={PALETTE.forestDeep} stopOpacity="0" />
        </SvgLinearGradient>

        {/* High-fidelity SVG grain noise filter overlay */}
        <Filter id="noiseFilter">
          <FeTurbulence type="fractalNoise" baseFrequency="0.68" numOctaves="4" stitchTiles="stitch" result="noise" />
          <FeColorMatrix type="matrix" values="1 0 0 0 0  0 1 0 0 0  0 0 1 0 0  0 0 0 0.065 0" />
          <FeComposite operator="in" in2="SourceGraphic" />
        </Filter>
      </Defs>

      {/* Deep forest base layer */}
      <Rect width="390" height="844" fill={PALETTE.forestDeep} />

      {/* Key light and counter-light */}
      <Rect width="390" height="844" fill="url(#topRightGlow)" />
      <Rect width="390" height="844" fill="url(#bottomLeftGlow)" />

      {/* Bottom atmospheric fade covering the area below the pill taskbar */}
      <Rect width="390" height="844" fill="url(#bottomFade)" />

      {/* Tactical grain overlay blending the background with noise */}
      <Rect width="390" height="844" fill={PALETTE.cream} filter="url(#noiseFilter)" opacity="0.30" />
    </Svg>
  );
}

const AnimatedTouchable = Animated.createAnimatedComponent(TouchableOpacity);

/**
 * PressableScale — a touchable that gently springs inward on press.
 * Gives every interactive glass surface a soft, tactile neumorphic response.
 */
function PressableScale({
  children,
  onPress,
  onLongPress,
  style,
  scaleTo = 0.96,
  disabled = false,
  activeOpacity = 0.92,
  hitSlop,
}: {
  children: React.ReactNode;
  onPress?: () => void;
  onLongPress?: () => void;
  style?: any;
  scaleTo?: number;
  disabled?: boolean;
  activeOpacity?: number;
  hitSlop?: any;
}) {
  const scale = useRef(new Animated.Value(1)).current;
  const pressIn = () =>
    Animated.spring(scale, { toValue: scaleTo, useNativeDriver: true, speed: 50, bounciness: 0 }).start();
  const pressOut = () =>
    Animated.spring(scale, { toValue: 1, useNativeDriver: true, speed: 40, bounciness: 7 }).start();
  return (
    <AnimatedTouchable
      activeOpacity={activeOpacity}
      onPress={onPress}
      onLongPress={onLongPress}
      onPressIn={pressIn}
      onPressOut={pressOut}
      disabled={disabled}
      hitSlop={hitSlop}
      style={[style, { transform: [{ scale }] }]}
    >
      {children}
    </AnimatedTouchable>
  );
}

/**
 * Animation budget
 * ----------------
 * Every animation in this file drives ONLY `opacity` and `transform`, with
 * `useNativeDriver: true`. Those two properties can be handed to the platform's
 * animation system and run on the UI thread, so they keep ticking at 60fps even
 * while JS is busy with a Supabase round-trip or a re-render.
 *
 * Deliberately avoided, because they are the usual causes of jank:
 *   - animating width/height/margin/padding/top/left (layout properties cannot
 *     use the native driver; every frame round-trips through JS and re-runs
 *     Yoga layout)
 *   - animating backgroundColor/shadow (same problem, plus shadow re-rasterises)
 *   - Animated.Value listeners that call setState per frame (a full React
 *     render every 16ms)
 *
 * Looping animations also pause when their screen isn't mounted, so background
 * tabs cost nothing.
 */

/**
 * FadeInUp — a staggered entrance for list and card content.
 *
 * `index` offsets the start so items cascade instead of appearing as one block.
 * The stagger is capped: past ~8 items the delay stops growing, otherwise the
 * last card in a long ledger would sit blank for over a second.
 */
const FadeInUp = React.memo(function FadeInUp({
  children,
  index = 0,
  distance = 16,
  style,
}: {
  children: React.ReactNode;
  index?: number;
  distance?: number;
  style?: any;
}) {
  const anim = useRef(new Animated.Value(0)).current;
  useEffect(() => {
    const animation = Animated.timing(anim, {
      toValue: 1,
      duration: 420,
      delay: Math.min(index, 8) * 55,
      easing: Easing.out(Easing.cubic),
      useNativeDriver: true,
    });
    animation.start();
    // Stop on unmount so a fast tab switch doesn't leave orphaned animations
    // writing to a detached view.
    return () => animation.stop();
  }, [anim, index]);

  return (
    <Animated.View
      style={[
        style,
        {
          opacity: anim,
          transform: [
            { translateY: anim.interpolate({ inputRange: [0, 1], outputRange: [distance, 0] }) },
          ],
        },
      ]}
    >
      {children}
    </Animated.View>
  );
});

/**
 * Breathing — an extremely slow opacity pulse.
 *
 * Used on the ambient backdrop glow to keep the screen feeling alive. One
 * native-driven opacity loop costs essentially nothing; the same effect via a
 * colour or size animation would not.
 */
function Breathing({
  children,
  from = 0.55,
  to = 1,
  duration = 4200,
  style,
}: {
  children: React.ReactNode;
  from?: number;
  to?: number;
  duration?: number;
  style?: any;
}) {
  const anim = useRef(new Animated.Value(0)).current;
  useEffect(() => {
    const loop = Animated.loop(
      Animated.sequence([
        Animated.timing(anim, { toValue: 1, duration, easing: Easing.inOut(Easing.sin), useNativeDriver: true }),
        Animated.timing(anim, { toValue: 0, duration, easing: Easing.inOut(Easing.sin), useNativeDriver: true }),
      ])
    );
    loop.start();
    return () => loop.stop();
  }, [anim, duration]);

  return (
    <Animated.View
      style={[style, { opacity: anim.interpolate({ inputRange: [0, 1], outputRange: [from, to] }) }]}
      pointerEvents="none"
    >
      {children}
    </Animated.View>
  );
}

/**
 * Shimmer — a slow highlight that sweeps across a glass surface.
 *
 * Self-measuring: drop it inside any container that sets `overflow: 'hidden'`
 * and it fills the parent, so no dimensions need threading through.
 *
 * Only translateX is animated, so the sweep runs on the UI thread. The long
 * trailing delay keeps it a periodic accent rather than a distraction — a
 * constantly-moving highlight reads cheap and burns battery for nothing.
 */
function Shimmer({ delay = 0, period = 5200 }: { delay?: number; period?: number }) {
  const anim = useRef(new Animated.Value(0)).current;
  const [size, setSize] = useState({ width: 0, height: 0 });

  useEffect(() => {
    if (size.width === 0) return;
    const loop = Animated.loop(
      Animated.sequence([
        Animated.delay(delay),
        Animated.timing(anim, {
          toValue: 1,
          duration: 1500,
          easing: Easing.inOut(Easing.quad),
          useNativeDriver: true,
        }),
        Animated.delay(period),
        // Snap back invisibly; resetting via setValue would need a JS frame.
        Animated.timing(anim, { toValue: 0, duration: 0, useNativeDriver: true }),
      ])
    );
    loop.start();
    return () => loop.stop();
  }, [anim, delay, period, size.width]);

  const band = Math.max(size.height * 1.6, 48);

  return (
    <View
      pointerEvents="none"
      style={StyleSheet.absoluteFill}
      onLayout={(e) => setSize({ width: e.nativeEvent.layout.width, height: e.nativeEvent.layout.height })}
    >
      {size.width > 0 && (
        <Animated.View
          style={{
            position: 'absolute',
            top: -size.height,
            bottom: -size.height,
            width: band,
            backgroundColor: 'rgba(237, 237, 244, 0.07)',
            transform: [
              {
                translateX: anim.interpolate({
                  inputRange: [0, 1],
                  outputRange: [-band, size.width + band],
                }),
              },
              { rotate: '14deg' },
            ],
          }}
        />
      )}
    </View>
  );
}

/**
 * AnimatedBar — a progress fill that grows from the left.
 *
 * The obvious implementation animates `width: '42%'`, but width is a layout
 * property: it can't use the native driver, so every frame crosses the bridge
 * and re-runs layout on the whole subtree. Instead the fill is laid out at full
 * width and squashed with `scaleX`.
 *
 * scaleX scales about the centre, which would make the bar grow from the middle
 * outward. Translating by (scale - 1) * width / 2 pins the left edge in place;
 * both values are interpolated from the same driver so they stay in lockstep.
 */
function AnimatedBar({
  progress,
  color,
  trackStyle,
}: {
  progress: number; // 0..1
  color: string;
  trackStyle?: any;
}) {
  const anim = useRef(new Animated.Value(0)).current;
  const [width, setWidth] = useState(0);
  const target = Math.max(0, Math.min(1, Number.isFinite(progress) ? progress : 0));

  useEffect(() => {
    if (width === 0) return; // wait for measurement, otherwise the maths is meaningless
    const animation = Animated.timing(anim, {
      toValue: 1,
      duration: 900,
      easing: Easing.out(Easing.cubic),
      useNativeDriver: true,
    });
    animation.start();
    return () => animation.stop();
  }, [anim, width, target]);

  return (
    <View
      style={[styles.progressBarBg, trackStyle]}
      onLayout={(e) => setWidth(e.nativeEvent.layout.width)}
    >
      {width > 0 && (
        <Animated.View
          style={[
            styles.progressBarFill,
            {
              width: '100%',
              backgroundColor: color,
              transform: [
                { translateX: anim.interpolate({ inputRange: [0, 1], outputRange: [-width / 2, ((target - 1) * width) / 2] }) },
                { scaleX: anim.interpolate({ inputRange: [0, 1], outputRange: [0, target] }) },
              ],
            },
          ]}
        />
      )}
    </View>
  );
}

/**
 * ScreenTransition — replays a soft fade + rise whenever its `key` changes.
 * Wrap tab content and key it on the active tab for seamless screen swaps.
 */
function ScreenTransition({ children }: { children: React.ReactNode }) {
  const anim = useRef(new Animated.Value(0)).current;
  useEffect(() => {
    anim.setValue(0);
    Animated.timing(anim, {
      toValue: 1,
      duration: 440,
      easing: Easing.out(Easing.cubic),
      useNativeDriver: true,
    }).start();
  }, []);
  return (
    <Animated.View
      style={{
        opacity: anim,
        transform: [
          { translateY: anim.interpolate({ inputRange: [0, 1], outputRange: [18, 0] }) },
          { scale: anim.interpolate({ inputRange: [0, 1], outputRange: [0.985, 1] }) },
        ],
      }}
    >
      {children}
    </Animated.View>
  );
}

/**
 * How far the floating tab bar sits above the very bottom of the screen.
 *
 * On Android with edge-to-edge the app window spans behind the system nav, so we
 * estimate the nav-bar height from the gap between the physical screen and the
 * app window (works for 3-button navigation); gesture-nav phones report ~0 and
 * get a small fixed gap. This keeps the dock clear of the nav area on a Vivo
 * 3-button setup while sitting low on the S23's gesture bar — without pulling in
 * react-native-safe-area-context (a native module that would force a rebuild and
 * break OTA). iOS's home indicator is handled by the SafeAreaView wrapper.
 */
const ANDROID_NAV_INSET =
  Platform.OS === 'android'
    ? Math.max(
        0,
        Math.round(
          Dimensions.get('screen').height -
            Dimensions.get('window').height -
            (StatusBar.currentHeight || 0)
        )
      )
    : 0;
const TAB_BAR_BOTTOM = Platform.OS === 'android' ? Math.max(ANDROID_NAV_INSET + 6, 22) : 24;

/**
 * AnimatedTabBar — frosted glass pill dock with a sliding accent indicator
 * that glides between tabs, plus per-item press springs.
 */
const TAB_ICONS: Record<string, React.ComponentType<{ size?: number; color?: string; strokeWidth?: number }>> = {
  hub: Home,
  notes: FileText,
  finances: Wallet,
  health: Activity,
};

// Hub sub-screens reachable from Hub cards (not on the tab bar). The device
// back button and their on-screen back rows both return from these to the Hub.
const HUB_SUBSCREENS = ['todos', 'milestones', 'complaints', 'bucket'];

function AnimatedTabBar<T extends string>({
  tabs,
  activeTab,
  onChange,
}: {
  tabs: readonly T[];
  activeTab: T;
  onChange: (t: T) => void;
}) {
  const INNER_PAD = 6;
  const [barW, setBarW] = useState(0);
  // activeTab may be a Hub sub-screen (todos/complaints/bucket/location) that
  // isn't on the bar — indexOf is -1 then, so we hide the sliding indicator.
  const activeIndex = tabs.indexOf(activeTab);
  const onBar = activeIndex >= 0;
  const indicator = useRef(new Animated.Value(onBar ? activeIndex : 0)).current;
  const slotW = barW > 0 ? (barW - INNER_PAD * 2) / tabs.length : 0;

  useEffect(() => {
    if (!onBar) return;
    Animated.spring(indicator, {
      toValue: activeIndex,
      useNativeDriver: true,
      speed: 18,
      bounciness: 9,
    }).start();
  }, [activeIndex, onBar]);

  const translateX = indicator.interpolate({
    inputRange: tabs.map((_, i) => i),
    outputRange: tabs.map((_, i) => INNER_PAD + i * slotW),
  });

  return (
    <View style={[styles.tabBar, { bottom: TAB_BAR_BOTTOM }]} onLayout={(e) => setBarW(e.nativeEvent.layout.width)}>
      {slotW > 0 && onBar && (
        <Animated.View
          pointerEvents="none"
          style={[
            styles.tabIndicator,
            { width: slotW, transform: [{ translateX }] },
          ]}
        />
      )}
      {tabs.map((tab) => {
        const isActive = activeTab === tab;
        const Icon = TAB_ICONS[tab] || Home;
        return (
          <PressableScale
            key={tab}
            scaleTo={0.9}
            style={styles.tabItem}
            onPress={() => onChange(tab)}
          >
            <Icon
              size={24}
              color={isActive ? '#0E9594' : 'rgba(237, 237, 244,0.55)'}
              strokeWidth={isActive ? 2.5 : 2}
            />
          </PressableScale>
        );
      })}
    </View>
  );
}

const BlinkingBucketRow = ({ item, getCreatorName, onToggle, onDelete }: { item: any; getCreatorName: (creatorId?: string | null) => string; onToggle: () => void; onDelete: () => void }) => {
  const blinkAnim = React.useRef(new Animated.Value(1)).current;

  const handlePress = () => {
    Animated.sequence([
      Animated.timing(blinkAnim, { toValue: 0.15, duration: 120, useNativeDriver: true }),
      Animated.timing(blinkAnim, { toValue: 1, duration: 120, useNativeDriver: true }),
      Animated.timing(blinkAnim, { toValue: 0.15, duration: 120, useNativeDriver: true }),
      Animated.timing(blinkAnim, { toValue: 1, duration: 120, useNativeDriver: true }),
      Animated.timing(blinkAnim, { toValue: 0.15, duration: 120, useNativeDriver: true }),
      Animated.timing(blinkAnim, { toValue: 1, duration: 120, useNativeDriver: true }),
    ]).start(() => {
      onToggle();
    });
  };

  return (
    <Animated.View style={{ opacity: blinkAnim }}>
      <TouchableOpacity 
        style={[
          styles.bucketRow,
        ]}
        onPress={handlePress}
        activeOpacity={0.7}
      >
        <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' }}>
          <View style={{ flexDirection: 'row', alignItems: 'center', flex: 1, paddingRight: 8 }}>
            {item.is_completed ? (
              <CheckSquare size={18} color="#0E9594" strokeWidth={2} />
            ) : (
              <Square size={18} color="rgba(237, 237, 244,0.5)" strokeWidth={2} />
            )}
            <Text style={[styles.bucketText, item.is_completed && styles.strikethrough, { marginLeft: 8 }]}>
              {item.title}
            </Text>
          </View>
          <View style={{ flexDirection: 'row', alignItems: 'center' }}>
            <Text style={[styles.financeMeta, { fontSize: 10, opacity: 0.6, marginRight: 12 }]}>By {getCreatorName(item.created_by)}</Text>
            <TouchableOpacity 
              onPress={(e) => {
                e.stopPropagation();
                onDelete();
              }}
              style={{
                width: 26,
                height: 26,
                borderRadius: 13,
                backgroundColor: 'rgba(242, 71, 34, 0.16)',
                alignItems: 'center',
                justifyContent: 'center',
              }}
            >
              <X size={12} color="#F24722" strokeWidth={2.5} />
            </TouchableOpacity>
          </View>
        </View>
        {item.description ? (
          <Text style={[styles.bucketDescription, { opacity: 0.85, fontSize: 12, marginTop: 4 }]}>
            {item.description}
          </Text>
        ) : null}
      </TouchableOpacity>
    </Animated.View>
  );
};

export default function App() {
  const [activeTab, setActiveTab] = useState<'hub' | 'notes' | 'finances' | 'health' | 'bucket' | 'todos' | 'complaints' | 'milestones'>('hub');

  // Typefaces. Only the six weights the design actually uses are loaded — each
  // extra static face is ~95 KB of bundle for no visual gain.
  const [fontsLoaded, fontError] = useFonts({
    Fraunces_600SemiBold,
    Fraunces_700Bold,
    Manrope_400Regular,
    Manrope_500Medium,
    Manrope_600SemiBold,
    Manrope_700Bold,
    Manrope_800ExtraBold,
  });

  // Custom hooks
  const { 
    session, 
    loading: authLoading, 
    profile, 
    partnerProfile, 
    coupleId,
    signUp,
    signIn,
    signOut,
    pairPartner,
    updateDisplayName,
    unpairPartner
  } = useAuth();
  const userId = session?.user?.id || null;

  // Auth local state
  const [authEmail, setAuthEmail] = useState('');
  const [authPassword, setAuthPassword] = useState('');
  const [authDisplayName, setAuthDisplayName] = useState('');
  const [isSignUpMode, setIsSignUpMode] = useState(false);

  // Pairing local state
  const [partnerIdInput, setPartnerIdInput] = useState('');

  const handleAuthSubmit = async () => {
    if (!authEmail.trim() || !authPassword.trim()) {
      Alert.alert("Error", "Please fill in all fields.");
      return;
    }
    if (isSignUpMode) {
      if (!authDisplayName.trim()) {
        Alert.alert("Error", "Please enter a display name.");
        return;
      }
      await signUp(authEmail, authPassword, authDisplayName);
    } else {
      await signIn(authEmail, authPassword);
    }
  };

  const handlePairSubmit = async () => {
    if (!partnerIdInput.trim()) {
      Alert.alert("Error", "Please enter your partner's User ID.");
      return;
    }
    await pairPartner(partnerIdInput.trim());
  };

  const { notes, isPartnerTyping, addNote, removeNote, toggleReaction } = useRealtimeNotes(coupleId, userId);
  const { currentMood, partnerMood, partnerName, updateMood } = useMood(coupleId, userId);
  const { todos, addTodo, toggleTodo, deleteTodo } = useTodos(coupleId, userId);
  const { records, predictions, addPeriodLog, refreshPeriods } = usePeriods(coupleId);
  const {
    complaints,
    loading: complaintsLoading,
    addComplaint,
    addReply,
    setStatus: setComplaintStatus,
    deleteComplaint,
    repliesFor,
  } = useComplaints(coupleId, userId);
  const { milestones, addMilestone, deleteMilestone } = useMilestones(coupleId, userId);
  const {
    myToday: myCheckIn,
    partnerToday: partnerCheckIn,
    myStreak,
    partnerStreak,
    submitCheckIn,
  } = useCheckIns(coupleId, userId, partnerProfile?.id);
  const {
    mySteps,
    partnerSteps,
    status: stepsStatus,
    loading: stepsLoading,
    leader: stepLeader,
    partnerSynced: stepsPartnerSynced,
    season: stepSeason,
    streakHolder: stepStreakHolder,
    streakCount: stepStreakCount,
    forfeit: stepForfeit,
    setForfeit: setStepForfeit,
    requestAccess: requestStepAccess,
  } = useSteps(coupleId, userId, partnerProfile?.id);
  const [stakesModalOpen, setStakesModalOpen] = useState(false);
  const [stakesDraft, setStakesDraft] = useState('');
  const welcomeAnim = useRef(new Animated.Value(0)).current;
  const todosRef = useRef(todos);
  todosRef.current = todos;

  // Side drawer & settings states
  const [isDrawerOpen, setIsDrawerOpen] = useState(false);
  const [isSettingsVisible, setIsSettingsVisible] = useState(false);
  const [tempDisplayName, setTempDisplayName] = useState('');
  const drawerAnim = useRef(new Animated.Value(0)).current;

  // Sync temp display name with profile
  useEffect(() => {
    if (profile?.display_name) {
      setTempDisplayName(profile.display_name);
    }
  }, [profile]);

  const toggleDrawer = (open: boolean) => {
    if (open) {
      setIsDrawerOpen(true);
      Animated.timing(drawerAnim, {
        toValue: 1,
        duration: 250,
        useNativeDriver: true,
      }).start();
    } else {
      Animated.timing(drawerAnim, {
        toValue: 0,
        duration: 200,
        useNativeDriver: true,
      }).start(() => setIsDrawerOpen(false));
    }
  };

  const handleSaveDisplayName = async () => {
    if (!tempDisplayName.trim()) {
      Alert.alert("Name required", "Please enter a valid display name.");
      return;
    }
    try {
      await updateDisplayName(tempDisplayName.trim());
      Alert.alert("Success", "Display name updated successfully.");
    } catch (err: any) {
      Alert.alert("Error", err.message || "Failed to update display name.");
    }
  };

  const handleUnpairPress = () => {
    Alert.alert(
      "Unpair Partner?",
      "This will break the live synchronized channel. Are you sure you want to proceed?",
      [
        { text: "Cancel", style: "cancel" },
        { 
          text: "Unpair", 
          style: "destructive", 
          onPress: async () => {
            setIsSettingsVisible(false);
            await unpairPartner();
          } 
        }
      ]
    );
  };

  // Local feature states
  const [newNoteContent, setNewNoteContent] = useState('');
  
  // Finances
  const [financeItems, setFinanceItems] = useState<FinanceItem[]>([]);
  const [newItemName, setNewItemName] = useState('');
  const [newAmount, setNewAmount] = useState('');
  const [newType, setNewType] = useState<'subscription' | 'borrowing' | 'self_liability'>('borrowing');
  const [financeDueDate, setFinanceDueDate] = useState('');
  const [financeRenewalCycle, setFinanceRenewalCycle] = useState<'none' | 'monthly' | 'yearly'>('none');

  // Bucket list
  const [bucketList, setBucketList] = useState<any[]>([]);
  const [newBucketTitle, setNewBucketTitle] = useState('');
  const [newBucketDescription, setNewBucketDescription] = useState('');

  // Period inputs
  const [isEditingCycle, setIsEditingCycle] = useState(false);
  // Full cycle tracker (detailed prediction + editor) opens in a modal,
  // reachable from the compact Health-tab summary and the side drawer.
  const [isCycleModalVisible, setIsCycleModalVisible] = useState(false);
  // Dedicated changelog viewer (side drawer -> Changelog).
  const [isChangelogVisible, setIsChangelogVisible] = useState(false);
  const [periodStartDate, setPeriodStartDate] = useState('');
  const [periodEndDate, setPeriodEndDate] = useState('');

  // Tapping a NOVIA notification jumps to the relevant screen.
  useEffect(() => {
    const routeFromData = (data: any) => {
      if (!data) return;
      if (data.kind === 'todo') setActiveTab('todos');
      else if (data.kind === 'complaint') setActiveTab('complaints');
      else if (data.kind === 'cycle') { setActiveTab('health'); setIsCycleModalVisible(true); }
      else if (data.kind === 'milestone') setActiveTab('milestones');
      else if (data.kind === 'checkin') setActiveTab('hub');
      else if (data.kind === 'update') { setIsChangelogVisible(true); markUpdatesViewed(); }
    };
    const responseSubscription = Notifications.addNotificationResponseReceivedListener((response) => {
      routeFromData(response.notification.request.content.data);
    });
    return () => {
      responseSubscription.remove();
    };
  }, []);

  // Calendar states
  const [isCalendarVisible, setIsCalendarVisible] = useState(false);
  const [calendarTarget, setCalendarTarget] = useState<'periodStartDate' | 'periodEndDate' | 'hospitalDate' | 'financeDueDate' | 'todoDate' | 'milestoneDate' | null>(null);

  const openCalendarFor = (target: 'periodStartDate' | 'periodEndDate' | 'hospitalDate' | 'financeDueDate' | 'todoDate' | 'milestoneDate') => {
    setCalendarTarget(target);
    setIsCalendarVisible(true);
  };

  const handleDateSelect = (dateString: string) => {
    if (calendarTarget === 'periodStartDate') setPeriodStartDate(dateString);
    else if (calendarTarget === 'periodEndDate') setPeriodEndDate(dateString);
    else if (calendarTarget === 'hospitalDate') setHospitalDate(dateString);
    else if (calendarTarget === 'financeDueDate') setFinanceDueDate(dateString);
    else if (calendarTarget === 'todoDate') setTodoDate(dateString);
    else if (calendarTarget === 'milestoneDate') setMilestoneDate(dateString);
    setIsCalendarVisible(false);
    setCalendarTarget(null);
  };

  // GF Menstrual Prediction multi-choice questionnaire states
  const [gfBleeding, setGfBleeding] = useState<'none' | 'spotting' | 'light' | 'heavy'>('none');
  const [gfPhysical, setGfPhysical] = useState<'none' | 'cramps' | 'tender' | 'bloating' | 'energized'>('none');
  const [gfFluid, setGfFluid] = useState<'none' | 'dry' | 'sticky' | 'creamy' | 'eggwhite'>('none');
  const [gfEmotion, setGfEmotion] = useState<'calm' | 'irritable' | 'sad' | 'anxious' | 'happy'>('calm');
  const [gfEnergy, setGfEnergy] = useState<'low' | 'normal' | 'stressed' | 'high'>('normal');

  // Todo creator inputs
  const [newTodoTitle, setNewTodoTitle] = useState('');
  const [newTodoNotes, setNewTodoNotes] = useState('');
  const [todoHour, setTodoHour] = useState(9);
  const [todoMinute, setTodoMinute] = useState(0);
  const [todoDate, setTodoDate] = useState(''); // 'YYYY-MM-DD' first fire date
  const [todoRecurrence, setTodoRecurrence] = useState<TodoRecurrence>('once');

  const adjustTodoTime = (unit: 'hour' | 'minute', amount: number) => {
    if (unit === 'hour') {
      setTodoHour((current) => (current + amount + 24) % 24);
      return;
    }
    setTodoMinute((current) => (current + amount + 60) % 60);
  };

  // Milestone creator inputs
  const [newMilestoneTitle, setNewMilestoneTitle] = useState('');
  const [milestoneDate, setMilestoneDate] = useState(''); // 'YYYY-MM-DD'
  const [milestoneRecurrence, setMilestoneRecurrence] = useState<MilestoneRecurrence>('yearly');
  const [milestoneEmoji, setMilestoneEmoji] = useState<string>('💛');

  // Daily check-in inputs (Hub card). Pre-filled from any existing entry today.
  const [checkInFeeling, setCheckInFeeling] = useState<string>('');
  const [checkInGratitude, setCheckInGratitude] = useState<string>('');

  // Complaint Box inputs
  const [newComplaintTitle, setNewComplaintTitle] = useState('');
  const [newComplaintBody, setNewComplaintBody] = useState('');
  const [openComplaintId, setOpenComplaintId] = useState<string | null>(null);
  const [replyText, setReplyText] = useState('');

  // Android hardware / gesture back button. Walk the same "up" path the on-screen
  // back arrows do, so the device back button Just Works instead of exiting the
  // app. The open <Modal>s (calendar, cycle, changelog, settings) register their
  // own back handler and close via onRequestClose before this listener is
  // reached, so we only handle the drawer (a plain overlay) and screen
  // navigation here. Returning true swallows the press; returning false on the
  // Hub lets Android close the app as usual.
  useEffect(() => {
    if (Platform.OS !== 'android') return;
    const onBack = () => {
      if (isDrawerOpen) { toggleDrawer(false); return true; }
      if (activeTab === 'complaints' && openComplaintId) { setOpenComplaintId(null); return true; }
      if (HUB_SUBSCREENS.includes(activeTab)) { setActiveTab('hub'); return true; }
      if (activeTab !== 'hub') { setActiveTab('hub'); return true; }
      return false; // already on the Hub — let the OS close the app
    };
    const sub = BackHandler.addEventListener('hardwareBackPress', onBack);
    return () => sub.remove();
  }, [isDrawerOpen, activeTab, openComplaintId]);

  // Updates / changelog
  const [appUpdates, setAppUpdates] = useState<AppUpdate[]>([]);
  const [hasUnseenUpdate, setHasUnseenUpdate] = useState(false);

  // Medical Record Vault
  const [medLogs, setMedLogs] = useState<any[]>([]);
  const [openMedLog, setOpenMedLog] = useState<any | null>(null); // detail modal
  const [hospitalDate, setHospitalDate] = useState('');
  const [hospitalReason, setHospitalReason] = useState('');
  const [hospitalResults, setHospitalResults] = useState('');

  // Finance borrowing lender direction state
  const [financeLenderDirection, setFinanceLenderDirection] = useState<'me' | 'partner'>('me');

  // Configure notification permissions + channels upon login.
  useEffect(() => {
    if (session) {
      configureNotificationsAsync();
      // Housekeeping: drop dedup markers old enough that their rows can no
      // longer resurface, so the key set stays bounded.
      pruneNotifiedMarkers();
    }
  }, [session]);

  // Apply any OTA (EAS) JS update once on launch.
  useEffect(() => {
    checkAndApplyUpdate();
  }, []);

  // Roll the daily-vocabulary window forward whenever the app returns to the
  // foreground (the vocab scheduling effect keys off this tick).
  const [foregroundTick, setForegroundTick] = useState(0);
  useEffect(() => {
    const subscription = AppState.addEventListener('change', (nextAppState) => {
      if (nextAppState === 'active') setForegroundTick((t) => t + 1);
    });
    return () => subscription.remove();
  }, []);

  // Pull new OTA bundles on resume too, not just at cold start — otherwise an
  // update published while the app sits in the background isn't picked up until
  // the process is actually killed and relaunched.
  const [otaUpdateReady, setOtaUpdateReady] = useState(false);
  useEffect(() => {
    if (foregroundTick === 0) return; // launch is already covered by checkAndApplyUpdate
    fetchUpdateInBackground().then((ready) => {
      if (ready) setOtaUpdateReady(true);
    });
  }, [foregroundTick]);

  useEffect(() => {
    if (!session || !coupleId) return;

    welcomeAnim.setValue(0);
    Animated.timing(welcomeAnim, {
      toValue: 1,
      duration: 650,
      easing: Easing.out(Easing.cubic),
      useNativeDriver: true,
    }).start();
  }, [session, coupleId, welcomeAnim]);

  const getCreatorName = (creatorId?: string | null) => {
    if (!creatorId) return 'User';
    if (creatorId === profile?.id) return profile.display_name || 'You';
    if (creatorId === partnerProfile?.id) return partnerProfile.display_name || partnerName || 'Partner';
    return 'Partner';
  };

  const fetchSharedFinances = async () => {
    if (!coupleId) return;

    const { data, error } = await supabase
      .from('finances')
      .select('*')
      .eq('couple_id', coupleId)
      .order('due_date', { ascending: true });

    if (error) {
      console.error('[Finances] Fetch failed:', error);
      return;
    }

    setFinanceItems((data || []) as FinanceItem[]);
  };

  const fetchSharedBucketList = async () => {
    if (!coupleId) return;

    const { data, error } = await supabase
      .from('bucket_list')
      .select('*')
      .eq('couple_id', coupleId)
      .order('created_at', { ascending: false });

    if (error) {
      console.error('[Bucket] Fetch failed:', error);
      return;
    }

    setBucketList(data || []);
  };

  const fetchHospitalVisits = async () => {
    if (!profile) return;

    const profileIds = [profile.id, partnerProfile?.id].filter(Boolean);
    const { data, error } = await supabase
      .from('medical_vault')
      .select('*')
      .eq('metric_type', 'hospital_visit')
      .in('user_id', profileIds)
      .order('record_date', { ascending: false });

    if (error) {
      console.error('[Medical Vault] Fetch failed:', error);
      return;
    }

    setMedLogs(data || []);
  };

  useEffect(() => {
    if (!coupleId) return;

    fetchSharedFinances();
    fetchSharedBucketList();

    const financeChannel = supabase
      .channel(`finance-sync:${coupleId}`)
      .on('postgres_changes', { event: '*', schema: 'public', table: 'finances', filter: `couple_id=eq.${coupleId}` }, fetchSharedFinances)
      .subscribe();

    const bucketChannel = supabase
      .channel(`bucket-sync:${coupleId}`)
      .on('postgres_changes', { event: '*', schema: 'public', table: 'bucket_list', filter: `couple_id=eq.${coupleId}` }, fetchSharedBucketList)
      .subscribe();

    return () => {
      supabase.removeChannel(financeChannel);
      supabase.removeChannel(bucketChannel);
    };
  }, [coupleId]);

  useEffect(() => {
    fetchHospitalVisits();
  }, [coupleId, profile?.id, partnerProfile?.id]);

  useEffect(() => {
    const scheduleFinanceReminders = () => withLock(`finance:${coupleId}`, async () => {
      if (!coupleId) return;

      await cancelScheduledNotificationsByPrefix(`finance:${coupleId}:`);
      await Promise.all(
        financeItems
          .filter((item) => item.status !== 'paid')
          .map((item) => {
            const due = parseLocalDate(item.due_date);
            if (isNaN(due.getTime())) return null;
            const reminderDate = new Date(due);
            reminderDate.setDate(reminderDate.getDate() - 1);
            reminderDate.setHours(9, 0, 0, 0);

            return scheduleSharedReminder({
              reminderKey: `finance:${coupleId}:${item.id}`,
              title: 'NOVIA Finance Reminder',
              body: `${item.item_name} is due tomorrow. Amount: ₹${Number(item.amount).toFixed(2)}.`,
              date: reminderDate,
            });
          })
      );
    });

    scheduleFinanceReminders();
  }, [financeItems, coupleId]);

  useEffect(() => {
    const scheduleCycleReminder = () => withLock(`period:${coupleId}`, async () => {
      if (!coupleId || !predictions) return;

      await cancelScheduledNotificationsByPrefix(`period:${coupleId}:`);

      const now = Date.now();
      const periodStart = new Date(predictions.nextPeriodStart);
      periodStart.setHours(9, 0, 0, 0);

      // Preferred: a heads-up the morning before the predicted start.
      const dayBefore = new Date(periodStart);
      dayBefore.setDate(dayBefore.getDate() - 1);

      // Pick the soonest slot that is still in the future. If "the day before"
      // has already passed (e.g. tracking was set up close to the date), fall
      // back to the morning of the predicted start so a reminder still fires;
      // only skip entirely once the predicted start itself is in the past.
      const target =
        dayBefore.getTime() > now ? dayBefore :
        periodStart.getTime() > now ? periodStart :
        null;
      if (!target) return;

      const isDayBefore = target === dayBefore;
      await scheduleLocalNotification({
        title: 'NOVIA Cycle Reminder',
        body: isDayBefore
          ? "Her period is predicted to start tomorrow. A little extra care goes a long way — you've both got this reminder."
          : "Her period is predicted to start today. Be ready with warmth and comfort.",
        trigger: target as any,
        channelId: PRIORITY_CHANNEL,
        data: { kind: 'cycle', reminderKey: `period:${coupleId}:next` },
      });
    });

    scheduleCycleReminder();
  }, [predictions, coupleId]);

  // Schedule a local reminder for every open todo. Because todos are shared and
  // each device schedules from the same list, both partners get reminded.
  useEffect(() => {
    const syncTodoReminders = () => withLock(`todo:${coupleId}`, async () => {
      if (!coupleId) return;

      await cancelScheduledNotificationsByPrefix(`todo:${coupleId}:`);

      await Promise.all(
        todos
          .filter((t) => !t.is_completed)
          .map((t) => {
            const due = new Date(t.due_at);
            if (isNaN(due.getTime())) return null;
            const hour = due.getHours();
            const minute = due.getMinutes();

            let trigger: any;
            if (t.recurrence === 'weekly') {
              trigger = { type: Notifications.SchedulableTriggerInputTypes.WEEKLY, weekday: due.getDay() + 1, hour, minute };
            } else if (t.recurrence === 'monthly') {
              trigger = { type: Notifications.SchedulableTriggerInputTypes.MONTHLY, day: due.getDate(), hour, minute };
            } else if (t.recurrence === 'yearly') {
              trigger = { type: Notifications.SchedulableTriggerInputTypes.YEARLY, month: due.getMonth() + 1, day: due.getDate(), hour, minute };
            } else {
              if (due.getTime() <= Date.now()) return null; // one-off already passed
              trigger = due;
            }

            const recurrenceLabel = t.recurrence === 'once' ? '' : ` (${t.recurrence})`;
            return scheduleLocalNotification({
              title: `TODO: ${t.title.toUpperCase()}`,
              body: `Reminder${recurrenceLabel} — ${t.title}. Tap to open your shared list.`,
              trigger,
              channelId: PRIORITY_CHANNEL,
              data: { kind: 'todo', reminderKey: `todo:${coupleId}:${t.id}` },
            });
          })
      );
    });

    syncTodoReminders();
  }, [todos, coupleId]);

  // Milestones ("On this day"): for each, a day-of celebration plus a day-before
  // heads-up (yearly + one-off only) so there's time to plan. Recurring dates use
  // YEARLY/MONTHLY triggers so they fire every year/month without rescheduling;
  // one-offs use a plain date. Both devices schedule from the same shared list.
  useEffect(() => {
    const scheduleMilestoneReminders = () => withLock(`milestone:${coupleId}`, async () => {
      if (!coupleId) return;

      await cancelScheduledNotificationsByPrefix(`milestone:${coupleId}:`);

      const now = new Date();
      await Promise.all(
        milestones.flatMap((m) => {
          const next = nextOccurrence(m, now);
          if (!next) return []; // one-off already in the past

          const label = m.emoji ? `${m.emoji} ${m.title}` : m.title;
          const { count, unit } = elapsedAt(m, next);
          const elapsed = formatElapsed(count, unit);
          const jobs: (Promise<any> | null)[] = [];

          // Day-of celebration.
          let dayOfTrigger: any;
          if (m.recurrence === 'yearly') {
            dayOfTrigger = { type: Notifications.SchedulableTriggerInputTypes.YEARLY, month: next.getMonth() + 1, day: next.getDate(), hour: 9, minute: 0 };
          } else if (m.recurrence === 'monthly') {
            dayOfTrigger = { type: Notifications.SchedulableTriggerInputTypes.MONTHLY, day: next.getDate(), hour: 9, minute: 0 };
          } else {
            const dayOf = new Date(next);
            dayOf.setHours(9, 0, 0, 0);
            dayOfTrigger = dayOf.getTime() > Date.now() ? dayOf : null;
          }
          if (dayOfTrigger) {
            jobs.push(scheduleLocalNotification({
              title: `Today: ${m.title}`,
              body: elapsed ? `${label} — ${elapsed} today. Celebrate it together.` : `${label} is today. Celebrate it together.`,
              trigger: dayOfTrigger,
              channelId: PRIORITY_CHANNEL,
              data: { kind: 'milestone', reminderKey: `milestone:${coupleId}:${m.id}:day` },
            }));
          }

          // Day-before heads-up (skip for monthly — a monthly nudge every 30 days
          // is more nagging than helpful).
          if (m.recurrence !== 'monthly') {
            const before = new Date(next);
            before.setDate(before.getDate() - 1);
            before.setHours(9, 0, 0, 0);
            let beforeTrigger: any;
            if (m.recurrence === 'yearly') {
              beforeTrigger = { type: Notifications.SchedulableTriggerInputTypes.YEARLY, month: before.getMonth() + 1, day: before.getDate(), hour: 9, minute: 0 };
            } else {
              beforeTrigger = before.getTime() > Date.now() ? before : null;
            }
            if (beforeTrigger) {
              jobs.push(scheduleLocalNotification({
                title: `Tomorrow: ${m.title}`,
                body: elapsed ? `${label} is tomorrow — ${elapsed}. Time to plan something.` : `${label} is tomorrow. Time to plan something.`,
                trigger: beforeTrigger,
                channelId: PRIORITY_CHANNEL,
                data: { kind: 'milestone', reminderKey: `milestone:${coupleId}:${m.id}:eve` },
              }));
            }
          }
          return jobs;
        })
      );
    });

    scheduleMilestoneReminders();
  }, [milestones, coupleId]);

  // Daily check-in nudge at 8pm. Schedules the next week of one-shots (rolling
  // forward on foreground), and skips today's once this device has already
  // checked in — so the prompt stops nagging the moment you respond.
  useEffect(() => {
    if (!session || !coupleId) return;
    const scheduleCheckInReminders = () => withLock(`checkin:${coupleId}`, async () => {
      await cancelScheduledNotificationsByPrefix('checkin:');
      const AT_HOUR = 20;
      const now = new Date();
      const jobs: Promise<any>[] = [];
      for (let i = 0; i < 7; i++) {
        const day = new Date(now.getFullYear(), now.getMonth(), now.getDate() + i, AT_HOUR, 0, 0, 0);
        if (day.getTime() <= Date.now()) continue;
        if (i === 0 && myCheckIn) continue; // already checked in today
        jobs.push(
          scheduleLocalNotification({
            title: 'Daily check-in',
            body: 'How are you feeling today? Share a moment of gratitude with your partner.',
            trigger: day as any,
            channelId: PRIORITY_CHANNEL,
            data: { kind: 'checkin', reminderKey: `checkin:${day.toDateString()}` },
          })
        );
      }
      await Promise.all(jobs);
    });
    scheduleCheckInReminders();
  }, [session, coupleId, foregroundTick, myCheckIn]);

  // Daily vocabulary: schedule the next 14 days of one-shot notifications, each
  // carrying that day's specific word. Rolls forward on foreground (foregroundTick).
  useEffect(() => {
    if (!session) return;
    const scheduleVocab = () => withLock('vocab', async () => {
      await cancelScheduledNotificationsByPrefix('vocab:');
      const AT_HOUR = 9;
      const now = new Date();
      const tasks: Promise<any>[] = [];
      for (let i = 0; i < 14; i++) {
        const day = new Date(now.getFullYear(), now.getMonth(), now.getDate() + i, AT_HOUR, 0, 0, 0);
        if (day.getTime() <= Date.now()) continue;
        const w = getWordOfDay(day);
        tasks.push(
          scheduleLocalNotification({
            title: `Word of the Day: ${w.word}`,
            body: `${w.meaning}${w.example ? `  e.g. ${w.example}` : ''}`,
            trigger: day as any,
            channelId: PRIORITY_CHANNEL,
            data: { kind: 'vocab', reminderKey: `vocab:${day.toDateString()}` },
          })
        );
      }
      await Promise.all(tasks);
    });
    scheduleVocab();
  }, [session, foregroundTick]);

  // Fetch the changelog; if there are entries newer than the user has seen, drop
  // an "update available" notification. First run silently baselines.
  useEffect(() => {
    if (!session) return;
    const run = async () => {
      const [list, lastSeen] = await Promise.all([fetchAppUpdates(), getLastSeenUpdateAt()]);
      setAppUpdates(list);
      if (list.length === 0) return;
      if (!lastSeen) {
        await markUpdatesSeen(list[0].created_at); // baseline, no notification
        return;
      }
      const unseen = unseenUpdates(list, lastSeen);
      if (unseen.length > 0) {
        setHasUnseenUpdate(true);
        const latest = unseen[0];
        // Claim before scheduling. This effect re-runs on every foreground
        // resume, and the badge (hasUnseenUpdate) is only cleared when the user
        // opens the updates screen — so without a per-entry claim the same
        // changelog row was re-announced every time the app came to the front.
        if (await claimNotification(`update:${latest.id}`)) {
          await scheduleLocalNotification({
            title: 'NOVIA update available',
            body: `${latest.version} — ${latest.title}`,
            trigger: { seconds: 1 } as any,
            channelId: PRIORITY_CHANNEL,
            data: { kind: 'update' },
          });
        }
      }
    };
    run();
  }, [session, foregroundTick]);

  // Live-refresh the changelog when a new update row is inserted.
  useEffect(() => {
    if (!session) return;
    const channel = supabase
      .channel('app-updates-sync')
      .on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'app_updates' }, () =>
        setForegroundTick((t) => t + 1)
      )
      .subscribe();
    return () => {
      supabase.removeChannel(channel);
    };
  }, [session]);

  const markUpdatesViewed = async () => {
    if (appUpdates.length > 0) await markUpdatesSeen(appUpdates[0].created_at);
    setHasUnseenUpdate(false);
  };

  const handleAddNote = async () => {
    if (!newNoteContent.trim()) return;
    const success = await addNote(newNoteContent);
    if (success) {
      setNewNoteContent('');
    }
  };

  const handleAddFinance = async () => {
    if (!coupleId || !userId) return;

    // Validate explicitly and say what's wrong. The old version returned
    // silently on bad input, so a mistyped amount looked like a dead button.
    if (!newItemName.trim()) {
      Alert.alert('Name required', 'Give this item a name so you both recognise it later.');
      return;
    }
    const amount = parseFloat(newAmount);
    if (!Number.isFinite(amount) || amount <= 0) {
      Alert.alert('Invalid amount', 'Enter an amount greater than zero.');
      return;
    }
    const dueDate = parseLocalDate(financeDueDate);
    if (!financeDueDate.trim() || isNaN(dueDate.getTime())) {
      Alert.alert('Pick a due date', 'Choose the due or renewal date for this item.');
      return;
    }

    const isSelfLiability = newType === 'self_liability';

    // A borrowing needs a real second party; without a linked partner it can't
    // be attributed and would sit in the ledger owed by nobody.
    if (newType === 'borrowing' && !partnerProfile?.id) {
      Alert.alert(
        'No partner linked',
        'Link your partner before logging a borrowing, so the ledger knows who owes whom.'
      );
      return;
    }

    const lenderId = newType === 'borrowing' ? (financeLenderDirection === 'me' ? userId : partnerProfile!.id) : null;
    const borrowerId = newType === 'borrowing' ? (financeLenderDirection === 'me' ? partnerProfile!.id : userId) : null;

    const payload = {
      couple_id: coupleId,
      type: isSelfLiability ? 'subscription' : newType,
      item_name: newItemName.trim(),
      amount,
      due_date: toLocalISODate(dueDate),
      // Only shared subscriptions renew. financeRenewalCycle is shared form
      // state, so without this a cycle picked for a subscription would follow
      // the user over to a borrowing and make it un-settleable.
      renewal_cycle: newType === 'subscription' ? financeRenewalCycle : 'none',
      status: 'pending',
      is_self_liability: isSelfLiability,
      lender_id: lenderId,
      borrower_id: borrowerId,
      created_by: userId,
    };

    let { error } = await supabase.from('finances').insert(payload);

    // Older databases may predate the created_by column (handleAddBucket carries
    // the same fallback). Retry without it rather than losing the entry.
    if (error?.code === 'PGRST204' && error.message.includes('created_by')) {
      const { created_by: _createdBy, ...fallbackPayload } = payload;
      error = (await supabase.from('finances').insert(fallbackPayload)).error;
    }

    if (error) {
      // The is_self_liability column ships in 20260719_finance_rework.sql. If the
      // JS reached the device before that migration was applied, say so plainly
      // instead of surfacing a raw PostgREST schema-cache error.
      if (error.code === 'PGRST204' && error.message.includes('is_self_liability')) {
        Alert.alert(
          'Database update needed',
          'Run the 20260719_finance_rework.sql migration in the Supabase SQL editor, then try again.'
        );
      } else {
        Alert.alert('Finance not saved', error.message);
      }
      return;
    }

    setNewItemName('');
    setNewAmount('');
    setFinanceDueDate('');
    setFinanceRenewalCycle('none');
    await fetchSharedFinances();
  };

  /**
   * Settle an item. A recurring subscription rolls forward to its next billing
   * date instead of being retired — marking Netflix "paid" used to remove it
   * from the ledger permanently, so it silently stopped being tracked.
   */
  const markFinancePaid = async (item: FinanceItem) => {
    const nowIso = new Date().toISOString();

    if (isRecurring(item)) {
      const rolled = nextDueDate(parseLocalDate(item.due_date), item.renewal_cycle as 'monthly' | 'yearly');
      const { error } = await supabase
        .from('finances')
        .update({
          due_date: toLocalISODate(rolled),
          status: 'pending',
          last_paid_at: nowIso,
          updated_at: nowIso,
        })
        .eq('id', item.id);
      if (error) Alert.alert('Could not update', error.message);
      else {
        Alert.alert(
          'Marked paid',
          `${item.item_name} rolls over to ${rolled.toLocaleDateString()}.`
        );
      }
    } else {
      const { error } = await supabase
        .from('finances')
        .update({ status: 'paid', last_paid_at: nowIso, updated_at: nowIso })
        .eq('id', item.id);
      if (error) Alert.alert('Could not update', error.message);
    }

    await fetchSharedFinances();
  };

  const removeFinance = async (id: string) => {
    await supabase.from('finances').delete().eq('id', id);
    await fetchSharedFinances();
  };

  /**
   * Clear outstanding borrowings in one direction.
   *
   * Direction matters: this button is shown under both "you owe them" and "they
   * owe you". An unfiltered update would let a single tap on the latter wipe
   * money owed *to* you, so the caller states whose debts are being forgiven.
   */
  const handleFastSettleUp = async (direction: 'you-owe' | 'they-owe') => {
    if (!coupleId || !userId) return;

    const debtorId = direction === 'you-owe' ? userId : partnerProfile?.id;
    if (!debtorId) return;

    const debtorLabel =
      direction === 'you-owe' ? 'you owe' : `${partnerProfile?.display_name || partnerName || 'your partner'} owes`;

    Alert.alert(
      'Settle Up',
      `Mark everything ${debtorLabel} as paid? This clears those borrowings from the ledger.`,
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Settle Up',
          onPress: async () => {
            const nowIso = new Date().toISOString();
            const { error } = await supabase
              .from('finances')
              .update({ status: 'paid', last_paid_at: nowIso, updated_at: nowIso })
              .eq('couple_id', coupleId)
              .eq('type', 'borrowing')
              .eq('status', 'pending')
              .eq('borrower_id', debtorId);

            if (error) {
              Alert.alert('Settle Up failed', error.message);
            } else {
              await fetchSharedFinances();
            }
          }
        }
      ]
    );
  };

  const handleAddBucket = async () => {
    if (!coupleId || !userId || !newBucketTitle.trim()) return;

    const payload = {
      couple_id: coupleId,
      category: 'learning',
      title: newBucketTitle.trim(),
      description: newBucketDescription.trim() || null,
      created_by: userId,
    };

    let { error } = await supabase.from('bucket_list').insert(payload);
    if (error?.code === 'PGRST204' && error.message.includes('created_by')) {
      const { created_by: _createdBy, ...fallbackPayload } = payload;
      const fallback = await supabase.from('bucket_list').insert(fallbackPayload);
      error = fallback.error;
    }

    if (error) {
      Alert.alert("Bucket item not saved", error.message);
      return;
    }

    setNewBucketTitle('');
    setNewBucketDescription('');
    await fetchSharedBucketList();
  };

  const toggleBucketItemShared = async (item: any) => {
    const nextState = !item.is_completed;
    
    // Optimistic UI state update
    setBucketList(prev => prev.map(i => i.id === item.id ? { ...i, is_completed: nextState } : i));

    if (nextState) {
      Alert.alert(
        "Experiences Unlocked",
        "Congratulations on crossing off an experience together! Particle celebration active across screens.",
        [{ text: "Awesome!" }]
      );
    }

    const { error } = await supabase
      .from('bucket_list')
      .update({
        is_completed: nextState,
        completed_at: nextState ? new Date().toISOString() : null,
        completed_by: nextState ? userId : null,
      })
      .eq('id', item.id);

    if (error) {
      console.error('[Bucket Sync] Toggle failed:', error);
      fetchSharedBucketList();
    } else {
      await fetchSharedBucketList();
    }
  };

  const deleteBucketItem = async (id: string) => {
    // Optimistic UI state update
    setBucketList(prev => prev.filter(i => i.id !== id));

    const { error } = await supabase
      .from('bucket_list')
      .delete()
      .eq('id', id);

    if (error) {
      Alert.alert("Failed to delete", error.message);
      fetchSharedBucketList();
    } else {
      await fetchSharedBucketList();
    }
  };

  const handleAddPeriodLog = async () => {
    if (!periodStartDate.trim()) {
      Alert.alert("Date needed", "Please choose a period start date.");
      return;
    }

    const symptomsArray: string[] = [];
    if (gfBleeding !== 'none') symptomsArray.push(`bleeding:${gfBleeding}`);
    if (gfPhysical !== 'none') symptomsArray.push(`physical:${gfPhysical}`);
    if (gfFluid !== 'none') symptomsArray.push(`fluid:${gfFluid}`);
    if (gfEmotion !== 'calm') symptomsArray.push(`emotion:${gfEmotion}`);
    if (gfEnergy !== 'normal') symptomsArray.push(`energy:${gfEnergy}`);

    // Call predictions helper with serialized symptoms
    await addPeriodLog(periodStartDate, periodEndDate.trim() || null, symptomsArray, null);
    
    // Proactively refresh periods logs for real-time live prediction updates
    await refreshPeriods();

    setPeriodStartDate('');
    setPeriodEndDate('');
    setGfBleeding('none');
    setGfPhysical('none');
    setGfFluid('none');
    setGfEmotion('calm');
    setGfEnergy('normal');
    setIsEditingCycle(false);
    Alert.alert("Success", "Cycle data logged and predicted instantly!");
  };

  const logHospitalVisit = async () => {
    if (!userId || !hospitalReason.trim()) {
      Alert.alert("Reason needed", "Add the hospital visit reason before saving.");
      return;
    }

    const { error } = await supabase.from('medical_vault').insert({
      user_id: userId,
      metric_type: 'hospital_visit',
      value_json: {
        reason: hospitalReason.trim(),
        test_results: hospitalResults.trim(),
      },
      record_date: hospitalDate ? new Date(hospitalDate).toISOString() : new Date().toISOString(),
      notes: hospitalResults.trim() || null,
    });

    if (error) {
      Alert.alert("Visit not saved", error.message);
      return;
    }

    setHospitalDate('');
    setHospitalReason('');
    setHospitalResults('');
    fetchHospitalVisits();
  };

  // ---- Todo handlers -------------------------------------------------------
  const handleAddTodo = async () => {
    if (!newTodoTitle.trim()) {
      Alert.alert('Title needed', 'Give your todo a title first.');
      return;
    }
    // Build the first-fire timestamp from the picked date (default today) + time.
    const base = todoDate ? new Date(`${todoDate}T00:00:00`) : new Date();
    base.setHours(todoHour, todoMinute, 0, 0);

    const created = await addTodo({
      title: newTodoTitle,
      notes: newTodoNotes,
      dueAt: base,
      recurrence: todoRecurrence,
    });

    if (!created) {
      Alert.alert('Todo not saved', 'NOVIA could not save this todo. Please check connectivity.');
      return;
    }

    setNewTodoTitle('');
    setNewTodoNotes('');
    setTodoDate('');
    setTodoHour(9);
    setTodoMinute(0);
    setTodoRecurrence('once');
  };

  // ---- Milestone handlers --------------------------------------------------
  const handleAddMilestone = async () => {
    if (!newMilestoneTitle.trim()) {
      Alert.alert('Name needed', 'Name this milestone — e.g. First Date, Anniversary.');
      return;
    }
    if (!milestoneDate) {
      Alert.alert('Pick a date', 'Choose the date this milestone happened.');
      return;
    }
    const created = await addMilestone({
      title: newMilestoneTitle,
      date: milestoneDate,
      recurrence: milestoneRecurrence,
      emoji: milestoneEmoji,
    });
    if (!created) {
      Alert.alert('Not saved', 'NOVIA could not save this milestone. Please check connectivity.');
      return;
    }
    setNewMilestoneTitle('');
    setMilestoneDate('');
    setMilestoneRecurrence('yearly');
    setMilestoneEmoji('💛');
  };

  // ---- Daily check-in handlers ---------------------------------------------
  // Keep the card's controls in sync with today's saved entry (either partner's
  // realtime update, or this device re-submitting).
  useEffect(() => {
    if (myCheckIn) {
      setCheckInFeeling(myCheckIn.feeling);
      setCheckInGratitude(myCheckIn.gratitude || '');
    }
  }, [myCheckIn?.feeling, myCheckIn?.gratitude]);

  const handleSubmitCheckIn = async (feeling?: string) => {
    const chosen = feeling || checkInFeeling;
    if (!chosen) {
      Alert.alert('Pick a feeling', 'Tap how you feel today first.');
      return;
    }
    setCheckInFeeling(chosen);
    const saved = await submitCheckIn(chosen, checkInGratitude);
    if (!saved) {
      Alert.alert('Not saved', 'NOVIA could not save your check-in. Please check connectivity.');
    }
  };

  // ---- Complaint handlers --------------------------------------------------
  const handleAddComplaint = async () => {
    if (!newComplaintTitle.trim()) {
      Alert.alert('Title needed', 'Give your complaint a short title.');
      return;
    }
    const created = await addComplaint(newComplaintTitle, newComplaintBody);
    if (!created) {
      Alert.alert('Not saved', 'NOVIA could not file this complaint. Please check connectivity.');
      return;
    }
    setNewComplaintTitle('');
    setNewComplaintBody('');
  };

  const handleAddReply = async (complaintId: string) => {
    if (!replyText.trim()) return;
    const created = await addReply(complaintId, replyText);
    if (created) setReplyText('');
  };

  // Notify me when my partner files a complaint.
  //
  // Dedup is persisted rather than held in a ref. An in-memory baseline is
  // captured from the *empty* initial state (coupleId is null on first render,
  // so useComplaints reports loading=false with an empty list), which made every
  // pre-existing complaint look new once the real data arrived — re-notifying
  // on every single launch.
  useEffect(() => {
    if (!userId || !coupleId || complaintsLoading) return;

    let cancelled = false;
    const announceNewComplaints = async () => {
      // Anything that predates this device's first run is history, not news.
      const baselineAt = await getOrCreateBaseline(`complaints:${coupleId}`);

      for (const c of complaints) {
        if (cancelled) return;
        if (c.created_by === userId) continue;
        if (c.created_at <= baselineAt) continue;
        // Atomically claims the key, so a re-render mid-flight can't double-fire.
        if (!(await claimNotification(`complaint:${c.id}`))) continue;

        const from =
          c.created_by === partnerProfile?.id
            ? partnerProfile?.display_name || partnerName || 'Your partner'
            : 'Your partner';
        await scheduleLocalNotification({
          title: 'New complaint filed',
          body: `${from}: ${c.title}`,
          trigger: { seconds: 1 } as any,
          channelId: PRIORITY_CHANNEL,
          data: { kind: 'complaint', complaintId: c.id },
        });
      }
    };

    announceNewComplaints();
    return () => {
      cancelled = true;
    };
  }, [complaints, complaintsLoading, userId, coupleId, partnerProfile, partnerName]);

  const welcomeName = profile?.display_name || session?.user?.email?.split('@')[0] || 'there';
  const relationshipAdvice = (() => {
    const partnerNameVal = partnerProfile?.display_name || partnerName || 'your partner';
    switch (partnerMood) {
      case 'Happy':
        return `${partnerNameVal} is feeling Happy today. Plan a sweet dessert date, share a high-energy activity, or celebrate this vibe together.`;
      case 'Overwhelmed':
        return `${partnerNameVal} is feeling Overwhelmed. Take care of any pending chores, keep your communication extremely soft, and defer deep or stressful debates for later.`;
      case 'Exhausted':
        return `${partnerNameVal} is Exhausted. Create a cozy, quiet sanctuary at home, offer a soothing warm beverage, and keep the environment restful.`;
      case 'Low Energy':
        return `${partnerNameVal} has Low Energy. Gentle cuddles, warm physical presence, and check-in without placing demands will make them feel loved.`;
      default:
        return `${partnerNameVal} is feeling balanced. Send a cute meme, check in with a thoughtful text, or plan a tiny shared moment.`;
    }
  })();

  // Milestones landing today ("On this day") and the next month's upcoming ones.
  const todayMilestones = milestones.filter((m) => occursOn(m, new Date()));
  const upcomingMilestones = milestones
    .map((m) => ({ m, days: daysUntilNext(m, new Date()) }))
    .filter((x): x is { m: Milestone; days: number } => x.days !== null && x.days > 0 && x.days <= 30)
    .sort((a, b) => a.days - b.days);

  // Human-facing detail for a cycle phase. The *date math* (cycleMath) is the
  // source of truth for which phase she is in — that's what keeps the badge in
  // step with the cycle day and predicted dates. Symptoms never silently
  // reassign the phase; only two direct biological markers can, and only when
  // they're plausibly current (see the windowing guard below), because a
  // symptom logged at period start lingers on the record all cycle:
  //   - active bleeding  -> Menstruation  (in the bleed window / period due)
  //   - egg-white fluid   -> Ovulation     (in the fertile window)
  // Everything else (cramps, mood, energy) is used to colour the forecast text,
  // not to move the phase — those occur across several phases and previously
  // forced everyone into "Luteal" or "Follicular" regardless of the real day.
  const getCyclePhaseAndTips = (latestRecord: any, datePredictions: any) => {
    const symptoms: string[] = latestRecord?.symptoms || [];
    const bleeding = symptoms.find((s) => s.startsWith('bleeding:'))?.split(':')[1] || 'none';
    const physical = symptoms.find((s) => s.startsWith('physical:'))?.split(':')[1] || 'none';
    const fluid = symptoms.find((s) => s.startsWith('fluid:'))?.split(':')[1] || 'none';
    const emotion = symptoms.find((s) => s.startsWith('emotion:'))?.split(':')[1] || 'calm';
    const energy = symptoms.find((s) => s.startsWith('energy:'))?.split(':')[1] || 'normal';

    // Is today inside the predicted fertile window? (Drives the "Fertile" flag,
    // and gates the egg-white → Ovulation correction below.)
    let fertileNow = false;
    if (datePredictions?.fertileWindowStart && datePredictions?.fertileWindowEnd) {
      const t = new Date(); t.setHours(0, 0, 0, 0);
      fertileNow =
        t >= new Date(new Date(datePredictions.fertileWindowStart).setHours(0, 0, 0, 0)) &&
        t <= new Date(new Date(datePredictions.fertileWindowEnd).setHours(0, 0, 0, 0));
    }

    // Start from the authoritative, date-derived phase.
    let phase: string = datePredictions?.currentPhase || 'Unknown';
    // Direct biological markers may correct it — but ONLY when they're plausibly
    // *current*. Symptoms are stored on the period record and linger the whole
    // cycle, so a bleeding/fluid note logged at period start must not reassign
    // the phase weeks later (the bug that showed "Menstruation" on cycle day 20).
    // Bleeding counts only inside the expected bleed window, or when the next
    // period is essentially due (a period that started a day or two early);
    // egg-white fluid counts only while inside the fertile window.
    const cd = datePredictions?.cycleDay ?? 0;
    const inBleedWindow = cd > 0 && cd <= (datePredictions?.avgPeriodLength ?? 5) + 1;
    const periodDue = (datePredictions?.daysUntilNextPeriod ?? 99) <= 1;
    if (bleeding !== 'none' && (inBleedWindow || periodDue)) phase = 'Menstruation';
    else if (fluid === 'eggwhite' && fertileNow) phase = 'Ovulation';

    const BADGES: Record<string, string> = {
      Menstruation: 'Menstruation · Bleeding',
      Follicular: 'Follicular · Rising energy',
      Ovulation: 'Ovulation · Peak fertility',
      Luteal: fertileNow ? 'Luteal · Fertile tail' : 'Luteal · PMS window',
      Unknown: 'Getting to know her cycle',
    };
    const badge = BADGES[phase] || BADGES.Unknown;
    const color = (PHASE_COLORS as any)[phase] || THEME.colors.primary;

    // A short note echoing what she actually logged, so the boyfriend sees the
    // real-time signal alongside the model.
    const parts: string[] = [];
    if (bleeding !== 'none') parts.push(`${bleeding} flow`);
    if (physical !== 'none') parts.push(physical === 'tender' ? 'tender breasts' : physical);
    if (fluid !== 'none') parts.push(fluid === 'eggwhite' ? 'egg-white fluid' : `${fluid} fluid`);
    if (emotion !== 'calm') parts.push(`feeling ${emotion}`);
    if (energy !== 'normal') parts.push(`${energy} energy`);
    const symptomNote = parts.length ? `She logged: ${parts.join(', ')}.` : 'No symptoms logged for this cycle yet.';

    let forecast = '';
    let tips = '';
    if (phase === 'Menstruation') {
      forecast = `Her period is here${bleeding !== 'none' ? ` (${bleeding} flow)` : ''}. The uterine lining is shedding and hormones sit at their lowest — energy and mood often dip. `;
      forecast += physical === 'cramps'
        ? `She's cramping, so her body is working through uterine contractions.`
        : `Expect some pelvic heaviness and a need for rest.`;
      tips = `1. Prep a warm hot-water bottle or heating pad for her lower abdomen.
2. Brew her favourite hot tea (chamomile or peppermint helps cramps).
3. Bring comfort snacks and set up a cozy movie night.
4. Offer a gentle back or leg massage.
5. Quietly take over the chores so she can rest without guilt.`;
    } else if (phase === 'Follicular') {
      forecast = `Estrogen is climbing as new follicles develop. This is the bright, rebuilding stretch after her period — energy, mood and motivation are on the way up. `;
      forecast += energy === 'high' ? `She's already bouncing back strong.` : `Momentum builds a little more each day.`;
      tips = `1. Plan something fresh — a walk, an outing, or a new little adventure.
2. Talk through the week's goals and back her plans.
3. Surprise her with her favourite coffee or tea.
4. Jump in on any creative project she's excited about.`;
    } else if (phase === 'Ovulation') {
      forecast = `Estrogen peaks and LH surges — this is the fertile window, when she's most likely to conceive. Confidence, libido and sociability are typically at their highest. `;
      forecast += fluid === 'eggwhite' ? `Egg-white cervical fluid confirms peak fertility.` : `Fertility is at its highest for the cycle.`;
      tips = `1. Plan a proper date night — dinner, going out, something social.
2. Compliment her and be affectionate; it lands especially well now.
3. Take some photos together; she'll feel radiant.
4. If you're avoiding pregnancy, this is the window to be careful.`;
    } else if (phase === 'Luteal') {
      forecast = `Progesterone is dominant and estrogen is falling toward her next period. PMS symptoms — cramps, bloating, tender breasts, mood swings — can show up in the back half. `;
      const moods = [emotion === 'irritable' && 'irritable', emotion === 'sad' && 'low', emotion === 'anxious' && 'anxious'].filter(Boolean);
      if (moods.length) forecast += `She may feel ${moods.join('/')} — hormones, not you.`;
      else forecast += `Extra softness goes a long way this week.`;
      tips = `1. Lead with patience and grace — skip debates and problem-solving.
2. Make home calm: soft lighting, low noise, cozy blankets.
3. Listen and reassure — "I'm here, you're safe."
4. Fetch comfort treats before she has to ask.
5. Keep things tidy to reduce sensory overload.`;
    } else {
      forecast = `Log a start date and a few symptoms so NOVIA can map her phase and forecast the days ahead.`;
      tips = `Plan a cozy check-in, ask how her day's going, and send a sweet message.`;
    }

    return { phase, badge, color, forecast, tips, fertileNow, symptomNote };
  };

  // Hold the first paint until the typefaces are in memory, otherwise the whole
  // UI renders in the system font and visibly reflows a beat later.
  // fontError is treated as "carry on": falling back to system text is far
  // better than a permanently blank app if an asset fails to decode.
  if (authLoading || (!fontsLoaded && !fontError)) {
    return (
      <View style={[styles.center, { backgroundColor: THEME.colors.background }]}>
        <ActivityIndicator size="large" color={THEME.colors.primary} />
        <Text style={[styles.mutedText, { marginTop: 10 }]}>Loading NOVIA...</Text>
      </View>
    );
  }

  // --- Step Duel derived values ---
  // Only crown a leader once we have a real Health Connect read; otherwise a
  // recorded 0 would let the (mocked) partner "win" a day you couldn't track.
  const stepsLive = stepsStatus === 'ready';
  const stepMax = Math.max(mySteps, partnerSteps, 1);
  const myStepPct = Math.round((mySteps / stepMax) * 100);
  const partnerStepPct = Math.round((partnerSteps / stepMax) * 100);
  const myLeads = stepsLive && stepLeader === 'me';
  const partnerLeads = stepsLive && stepLeader === 'partner';

  return (
    <View style={styles.appShell}>
      <SpaceBackdrop />
      {/* Ambient light that slowly breathes over the backdrop. Pure opacity on
          a static gradient — one UI-thread animation for the whole app. */}
      <Breathing style={StyleSheet.absoluteFill} from={0.35} to={0.9} duration={5200}>
        <Svg pointerEvents="none" width="100%" height="100%" viewBox="0 0 390 844" preserveAspectRatio="xMidYMid slice">
          <Defs>
            <RadialGradient id="ambientPulse" cx="78%" cy="16%" r="72%" fx="78%" fy="16%">
              <Stop offset="0%" stopColor={PALETTE.lime} stopOpacity="0.20" />
              <Stop offset="55%" stopColor={PALETTE.moss} stopOpacity="0.07" />
              <Stop offset="100%" stopColor={PALETTE.forestDeep} stopOpacity="0" />
            </RadialGradient>
          </Defs>
          <Rect width="390" height="844" fill="url(#ambientPulse)" />
        </Svg>
      </Breathing>
      <View style={styles.container}>
      <StatusBar barStyle="light-content" translucent backgroundColor="transparent" />

      {!session ? (
        <SafeAreaView style={{ flex: 1 }}>
          <ScrollView contentContainerStyle={styles.authContainer} keyboardShouldPersistTaps="handled">
          <View style={styles.card}>
            <Text style={styles.cardTitle}>NOVIA</Text>
            
            <View style={styles.authTabRow}>
              <TouchableOpacity 
                style={[styles.authTab, !isSignUpMode && styles.activeAuthTab]} 
                onPress={() => setIsSignUpMode(false)}
              >
                <Text style={[styles.authTabText, !isSignUpMode && styles.activeAuthTabText]}>SIGN IN</Text>
              </TouchableOpacity>
              <TouchableOpacity 
                style={[styles.authTab, isSignUpMode && styles.activeAuthTab]} 
                onPress={() => setIsSignUpMode(true)}
              >
                <Text style={[styles.authTabText, isSignUpMode && styles.activeAuthTabText]}>REGISTER</Text>
              </TouchableOpacity>
            </View>

            {isSignUpMode && (
              <View style={styles.inputGroup}>
                <Text style={styles.inputLabel}>YOUR DISPLAY NAME</Text>
                <TextInput
                  style={styles.input}
                  placeholder="Your name..."
                  placeholderTextColor="#5A6078"
                  value={authDisplayName}
                  onChangeText={setAuthDisplayName}
                  autoCapitalize="words"
                />
              </View>
            )}

            <View style={styles.inputGroup}>
              <Text style={styles.inputLabel}>SECURE EMAIL ADDRESS</Text>
              <TextInput
                style={styles.input}
                placeholder="email@example.com"
                placeholderTextColor="#5A6078"
                value={authEmail}
                onChangeText={setAuthEmail}
                keyboardType="email-address"
                autoCapitalize="none"
                autoCorrect={false}
              />
            </View>

            <View style={styles.inputGroup}>
              <Text style={styles.inputLabel}>PASSPHRASE</Text>
              <TextInput
                style={styles.input}
                placeholder="••••••••••••"
                placeholderTextColor="#5A6078"
                secureTextEntry
                value={authPassword}
                onChangeText={setAuthPassword}
                autoCapitalize="none"
                autoCorrect={false}
              />
            </View>

            <TouchableOpacity style={styles.primaryButton} onPress={handleAuthSubmit}>
              <Text style={styles.primaryBtnText}>
                {isSignUpMode ? 'CREATE ACCOUNT' : 'SIGN IN'}
              </Text>
            </TouchableOpacity>

            <Text style={styles.authNote}>
              NOVIA requires valid Supabase DB connectivity to authenticate client sessions.
            </Text>
          </View>
        </ScrollView>
        </SafeAreaView>
      ) : !coupleId ? (
        <SafeAreaView style={{ flex: 1 }}>
          <ScrollView contentContainerStyle={styles.authContainer} keyboardShouldPersistTaps="handled">
          <View style={styles.card}>
            <Text style={styles.cardTitle}>Partner Sync</Text>
            <Text style={styles.authInfo}>
              Your session is active, but you are not linked to a partner. Sync your client credentials to establish a synchronized bridge.
            </Text>

            <View style={styles.userIdContainer}>
              <Text style={styles.userIdLabel}>YOUR UNIQUE SYNC KEY</Text>
              <TextInput
                style={styles.copyableIdText}
                value={session.user.id}
                editable={false}
                selectTextOnFocus={true}
              />
              <Text style={styles.copyInstructions}>
                Double-tap above to copy and send this key to your partner.
              </Text>
            </View>

            <View style={styles.divider} />

            <View style={styles.inputGroup}>
              <Text style={styles.inputLabel}>PARTNER'S SYNC KEY</Text>
              <TextInput
                style={styles.input}
                placeholder="Paste partner's user ID key here..."
                placeholderTextColor="#5A6078"
                value={partnerIdInput}
                onChangeText={setPartnerIdInput}
                autoCapitalize="none"
                autoCorrect={false}
              />
            </View>

            <TouchableOpacity style={styles.primaryButton} onPress={handlePairSubmit}>
              <Text style={styles.primaryBtnText}>SYNCHRONIZE MINDS &amp; HEARTS</Text>
            </TouchableOpacity>

            <TouchableOpacity style={styles.signOutButton} onPress={signOut}>
              <Text style={styles.signOutBtnText}>SIGN OUT</Text>
            </TouchableOpacity>
          </View>
        </ScrollView>
        </SafeAreaView>
      ) : (
        <View style={{ flex: 1 }}>
            <SafeAreaView style={{ flex: 1 }}>
              {/* The drawer menu is a Hub-level affordance — only surface the
                  hamburger on the home tab. Other tabs / sub-screens rely on the
                  device back button (and their own back rows). */}
              {activeTab === 'hub' && (
                <TouchableOpacity
                  style={styles.floatingMenuButton}
                  onPress={() => toggleDrawer(true)}
                  activeOpacity={0.8}
                >
                  <Menu color={THEME.colors.primary} size={22} />
                </TouchableOpacity>
              )}

              {/* A downloaded OTA bundle only takes effect on reload. Offer it
                  rather than yanking the app out from under the user. */}
              {otaUpdateReady && (
                <TouchableOpacity
                  style={styles.otaBanner}
                  onPress={applyPendingUpdate}
                  activeOpacity={0.85}
                >
                  <Text style={styles.otaBannerText}>Update downloaded</Text>
                  <Text style={styles.otaBannerAction}>Restart now</Text>
                </TouchableOpacity>
              )}
              <KeyboardAvoidingView 
                behavior={Platform.OS === 'ios' ? 'padding' : 'height'} 
                style={{ flex: 1 }}
              >
                <ScrollView 
                  style={styles.scrollArea}
                  contentContainerStyle={{
                    padding: THEME.spacing.md,
                    paddingTop: 56,
                    paddingBottom: 220
                  }}
                  keyboardShouldPersistTaps="handled"
                >
                <ScreenTransition key={activeTab}>
                {/* Main Hub Tab */}
                {activeTab === 'hub' && (
                  <View style={styles.tabContent}>
                    <Animated.View
                      style={[
                        styles.welcomeCard,
                        {
                          opacity: welcomeAnim,
                          transform: [
                            {
                              translateY: welcomeAnim.interpolate({
                                inputRange: [0, 1],
                                outputRange: [24, 0],
                              }),
                            },
                            {
                              scale: welcomeAnim.interpolate({
                                inputRange: [0, 1],
                                outputRange: [0.93, 1],
                              }),
                            },
                          ],
                        },
                      ]}
                    >
                      <Text style={styles.welcomeTitle}>Hi {welcomeName}</Text>
                      <Text style={styles.welcomeSubtitle}>Welcome back</Text>
                    </Animated.View>

                    {/* Companion Status Row */}
                    <FadeInUp index={0}>
                    <View style={styles.partnerCard}>
                      <Text style={styles.sectionHeading}>COMPANION REAL-TIME TRACKING</Text>
                      <View style={styles.rowBetween}>
                        <Text style={styles.partnerName}>{partnerName}</Text>
                        <View style={[styles.moodBadge, { backgroundColor: (THEME.colors.mood as any)[partnerMood] || THEME.colors.mood.Neutral }]}>
                          <Text style={styles.moodBadgeText}>{partnerMood}</Text>
                        </View>
                      </View>
                      {isPartnerTyping && (
                        <Text style={styles.typingNotice}>Companion is active in shared notes...</Text>
                      )}
                      <View style={styles.suggestionContainer}>
                        <Text style={styles.welcomeCopy}>{relationshipAdvice}</Text>
                      </View>
                    </View>
                    </FadeInUp>

                    {/* Step Duel — daily step competition. Own steps come from
                        Health Connect; partner steps are placeholder until sync. */}
                    <FadeInUp index={1}>
                    <View style={styles.sectionCard}>
                      <View style={styles.rowBetween}>
                        <Text style={styles.sectionHeading}>STEP DUEL</Text>
                        <Footprints size={16} color={THEME.colors.primary} />
                      </View>

                      {stepsLoading ? (
                        <View style={{ marginTop: 6 }}>
                          <View style={styles.stepRow}>
                            <Skeleton width={80} height={16} />
                            <Skeleton width={64} height={22} />
                          </View>
                          <Skeleton height={10} radius={THEME.borderRadius.round} style={{ marginTop: 10, marginBottom: 18 }} />
                          <View style={styles.stepRow}>
                            <Skeleton width={110} height={16} delay={120} />
                            <Skeleton width={64} height={22} delay={120} />
                          </View>
                          <Skeleton height={10} radius={THEME.borderRadius.round} style={{ marginTop: 10 }} delay={120} />
                        </View>
                      ) : (
                        <>
                          {/* You */}
                          <View style={styles.stepCompetitor}>
                            <View style={styles.stepRow}>
                              <View style={styles.stepNameWrap}>
                                <Text style={styles.stepName}>You</Text>
                                {myLeads && (
                                  <View style={styles.leaderPill}>
                                    <Trophy size={11} color={THEME.colors.background} />
                                    <Text style={styles.leaderPillText}>Leading</Text>
                                  </View>
                                )}
                              </View>
                              <Text style={[styles.stepValue, myLeads && styles.stepValueLead]}>
                                {mySteps.toLocaleString()}
                              </Text>
                            </View>
                            <View style={styles.stepTrack}>
                              <View style={[styles.stepFill, myLeads ? styles.stepFillLead : styles.stepFillMuted, { width: `${myStepPct}%` }]} />
                            </View>
                          </View>

                          {/* Partner */}
                          <View style={[styles.stepCompetitor, { marginTop: 14 }]}>
                            <View style={styles.stepRow}>
                              <View style={styles.stepNameWrap}>
                                <Text style={styles.stepName}>{partnerName}</Text>
                                {partnerLeads && (
                                  <View style={styles.leaderPill}>
                                    <Trophy size={11} color={THEME.colors.background} />
                                    <Text style={styles.leaderPillText}>Leading</Text>
                                  </View>
                                )}
                              </View>
                              <Text style={[styles.stepValue, partnerLeads && styles.stepValueLead]}>
                                {partnerSteps.toLocaleString()}
                              </Text>
                            </View>
                            <View style={styles.stepTrack}>
                              <View style={[styles.stepFill, partnerLeads ? styles.stepFillLead : styles.stepFillMuted, { width: `${partnerStepPct}%` }]} />
                            </View>
                          </View>

                          <View style={styles.stepDivider} />

                          {/* Win streak */}
                          {stepStreakCount >= 2 && stepStreakHolder && (
                            <View style={styles.streakRow}>
                              <Flame size={14} color={THEME.colors.warning} />
                              <Text style={styles.streakText}>
                                {stepStreakHolder === 'me' ? 'You’re' : `${partnerName} is`} on a {stepStreakCount}-day win streak
                              </Text>
                            </View>
                          )}

                          {/* Season scoreboard — daily wins this quarter */}
                          <View style={styles.seasonRow}>
                            <View style={{ flex: 1 }}>
                              <Text style={styles.seasonLabel}>SEASON · {stepSeason.label.toUpperCase()}</Text>
                              <Text style={styles.seasonSub}>{stepSeason.daysLeft} days left</Text>
                            </View>
                            <View style={styles.seasonScore}>
                              <Text style={styles.seasonSideName}>You</Text>
                              <Text style={[styles.seasonWins, stepSeason.champion === 'me' && styles.seasonWinsLead]}>
                                {stepSeason.myWins}
                              </Text>
                              <Text style={styles.seasonDash}>–</Text>
                              <Text style={[styles.seasonWins, stepSeason.champion === 'partner' && styles.seasonWinsLead]}>
                                {stepSeason.partnerWins}
                              </Text>
                              <Text style={styles.seasonSideName}>{partnerName}</Text>
                            </View>
                          </View>

                          {/* Stakes — the forfeit the loser owes when the season ends */}
                          <TouchableOpacity
                            style={styles.stakesRow}
                            activeOpacity={0.85}
                            onPress={() => { setStakesDraft(stepForfeit || ''); setStakesModalOpen(true); }}
                          >
                            <View style={styles.rowBetween}>
                              <Text style={styles.stakesLabel}>STAKES</Text>
                              <Text style={styles.stakesAction}>{stepForfeit ? 'Edit' : 'Set'}</Text>
                            </View>
                            <Text style={[styles.stakesValue, !stepForfeit && styles.stakesValueEmpty]}>
                              {stepForfeit || 'Tap to set what the loser owes the champion.'}
                            </Text>
                          </TouchableOpacity>

                          {stepsStatus === 'denied' ? (
                            <TouchableOpacity activeOpacity={0.7} onPress={requestStepAccess}>
                              <Text style={[styles.stepFootnote, styles.stepFootnoteAction]}>
                                Tap to enable step access and join the duel.
                              </Text>
                            </TouchableOpacity>
                          ) : (
                            <Text style={styles.stepFootnote}>
                              {stepsStatus === 'unavailable'
                                ? 'Connect Health Connect on this phone to track your steps.'
                                : !stepsPartnerSynced
                                ? `Waiting for ${partnerName}'s first sync today.`
                                : 'Steps sync live from Health Connect.'}
                            </Text>
                          )}
                        </>
                      )}
                    </View>
                    </FadeInUp>

                    {/* On this day — milestones landing today, then upcoming ones. */}
                    {(todayMilestones.length > 0 || upcomingMilestones.length > 0) && (
                      <FadeInUp index={1}>
                      <View style={styles.sectionCard}>
                        <View style={styles.rowBetween}>
                          <Text style={styles.sectionHeading}>ON THIS DAY</Text>
                          <CalendarHeart size={16} color="#0E9594" />
                        </View>
                        {todayMilestones.map((m) => {
                          const { count, unit } = elapsedAt(m, new Date());
                          const elapsed = formatElapsed(count, unit);
                          return (
                            <View key={m.id} style={styles.onThisDayRow}>
                              <Text style={styles.onThisDayEmoji}>{m.emoji || '💛'}</Text>
                              <View style={{ flex: 1 }}>
                                <Text style={styles.onThisDayTitle}>
                                  {m.title}{elapsed ? ` · ${elapsed}` : ''}
                                </Text>
                                <Text style={styles.onThisDayToday}>Today 🎉</Text>
                              </View>
                            </View>
                          );
                        })}
                        {upcomingMilestones.slice(0, 3).map(({ m, days }) => (
                          <View key={m.id} style={styles.onThisDayRow}>
                            <Text style={styles.onThisDayEmoji}>{m.emoji || '💛'}</Text>
                            <View style={{ flex: 1 }}>
                              <Text style={styles.onThisDayTitle}>{m.title}</Text>
                              <Text style={styles.onThisDaySub}>
                                {days === 1 ? 'Tomorrow' : `In ${days} days`}
                              </Text>
                            </View>
                          </View>
                        ))}
                        <TouchableOpacity onPress={() => setActiveTab('milestones')} style={styles.onThisDayManage}>
                          <Text style={styles.onThisDayManageText}>Manage milestones</Text>
                        </TouchableOpacity>
                      </View>
                      </FadeInUp>
                    )}

                    {/* Daily check-in / gratitude with partner-visible streaks. */}
                    <FadeInUp index={2}>
                    <View style={styles.sectionCard}>
                      <View style={styles.rowBetween}>
                        <Text style={styles.sectionHeading}>DAILY CHECK-IN</Text>
                        <View style={styles.streakPill}>
                          <Flame size={13} color="#E0A458" />
                          <Text style={styles.streakPillText}>{myStreak}d</Text>
                        </View>
                      </View>
                      <Text style={styles.checkInPrompt}>How are you feeling today?</Text>
                      <View style={styles.checkInEmojiRow}>
                        {CHECK_IN_FEELINGS.map((f) => {
                          const selected = checkInFeeling === f.emoji;
                          return (
                            <TouchableOpacity
                              key={f.emoji}
                              style={[styles.checkInEmojiBtn, selected && styles.checkInEmojiBtnActive]}
                              onPress={() => handleSubmitCheckIn(f.emoji)}
                              activeOpacity={0.8}
                            >
                              <Text style={styles.checkInEmoji}>{f.emoji}</Text>
                              <Text style={[styles.checkInEmojiLabel, selected && { color: '#0E9594' }]}>{f.label}</Text>
                            </TouchableOpacity>
                          );
                        })}
                      </View>

                      <TextInput
                        style={[styles.input, { marginTop: 12 }]}
                        placeholder="One thing you're grateful for (optional)"
                        placeholderTextColor="#5A6078"
                        value={checkInGratitude}
                        onChangeText={setCheckInGratitude}
                      />
                      <TouchableOpacity style={[styles.primaryButton, { marginTop: 12 }]} onPress={() => handleSubmitCheckIn()}>
                        <Text style={styles.primaryBtnText}>{myCheckIn ? 'UPDATE CHECK-IN' : 'SAVE CHECK-IN'}</Text>
                      </TouchableOpacity>

                      <View style={styles.checkInPartnerRow}>
                        <View style={{ flex: 1, paddingRight: 8 }}>
                          <Text style={styles.checkInPartnerLabel}>{partnerName || 'Partner'}</Text>
                          {partnerCheckIn ? (
                            <Text style={styles.checkInPartnerValue}>
                              {partnerCheckIn.feeling}{partnerCheckIn.gratitude ? ` · grateful for ${partnerCheckIn.gratitude}` : ' · checked in today'}
                            </Text>
                          ) : (
                            <Text style={styles.checkInPartnerMuted}>Hasn't checked in yet today</Text>
                          )}
                        </View>
                        <View style={styles.streakPill}>
                          <Flame size={13} color="#E0A458" />
                          <Text style={styles.streakPillText}>{partnerStreak}d</Text>
                        </View>
                      </View>
                    </View>
                    </FadeInUp>

                    {/* Compact cycle snapshot — tap through to the full tracker. */}
                    {predictions && (
                      <FadeInUp index={1}>
                      <TouchableOpacity
                        style={styles.cycleMiniCard}
                        onPress={() => setActiveTab('health')}
                        activeOpacity={0.85}
                      >
                        <Shimmer delay={900} />
                        <View style={styles.rowBetween}>
                          <Text style={styles.sectionHeading}>CYCLE</Text>
                          <View
                            style={[
                              styles.cyclePhasePill,
                              { backgroundColor: PHASE_COLORS[predictions.currentPhase] + '26' },
                            ]}
                          >
                            <Text
                              style={[
                                styles.cyclePhasePillText,
                                { color: PHASE_COLORS[predictions.currentPhase] },
                              ]}
                            >
                              {predictions.currentPhase}
                            </Text>
                          </View>
                        </View>

                        <View style={styles.cycleMiniRow}>
                          <View style={styles.cycleMiniStat}>
                            <Text style={styles.cycleMiniValue}>{predictions.cycleDay}</Text>
                            <Text style={styles.cycleMiniLabel}>Cycle day</Text>
                          </View>
                          <View style={styles.cycleMiniDivider} />
                          <View style={styles.cycleMiniStat}>
                            <Text style={styles.cycleMiniValue}>{predictions.daysUntilNextPeriod}</Text>
                            <Text style={styles.cycleMiniLabel}>
                              {predictions.daysUntilNextPeriod === 1 ? 'Day to next' : 'Days to next'}
                            </Text>
                          </View>
                          <View style={styles.cycleMiniDivider} />
                          <View style={styles.cycleMiniStat}>
                            <Text style={styles.cycleMiniValue}>{predictions.avgCycleLength}</Text>
                            <Text style={styles.cycleMiniLabel}>Avg length</Text>
                          </View>
                        </View>

                        {/* Cycle progress */}
                        <AnimatedBar
                          progress={predictions.cycleDay / predictions.avgCycleLength}
                          color={PHASE_COLORS[predictions.currentPhase]}
                          trackStyle={styles.cycleTrack}
                        />

                        <Text style={styles.cycleMiniFooter}>
                          {predictions.isStale
                            ? 'Estimated — no recent log, tap to update'
                            : `Next around ${predictions.nextPeriodStart.toLocaleDateString(undefined, { day: 'numeric', month: 'short' })}`}
                        </Text>
                      </TouchableOpacity>
                      </FadeInUp>
                    )}

                    {/* Quick navigation cards */}
                    <FadeInUp index={2}>
                    <View style={styles.navGrid}>
                      <TouchableOpacity style={styles.navCard} onPress={() => setActiveTab('todos')} activeOpacity={0.85}>
                        <ListChecks size={26} color="#0E9594" strokeWidth={2} />
                        <Text style={styles.navCardLabel}>Todo List</Text>
                      </TouchableOpacity>
                      <TouchableOpacity style={styles.navCard} onPress={() => setActiveTab('complaints')} activeOpacity={0.85}>
                        <MessageSquareWarning size={26} color="#0E9594" strokeWidth={2} />
                        <Text style={styles.navCardLabel}>Complaint Box</Text>
                      </TouchableOpacity>
                      <TouchableOpacity style={styles.navCard} onPress={() => setActiveTab('bucket')} activeOpacity={0.85}>
                        <Text style={{ fontSize: 26 }}>🪣</Text>
                        <Text style={styles.navCardLabel}>Bucket List</Text>
                      </TouchableOpacity>
                      <TouchableOpacity style={styles.navCard} onPress={() => setActiveTab('milestones')} activeOpacity={0.85}>
                        <CalendarHeart size={26} color="#0E9594" strokeWidth={2} />
                        <Text style={styles.navCardLabel}>Milestones</Text>
                      </TouchableOpacity>
                    </View>
                    </FadeInUp>

                    {/* Word of the Day */}
                    {(() => {
                      const w = getWordOfDay();
                      return (
                        <FadeInUp index={3}>
                        <View style={styles.sectionCard}>
                          <View style={styles.rowBetween}>
                            <Text style={styles.sectionHeading}>WORD OF THE DAY</Text>
                            <BookOpen size={16} color="#0E9594" />
                          </View>
                          <Text style={styles.vocabWord}>{w.word}</Text>
                          <Text style={styles.vocabMeaning}>{w.meaning}</Text>
                          {w.example ? <Text style={styles.vocabExample}>“{w.example}”</Text> : null}
                        </View>
                        </FadeInUp>
                      );
                    })()}

                    {/* Mood Selector Updates */}
                    <FadeInUp index={4}>
                    <View style={styles.sectionCard}>
                      <Text style={styles.sectionHeading}>UPDATE MY EMOTIONAL CAPACITY</Text>
                      <View style={styles.moodRow}>
                        {['Happy', 'Overwhelmed', 'Exhausted', 'Low Energy'].map((m) => (
                          <TouchableOpacity
                            key={m}
                            style={[
                              styles.moodBtn,
                              currentMood === m && { backgroundColor: THEME.glass.accentStrong, ...THEME.shadow.glowAccent }
                            ]}
                            onPress={() => updateMood(m)}
                          >
                            <Text style={styles.moodBtnText}>{m}</Text>
                          </TouchableOpacity>
                        ))}
                      </View>
                    </View>
                    </FadeInUp>
                  </View>
                )}

                {/* Collaborative Canvas Tab */}
                {activeTab === 'notes' && (
                  <View style={styles.tabContent}>
                    <View style={styles.sectionCard}>
                      <Text style={styles.sectionHeading}>SHARED NOTES</Text>
                      <TextInput
                        multiline
                        textAlignVertical="top"
                        style={[styles.input, styles.noteInput]}
                        value={newNoteContent}
                        onChangeText={setNewNoteContent}
                        placeholder="Write a note for both partners..."
                        placeholderTextColor="#2B2F44"
                      />
                      <TouchableOpacity style={styles.primaryButton} onPress={handleAddNote}>
                        <Text style={styles.primaryBtnText}>Add Shared Note</Text>
                      </TouchableOpacity>
                    </View>

                    <View style={styles.noteGrid}>
                      {notes.length === 0 ? (
                        <View style={styles.emptyCard}>
                          <Text style={styles.emptyText}>No shared notes yet.</Text>
                        </View>
                      ) : (
                        notes.map((note) => (
                          <View key={note.id} style={styles.noteCard}>
                            <View style={styles.rowBetween}>
                              <Text style={styles.noteAuthor}>{getCreatorName(note.created_by || note.updated_by)}</Text>
                              <TouchableOpacity onPress={() => removeNote(note.id)}>
                                <Text style={styles.removeText}>Remove</Text>
                              </TouchableOpacity>
                            </View>
                            <Text style={styles.noteBody}>{note.content}</Text>

                            {/* Lightweight emoji reactions — tap to add/remove yours. */}
                            <View style={styles.reactionBar}>
                              {NOTE_REACTIONS.map((emoji) => {
                                const count = Object.values(note.reactions || {}).filter((e) => e === emoji).length;
                                const mine = !!userId && note.reactions?.[userId] === emoji;
                                return (
                                  <TouchableOpacity
                                    key={emoji}
                                    style={[styles.reactionChip, count > 0 && styles.reactionChipActive, mine && styles.reactionChipMine]}
                                    onPress={() => toggleReaction(note, emoji)}
                                    activeOpacity={0.7}
                                  >
                                    <Text style={styles.reactionEmoji}>{emoji}</Text>
                                    {count > 0 && <Text style={styles.reactionCount}>{count}</Text>}
                                  </TouchableOpacity>
                                );
                              })}
                            </View>
                          </View>
                        ))
                      )}
                    </View>
                  </View>
                )}

                {/* Shared Todo List (Hub sub-screen) */}
                {activeTab === 'todos' && (
                  <View style={styles.tabContent}>
                    <TouchableOpacity style={styles.backRow} onPress={() => setActiveTab('hub')}>
                      <ChevronLeft size={20} color="#0E9594" />
                      <Text style={styles.backRowText}>Hub</Text>
                    </TouchableOpacity>

                    <View style={styles.sectionCard}>
                      <Text style={styles.sectionHeading}>NEW SHARED TODO</Text>
                      <TextInput
                        style={styles.input}
                        placeholder="What needs doing?"
                        placeholderTextColor="#5A6078"
                        value={newTodoTitle}
                        onChangeText={setNewTodoTitle}
                      />
                      <TextInput
                        style={[styles.input, { height: 60, textAlignVertical: 'top' }]}
                        placeholder="Notes (optional)"
                        placeholderTextColor="#5A6078"
                        value={newTodoNotes}
                        onChangeText={setNewTodoNotes}
                        multiline
                      />

                      <View style={[styles.rowBetween, { marginBottom: 10 }]}>
                        <Text style={styles.inputLabel}>FIRST REMINDER DATE</Text>
                        <View style={{ flexDirection: 'row', alignItems: 'center' }}>
                          {todoDate ? (
                            <TouchableOpacity onPress={() => setTodoDate('')} style={{ marginRight: 10 }}>
                              <Text style={{ color: '#0E9594', fontSize: 12, fontFamily: FONTS.bold }}>Clear</Text>
                            </TouchableOpacity>
                          ) : null}
                          <TouchableOpacity style={styles.reminderDateButton} onPress={() => openCalendarFor('todoDate')}>
                            <Text style={styles.reminderDateButtonText}>{todoDate || 'Today'}</Text>
                          </TouchableOpacity>
                        </View>
                      </View>

                      <Text style={[styles.inputLabel, { marginBottom: 8 }]}>REMINDER TIME</Text>
                      <View style={styles.spinnerRow}>
                        <View style={styles.spinnerPanel}>
                          <TouchableOpacity style={styles.spinnerButton} onPress={() => adjustTodoTime('hour', 1)}>
                            <Text style={styles.spinnerButtonText}>+</Text>
                          </TouchableOpacity>
                          <Text style={styles.spinnerValue}>{String(todoHour).padStart(2, '0')}</Text>
                          <Text style={styles.spinnerLabel}>HOUR</Text>
                          <TouchableOpacity style={styles.spinnerButton} onPress={() => adjustTodoTime('hour', -1)}>
                            <Text style={styles.spinnerButtonText}>-</Text>
                          </TouchableOpacity>
                        </View>
                        <View style={styles.spinnerDivider}>
                          <Text style={styles.spinnerColon}>:</Text>
                        </View>
                        <View style={styles.spinnerPanel}>
                          <TouchableOpacity style={styles.spinnerButton} onPress={() => adjustTodoTime('minute', 5)}>
                            <Text style={styles.spinnerButtonText}>+</Text>
                          </TouchableOpacity>
                          <Text style={styles.spinnerValue}>{String(todoMinute).padStart(2, '0')}</Text>
                          <Text style={styles.spinnerLabel}>MIN</Text>
                          <TouchableOpacity style={styles.spinnerButton} onPress={() => adjustTodoTime('minute', -5)}>
                            <Text style={styles.spinnerButtonText}>-</Text>
                          </TouchableOpacity>
                        </View>
                      </View>

                      <Text style={[styles.inputLabel, { marginTop: 14, marginBottom: 8 }]}>REPEAT</Text>
                      <View style={styles.chipsRow}>
                        {(['once', 'weekly', 'monthly', 'yearly'] as TodoRecurrence[]).map((r) => (
                          <TouchableOpacity
                            key={r}
                            style={[styles.quickAddChip, todoRecurrence === r && { backgroundColor: THEME.glass.accentStrong, ...THEME.shadow.glowAccent }]}
                            onPress={() => setTodoRecurrence(r)}
                          >
                            <Text style={styles.quickAddChipText}>
                              {r === 'once' ? 'Once' : r === 'weekly' ? 'Weekly' : r === 'monthly' ? 'Monthly' : 'Yearly'}
                            </Text>
                          </TouchableOpacity>
                        ))}
                      </View>

                      <TouchableOpacity style={[styles.primaryButton, { marginTop: 16 }]} onPress={handleAddTodo}>
                        <Text style={styles.primaryBtnText}>ADD TODO</Text>
                      </TouchableOpacity>
                    </View>

                    <View style={styles.sectionCard}>
                      <Text style={styles.sectionHeading}>SHARED TODOS</Text>
                      {todos.length === 0 ? (
                        <Text style={styles.noRemindersText}>No todos yet. Add one above — you'll both be reminded.</Text>
                      ) : (
                        todos.map((t) => {
                          const due = new Date(t.due_at);
                          const timeLabel = `${String(due.getHours()).padStart(2, '0')}:${String(due.getMinutes()).padStart(2, '0')}`;
                          const recLabel = t.recurrence === 'once' ? due.toLocaleDateString() : t.recurrence;
                          return (
                            <View key={t.id} style={styles.reminderItemRow}>
                              <TouchableOpacity
                                style={[styles.reminderCheckbox, t.is_completed && styles.reminderCheckboxCompleted]}
                                onPress={() => toggleTodo(t.id, !t.is_completed)}
                              >
                                {t.is_completed && <Check size={13} color="#EDEDF4" strokeWidth={3} />}
                              </TouchableOpacity>
                              <View style={{ flex: 1 }}>
                                <Text style={[styles.reminderTitle, t.is_completed && styles.strikethroughText]}>{t.title}</Text>
                                <Text style={{ color: '#0E9594', fontSize: 11, fontFamily: FONTS.bold, marginTop: 2 }}>
                                  {timeLabel} · {recLabel} · by {getCreatorName(t.created_by)}
                                </Text>
                                {t.notes ? <Text style={{ color: '#8B90A4', fontSize: 12, marginTop: 2, fontFamily: FONTS.body }}>{t.notes}</Text> : null}
                              </View>
                              <TouchableOpacity style={styles.reminderDeleteButton} onPress={() => deleteTodo(t.id)}>
                                <X size={13} color="#0E9594" strokeWidth={2.5} />
                              </TouchableOpacity>
                            </View>
                          );
                        })
                      )}
                    </View>
                    <View style={{ height: 100 }} />
                  </View>
                )}

                {/* Milestones / Anniversaries (Hub sub-screen) */}
                {activeTab === 'milestones' && (
                  <View style={styles.tabContent}>
                    <TouchableOpacity style={styles.backRow} onPress={() => setActiveTab('hub')}>
                      <ChevronLeft size={20} color="#0E9594" />
                      <Text style={styles.backRowText}>Hub</Text>
                    </TouchableOpacity>

                    <View style={styles.sectionCard}>
                      <Text style={styles.sectionHeading}>NEW MILESTONE</Text>
                      <TextInput
                        style={styles.input}
                        placeholder="e.g. First Date, Anniversary"
                        placeholderTextColor="#5A6078"
                        value={newMilestoneTitle}
                        onChangeText={setNewMilestoneTitle}
                      />

                      <View style={[styles.rowBetween, { marginTop: 12, marginBottom: 10 }]}>
                        <Text style={styles.inputLabel}>DATE</Text>
                        <View style={{ flexDirection: 'row', alignItems: 'center' }}>
                          {milestoneDate ? (
                            <TouchableOpacity onPress={() => setMilestoneDate('')} style={{ marginRight: 10 }}>
                              <Text style={{ color: '#0E9594', fontSize: 12, fontFamily: FONTS.bold }}>Clear</Text>
                            </TouchableOpacity>
                          ) : null}
                          <TouchableOpacity style={styles.reminderDateButton} onPress={() => openCalendarFor('milestoneDate')}>
                            <Text style={styles.reminderDateButtonText}>{milestoneDate || 'Pick a date'}</Text>
                          </TouchableOpacity>
                        </View>
                      </View>

                      <Text style={[styles.inputLabel, { marginBottom: 8 }]}>REPEAT</Text>
                      <View style={styles.chipsRow}>
                        {(['yearly', 'monthly', 'once'] as MilestoneRecurrence[]).map((r) => (
                          <TouchableOpacity
                            key={r}
                            style={[styles.quickAddChip, milestoneRecurrence === r && { backgroundColor: THEME.glass.accentStrong, ...THEME.shadow.glowAccent }]}
                            onPress={() => setMilestoneRecurrence(r)}
                          >
                            <Text style={styles.quickAddChipText}>
                              {r === 'yearly' ? 'Every year' : r === 'monthly' ? 'Every month' : 'One-off'}
                            </Text>
                          </TouchableOpacity>
                        ))}
                      </View>

                      <Text style={[styles.inputLabel, { marginTop: 14, marginBottom: 8 }]}>ICON</Text>
                      <View style={styles.chipsRow}>
                        {MILESTONE_EMOJIS.map((e) => (
                          <TouchableOpacity
                            key={e}
                            style={[styles.milestoneEmojiChip, milestoneEmoji === e && { backgroundColor: THEME.glass.accentStrong, ...THEME.shadow.glowAccent }]}
                            onPress={() => setMilestoneEmoji(e)}
                          >
                            <Text style={{ fontSize: 20 }}>{e}</Text>
                          </TouchableOpacity>
                        ))}
                      </View>

                      <TouchableOpacity style={[styles.primaryButton, { marginTop: 16 }]} onPress={handleAddMilestone}>
                        <Text style={styles.primaryBtnText}>ADD MILESTONE</Text>
                      </TouchableOpacity>
                    </View>

                    <View style={styles.sectionCard}>
                      <Text style={styles.sectionHeading}>SHARED MILESTONES</Text>
                      {milestones.length === 0 ? (
                        <Text style={styles.noRemindersText}>No milestones yet. Add your first date or anniversary — you'll both get an "On this day" reminder.</Text>
                      ) : (
                        milestones.map((m) => {
                          const base = parseLocalDate(m.milestone_date);
                          const days = daysUntilNext(m, new Date());
                          const recLabel = m.recurrence === 'yearly' ? 'Every year' : m.recurrence === 'monthly' ? 'Every month' : 'One-off';
                          const whenLabel =
                            days === null ? 'Passed' :
                            days === 0 ? 'Today 🎉' :
                            days === 1 ? 'Tomorrow' :
                            `In ${days} days`;
                          return (
                            <View key={m.id} style={styles.reminderItemRow}>
                              <Text style={styles.milestoneRowEmoji}>{m.emoji || '💛'}</Text>
                              <View style={{ flex: 1 }}>
                                <Text style={styles.reminderTitle}>{m.title}</Text>
                                <Text style={{ color: '#0E9594', fontSize: 11, fontFamily: FONTS.bold, marginTop: 2 }}>
                                  {base.toLocaleDateString(undefined, { day: 'numeric', month: 'short', year: 'numeric' })} · {recLabel} · {whenLabel}
                                </Text>
                              </View>
                              <TouchableOpacity style={styles.reminderDeleteButton} onPress={() => deleteMilestone(m.id)}>
                                <X size={13} color="#0E9594" strokeWidth={2.5} />
                              </TouchableOpacity>
                            </View>
                          );
                        })
                      )}
                    </View>
                    <View style={{ height: 100 }} />
                  </View>
                )}

                {/* Complaint Box (Hub sub-screen) */}
                {activeTab === 'complaints' && (
                  <View style={styles.tabContent}>
                    <TouchableOpacity
                      style={styles.backRow}
                      onPress={() => { if (openComplaintId) setOpenComplaintId(null); else setActiveTab('hub'); }}
                    >
                      <ChevronLeft size={20} color="#0E9594" />
                      <Text style={styles.backRowText}>{openComplaintId ? 'All complaints' : 'Hub'}</Text>
                    </TouchableOpacity>

                    {openComplaintId ? (() => {
                      const c = complaints.find((x) => x.id === openComplaintId);
                      if (!c) return <Text style={styles.noRemindersText}>This complaint was removed.</Text>;
                      const thread = repliesFor(c.id);
                      return (
                        <View style={styles.sectionCard}>
                          <View style={styles.rowBetween}>
                            <Text style={[styles.sectionHeading, { flex: 1 }]}>{c.title}</Text>
                            <View style={[styles.statusChip, { backgroundColor: c.status === 'resolved' ? 'rgba(14, 149, 148,0.18)' : 'rgba(14, 149, 148,0.18)' }]}>
                              <Text style={{ color: c.status === 'resolved' ? '#0E9594' : '#0E9594', fontSize: 10, fontFamily: FONTS.heavy }}>{c.status.toUpperCase()}</Text>
                            </View>
                          </View>
                          <Text style={{ color: '#8B90A4', fontSize: 11, marginBottom: 6, fontFamily: FONTS.body }}>Filed by {getCreatorName(c.created_by)}</Text>
                          {c.body ? <Text style={{ color: '#F4F5FA', fontSize: 14, marginBottom: 12, fontFamily: FONTS.body }}>{c.body}</Text> : null}

                          <View style={{ gap: 8, marginBottom: 12 }}>
                            {thread.length === 0 ? (
                              <Text style={styles.noRemindersText}>No replies yet.</Text>
                            ) : thread.map((r) => {
                              const mine = r.author_id === userId;
                              return (
                                <View key={r.id} style={[styles.replyBubble, mine ? styles.replyMine : styles.replyTheirs]}>
                                  <Text style={{ color: '#0E9594', fontSize: 10, fontFamily: FONTS.heavy, marginBottom: 2 }}>{getCreatorName(r.author_id)}</Text>
                                  <Text style={{ color: '#F4F5FA', fontSize: 13, fontFamily: FONTS.body }}>{r.body}</Text>
                                </View>
                              );
                            })}
                          </View>

                          <View style={styles.addReminderRow}>
                            <TextInput
                              style={[styles.input, { flex: 1, marginBottom: 0 }]}
                              placeholder="Write a reply..."
                              placeholderTextColor="#5A6078"
                              value={replyText}
                              onChangeText={setReplyText}
                            />
                            <TouchableOpacity style={styles.plusAddButton} onPress={() => handleAddReply(c.id)}>
                              <Send size={18} color="#EDEDF4" />
                            </TouchableOpacity>
                          </View>

                          <View style={{ flexDirection: 'row', gap: 10, marginTop: 14 }}>
                            <TouchableOpacity
                              style={[styles.secondaryButton, { flex: 1 }]}
                              onPress={() => setComplaintStatus(c.id, c.status === 'resolved' ? 'open' : 'resolved')}
                            >
                              <Text style={styles.secondaryBtnText}>{c.status === 'resolved' ? 'Reopen' : 'Mark resolved'}</Text>
                            </TouchableOpacity>
                            {c.created_by === userId ? (
                              <TouchableOpacity
                                style={[styles.secondaryButton, { flex: 1, backgroundColor: 'rgba(14, 149, 148,0.16)' }]}
                                onPress={() => { deleteComplaint(c.id); setOpenComplaintId(null); }}
                              >
                                <Text style={[styles.secondaryBtnText, { color: '#0E9594' }]}>Delete</Text>
                              </TouchableOpacity>
                            ) : null}
                          </View>
                        </View>
                      );
                    })() : (
                      <>
                        <View style={styles.sectionCard}>
                          <Text style={styles.sectionHeading}>FILE A COMPLAINT</Text>
                          <TextInput
                            style={styles.input}
                            placeholder="Title (e.g. You left the lights on)"
                            placeholderTextColor="#5A6078"
                            value={newComplaintTitle}
                            onChangeText={setNewComplaintTitle}
                          />
                          <TextInput
                            style={[styles.input, { height: 80, textAlignVertical: 'top' }]}
                            placeholder="Describe it (optional)"
                            placeholderTextColor="#5A6078"
                            value={newComplaintBody}
                            onChangeText={setNewComplaintBody}
                            multiline
                          />
                          <TouchableOpacity style={styles.primaryButton} onPress={handleAddComplaint}>
                            <Text style={styles.primaryBtnText}>SUBMIT COMPLAINT</Text>
                          </TouchableOpacity>
                        </View>

                        <View style={styles.sectionCard}>
                          <Text style={styles.sectionHeading}>COMPLAINT TICKETS</Text>
                          {complaints.length === 0 ? (
                            <Text style={styles.noRemindersText}>No complaints. All is well.</Text>
                          ) : complaints.map((c) => {
                            const count = repliesFor(c.id).length;
                            return (
                              <TouchableOpacity key={c.id} style={styles.ticketRow} onPress={() => setOpenComplaintId(c.id)}>
                                <View style={{ flex: 1 }}>
                                  <Text style={styles.ticketTitle}>{c.title}</Text>
                                  <Text style={{ color: '#8B90A4', fontSize: 11, marginTop: 2, fontFamily: FONTS.body }}>
                                    by {getCreatorName(c.created_by)} · {count} {count === 1 ? 'reply' : 'replies'}
                                  </Text>
                                </View>
                                <View style={[styles.statusChip, { backgroundColor: c.status === 'resolved' ? 'rgba(14, 149, 148,0.18)' : 'rgba(14, 149, 148,0.18)' }]}>
                                  <Text style={{ color: c.status === 'resolved' ? '#0E9594' : '#0E9594', fontSize: 10, fontFamily: FONTS.heavy }}>{c.status.toUpperCase()}</Text>
                                </View>
                              </TouchableOpacity>
                            );
                          })}
                        </View>
                      </>
                    )}
                    <View style={{ height: 100 }} />
                  </View>
                )}

                {/* Subscriptions & Borrowings Tab */}
                {activeTab === 'finances' && (() => {
                  // Calculate liabilities. `yourOwed` / `partnerOwed` power the
                  // per-person liability bars (total each is on the hook for).
                  // The inter-partner net settlement is tracked separately from
                  // borrowings only — self-liabilities are personal and must not
                  // leak into who-owes-whom.
                  const partnerDisplayName = partnerProfile?.display_name || partnerName || 'Partner';

                  // All ledger arithmetic lives in summarizeFinances (unit tested)
                  // rather than being recomputed inline on every render.
                  const summary = summarizeFinances(financeItems, userId, partnerProfile?.id);

                  const {
                    combinedOutstanding,
                    yourShare,
                    partnerShare,
                    yourSelfLiability,
                    partnerSelfLiability,
                    netSettlement,
                    monthlySubscriptionCost,
                    activeSubscriptionCount,
                    unattributed,
                    overdueCount,
                  } = summary;

                  // Bars are proportional to what's actually attributed, so they
                  // fill correctly even when some rows can't be assigned.
                  const barBasis = yourShare + partnerShare;

                  // Helper for generating next 30 days
                  const getNext30Days = () => {
                    const days = [];
                    const today = new Date();
                    for (let i = 0; i < 30; i++) {
                      const current = new Date(today);
                      current.setDate(today.getDate() + i);
                      days.push(current);
                    }
                    return days;
                  };

                  return (
                    <View style={styles.tabContent}>
                      {/* Proportional Spend Analytics Dashboard */}
                      <View style={styles.sectionCard}>
                        <Text style={styles.sectionHeading}>SPEND ANALYSIS &amp; LEDGER COMPARISON</Text>
                        
                        <View style={styles.analyticsCombinedRow}>
                          <View>
                            <Text style={styles.analyticsLabel}>TOTAL OUTSTANDING</Text>
                            <Text style={styles.analyticsCombinedValue}>₹{combinedOutstanding.toFixed(2)}</Text>
                          </View>
                          {overdueCount > 0 && (
                            <View style={styles.overduePill}>
                              <Text style={styles.overduePillText}>
                                {overdueCount} overdue
                              </Text>
                            </View>
                          )}
                        </View>

                        {/* Progress Bar 1 - You Owe */}
                        <View style={styles.progressGroup}>
                          <View style={styles.rowBetween}>
                            <Text style={styles.progressLabel}>YOUR TOTAL EXPOSURE</Text>
                            <Text style={styles.progressValue}>₹{yourShare.toFixed(2)}</Text>
                          </View>
                          <AnimatedBar
                            progress={barBasis > 0 ? yourShare / barBasis : 0}
                            color={THEME.colors.primary}
                          />
                          {yourSelfLiability > 0 && (
                            <Text style={styles.progressSubLabel}>
                              includes ₹{yourSelfLiability.toFixed(2)} personal
                            </Text>
                          )}
                        </View>

                        {/* Progress Bar 2 - Partner Owes */}
                        <View style={styles.progressGroup}>
                          <View style={styles.rowBetween}>
                            <Text style={styles.progressLabel}>{partnerDisplayName.toUpperCase()}'S TOTAL EXPOSURE</Text>
                            <Text style={styles.progressValue}>₹{partnerShare.toFixed(2)}</Text>
                          </View>
                          <AnimatedBar
                            progress={barBasis > 0 ? partnerShare / barBasis : 0}
                            color={THEME.colors.accent}
                          />
                          {partnerSelfLiability > 0 && (
                            <Text style={styles.progressSubLabel}>
                              includes ₹{partnerSelfLiability.toFixed(2)} personal
                            </Text>
                          )}
                        </View>

                        {unattributed > 0 && (
                          <Text style={styles.ledgerWarning}>
                            ₹{unattributed.toFixed(2)} of borrowings couldn't be matched to either of you —
                            they were likely logged before your accounts were linked. Remove and re-add them
                            to include them in the settlement.
                          </Text>
                        )}
                      </View>

                      {/* Net Settlement Ledger Card */}
                      {(() => {
                        // Net settlement is strictly between partners — only
                        // borrowings count (subscriptions cancel 50/50, self-
                        // liabilities are personal and excluded entirely).
                        const owedToYou = netSettlement > 0;
                        const accent = owedToYou ? THEME.colors.success : THEME.colors.rust;
                        return (
                          <View style={[styles.settlementCard, netSettlement !== 0 && { backgroundColor: owedToYou ? THEME.glass.success : THEME.glass.danger }]}>
                            <Text style={[styles.sectionHeading, { color: netSettlement === 0 ? THEME.colors.textMuted : accent }]}>NET SETTLEMENT LEDGER</Text>
                            {netSettlement !== 0 ? (
                              <View>
                                <Text style={[styles.predText, { fontSize: 13, marginBottom: 12 }]}>
                                  {owedToYou ? (
                                    <>Overall, <Text style={{ color: accent, fontFamily: FONTS.bold }}>{partnerDisplayName}</Text> owes you </>
                                  ) : (
                                    <>Overall, you owe <Text style={{ color: accent, fontFamily: FONTS.bold }}>{partnerDisplayName}</Text> </>
                                  )}
                                  <Text style={{ color: accent, fontFamily: FONTS.bold, fontSize: 15 }}>₹{Math.abs(netSettlement).toFixed(2)}</Text> net.
                                </Text>
                                <TouchableOpacity
                                  style={styles.primaryButton}
                                  onPress={() => handleFastSettleUp(owedToYou ? 'they-owe' : 'you-owe')}
                                >
                                  <Text style={styles.primaryBtnText}>
                                    {owedToYou ? `Mark ${partnerDisplayName} settled` : 'Settle Up'}
                                  </Text>
                                </TouchableOpacity>
                              </View>
                            ) : (
                              <Text style={[styles.predText, { fontSize: 13, color: THEME.colors.textMuted, textAlign: 'center', marginVertical: 6 }]}>
                                Balances are perfectly settled. No outstanding debts.
                              </Text>
                            )}
                          </View>
                        );
                      })()}

                      {/* Subscription Forecast Card */}
                      {activeSubscriptionCount > 0 && (
                        <View style={styles.subscriptionForecastCard}>
                          <Text style={styles.sectionHeading}>RECURRING SUBSCRIPTION FORECAST</Text>
                          <Text style={[styles.predText, { fontSize: 13, marginBottom: 8 }]}>
                            Tracked Subscriptions: <Text style={{ color: THEME.colors.primary, fontFamily: FONTS.bold }}>{activeSubscriptionCount}</Text>
                          </Text>
                          <View style={[styles.rowBetween, { marginTop: 12, paddingTop: 12 }]}>
                            <Text style={styles.progressLabel}>TOTAL MONTHLY BURDEN</Text>
                            <Text style={[styles.financeAmount, { color: THEME.colors.warning }]}>₹{monthlySubscriptionCost.toFixed(2)}/mo</Text>
                          </View>
                          <View style={[styles.rowBetween, { marginTop: 4 }]}>
                            <Text style={styles.progressLabel}>INDIVIDUAL BURDEN (50% SPLIT)</Text>
                            <Text style={[styles.financeMeta, { fontSize: 11 }]}>₹{(monthlySubscriptionCost / 2).toFixed(2)}/mo each</Text>
                          </View>
                          <Text style={styles.progressSubLabel}>
                            Yearly plans are shown as their monthly equivalent.
                          </Text>
                        </View>
                      )}

                      <View style={styles.sectionCard}>
                        <Text style={styles.sectionHeading}>LOG BORROWINGS &amp; SUBSCRIPTIONS</Text>
                        <TextInput
                          style={styles.input}
                          placeholder="Item or Subscription Name..."
                          placeholderTextColor="#5A6078"
                          value={newItemName}
                          onChangeText={setNewItemName}
                        />
                        <TextInput
                          style={styles.input}
                          placeholder="Amount (₹)..."
                          placeholderTextColor="#5A6078"
                          keyboardType="numeric"
                          value={newAmount}
                          onChangeText={setNewAmount}
                        />
                        
                        {/* Horizontal Date Selector Strip instead of text input */}
                        <Text style={styles.inputLabel}>SELECT DUE OR RENEWAL DATE</Text>
                        <ScrollView 
                          horizontal 
                          showsHorizontalScrollIndicator={false} 
                          style={styles.dateStrip}
                          contentContainerStyle={{ gap: 8, paddingBottom: 10 }}
                        >
                          {getNext30Days().map((dateObj) => {
                            // Local formatting: toISOString() would shift this to
                            // the previous calendar day anywhere east of UTC.
                            const dateStr = toLocalISODate(dateObj);
                            const isSelected = financeDueDate === dateStr;
                            const dayName = dateObj.toLocaleDateString('en-US', { weekday: 'short' });
                            const dayNum = dateObj.getDate();
                            const monthName = dateObj.toLocaleDateString('en-US', { month: 'short' });
                            
                            return (
                              <TouchableOpacity
                                key={dateStr}
                                style={[styles.dateCard, isSelected && styles.activeDateCard]}
                                onPress={() => setFinanceDueDate(dateStr)}
                              >
                                <Text style={[styles.dateCardDay, isSelected && styles.activeDateCardText]}>{dayName.toUpperCase()}</Text>
                                <Text style={[styles.dateCardNum, isSelected && styles.activeDateCardText]}>{dayNum}</Text>
                                <Text style={[styles.dateCardMonth, isSelected && styles.activeDateCardText]}>{monthName}</Text>
                              </TouchableOpacity>
                            );
                          })}
                        </ScrollView>

                        <TouchableOpacity 
                          style={[styles.calendarPickerBtn, { marginTop: 4 }]} 
                          onPress={() => openCalendarFor('financeDueDate')}
                        >
                          <Text style={styles.calendarPickerBtnText}>
                            {financeDueDate ? `DUE DATE: ${financeDueDate}` : 'OR CHOOSE CUSTOM DUE DATE FROM CALENDAR'}
                          </Text>
                        </TouchableOpacity>

                        <View style={{ flexDirection: 'row', justifyContent: 'space-between', marginBottom: 12, gap: 8 }}>
                          <TouchableOpacity 
                            style={[styles.smallBtn, { flex: 1 }, newType === 'borrowing' && { backgroundColor: THEME.glass.accentStrong, ...THEME.shadow.glowAccent }]}
                            onPress={() => setNewType('borrowing')}
                          >
                            <Text style={styles.btnText}>Borrowing</Text>
                          </TouchableOpacity>
                          <TouchableOpacity 
                            style={[styles.smallBtn, { flex: 1 }, newType === 'subscription' && { backgroundColor: THEME.glass.accentStrong, ...THEME.shadow.glowAccent }]}
                            onPress={() => setNewType('subscription')}
                          >
                            <Text style={styles.btnText}>Subscription</Text>
                          </TouchableOpacity>
                          <TouchableOpacity 
                            style={[styles.smallBtn, { flex: 1 }, newType === 'self_liability' && { backgroundColor: 'rgba(224, 164, 88, 0.20)', shadowColor: '#E0A458', shadowOpacity: 0.5, shadowRadius: 18, shadowOffset: { width: 0, height: 8 }, elevation: 8 }]}
                            onPress={() => setNewType('self_liability')}
                          >
                            <Text style={[styles.btnText, newType === 'self_liability' && { color: '#E0A458', fontFamily: FONTS.bold }]}>Self Liability</Text>
                          </TouchableOpacity>
                        </View>

                        {newType === 'borrowing' && (
                          <View style={{ marginBottom: 12 }}>
                            <Text style={styles.inputLabel}>LENDER DIRECTION (WHO OWE WHO?)</Text>
                            <View style={styles.rowBetween}>
                              <TouchableOpacity 
                                style={[styles.smallBtn, financeLenderDirection === 'me' && { backgroundColor: THEME.glass.accentStrong, ...THEME.shadow.glowAccent }, { flex: 1, marginRight: 6 }]}
                                onPress={() => setFinanceLenderDirection('me')}
                              >
                                <Text style={styles.btnText}>You lent to {partnerDisplayName}</Text>
                              </TouchableOpacity>
                              <TouchableOpacity 
                                style={[styles.smallBtn, financeLenderDirection === 'partner' && { backgroundColor: THEME.glass.accentStrong, ...THEME.shadow.glowAccent }, { flex: 1, marginLeft: 6 }]}
                                onPress={() => setFinanceLenderDirection('partner')}
                              >
                                <Text style={styles.btnText}>{partnerDisplayName} lent to You</Text>
                              </TouchableOpacity>
                            </View>
                          </View>
                        )}

                        {newType === 'subscription' && (
                          <View style={styles.segmentControl}>
                            {(['none', 'monthly', 'yearly'] as const).map((cycle) => (
                              <TouchableOpacity
                                key={cycle}
                                style={[styles.segmentOption, financeRenewalCycle === cycle && styles.activeSegmentOption]}
                                onPress={() => setFinanceRenewalCycle(cycle)}
                              >
                                <Text style={[styles.segmentText, financeRenewalCycle === cycle && styles.activeSegmentText]}>
                                  {cycle.toUpperCase()}
                                </Text>
                              </TouchableOpacity>
                            ))}
                          </View>
                        )}
                        <TouchableOpacity style={styles.primaryButton} onPress={handleAddFinance}>
                          <Text style={styles.primaryBtnText}>Log Financial Item</Text>
                        </TouchableOpacity>
                      </View>

                      <Text style={styles.sectionTitle}>Shared Finance Ledger</Text>
                      {financeItems.length === 0 ? (
                        <Text style={styles.mutedText}>No shared finance items recorded.</Text>
                      ) : (
                        financeItems.map((item) => {
                          const isSelf = !!item.is_self_liability;
                          const overdue = isOverdue(item);
                          const recurring = isRecurring(item);

                          // Who this row belongs to, in plain language.
                          const attribution = isSelf
                            ? `Personal · ${getCreatorName(item.created_by)}`
                            : item.type === 'borrowing'
                              ? item.borrower_id === userId
                                ? `You owe ${partnerDisplayName}`
                                : item.borrower_id === partnerProfile?.id
                                  ? `${partnerDisplayName} owes you`
                                  : 'Unmatched borrowing'
                              : 'Shared · split 50/50';

                          return (
                            <View
                              key={item.id}
                              style={[
                                styles.financeCard,
                                isSelf && styles.financeCardPersonal,
                                overdue && styles.financeCardOverdue,
                              ]}
                            >
                              <View style={{ flex: 1, paddingRight: 8 }}>
                                <Text style={styles.financeName}>{item.item_name}</Text>
                                <Text style={styles.financeMeta}>{attribution}</Text>
                                <Text style={[styles.financeMeta, overdue && { color: THEME.colors.danger }]}>
                                  {overdue ? 'Overdue since ' : 'Due '}
                                  {parseLocalDate(item.due_date).toLocaleDateString()}
                                  {recurring ? ` · renews ${item.renewal_cycle}` : ''}
                                  {item.status === 'paid' ? ' · PAID' : ''}
                                </Text>
                              </View>
                              <View style={styles.financeActions}>
                                <Text style={styles.financeAmount}>₹{Number(item.amount).toFixed(2)}</Text>
                                {item.status !== 'paid' && (
                                  <TouchableOpacity style={styles.miniActionButton} onPress={() => markFinancePaid(item)}>
                                    {/* Recurring items roll to the next cycle rather than retiring. */}
                                    <Text style={styles.btnText}>{recurring ? 'Renew' : 'Paid'}</Text>
                                  </TouchableOpacity>
                                )}
                                <TouchableOpacity style={styles.miniDangerButton} onPress={() => removeFinance(item.id)}>
                                  <Text style={styles.btnText}>Remove</Text>
                                </TouchableOpacity>
                              </View>
                            </View>
                          );
                        })
                      )}
                    </View>
                  );
                })()}

                {/* Periods & Health Tab */}
                {activeTab === 'health' && (
                  <View style={styles.tabContent}>
                    {/* Compact cycle summary — the full detailed prediction and the
                        editor now live in the Cycle Tracker modal (also reachable
                        from the side drawer). */}
                    {(() => {
                      const latestRecord = records && records.length > 0 ? records[0] : null;
                      const phaseData = predictions ? getCyclePhaseAndTips(latestRecord, predictions) : null;
                      const openTracker = (edit: boolean) => { setIsEditingCycle(edit); setIsCycleModalVisible(true); };
                      return (
                        <TouchableOpacity style={styles.sectionCard} activeOpacity={0.9} onPress={() => openTracker(!predictions)}>
                          <View style={styles.rowBetween}>
                            <Text style={styles.sectionHeading}>MENSTRUAL CYCLE</Text>
                            {predictions && phaseData ? (
                              <View style={[styles.cyclePhasePill, { backgroundColor: phaseData.color + '26' }]}>
                                <Text style={[styles.cyclePhasePillText, { color: phaseData.color }]}>{phaseData.phase}</Text>
                              </View>
                            ) : null}
                          </View>

                          {predictions && phaseData ? (
                            <>
                              <Text style={[styles.cycleSummaryBadge, { color: phaseData.color }]}>{phaseData.badge}</Text>
                              <View style={styles.cycleMiniRow}>
                                <View style={styles.cycleMiniStat}>
                                  <Text style={styles.cycleMiniValue}>{predictions.cycleDay}</Text>
                                  <Text style={styles.cycleMiniLabel}>Cycle day</Text>
                                </View>
                                <View style={styles.cycleMiniDivider} />
                                <View style={styles.cycleMiniStat}>
                                  <Text style={styles.cycleMiniValue}>{Math.max(predictions.daysUntilNextPeriod, 0)}</Text>
                                  <Text style={styles.cycleMiniLabel}>{predictions.daysUntilNextPeriod === 1 ? 'Day to next' : 'Days to next'}</Text>
                                </View>
                                <View style={styles.cycleMiniDivider} />
                                <View style={styles.cycleMiniStat}>
                                  <Text style={styles.cycleMiniValue}>{predictions.avgCycleLength}</Text>
                                  <Text style={styles.cycleMiniLabel}>Avg length</Text>
                                </View>
                              </View>
                              <AnimatedBar
                                progress={predictions.cycleDay / predictions.avgCycleLength}
                                color={phaseData.color}
                                trackStyle={styles.cycleTrack}
                              />
                              {phaseData.fertileNow && (
                                <View style={styles.fertileChip}>
                                  <Sparkles size={12} color="#EDEDF4" strokeWidth={2.4} />
                                  <Text style={styles.fertileChipText}>Fertile window open</Text>
                                </View>
                              )}
                              <Text style={styles.cycleTapHint}>Tap for the full prediction &amp; to log symptoms →</Text>
                            </>
                          ) : (
                            <>
                              <Text style={[styles.welcomeCopy, { marginTop: 4 }]}>
                                Set up cycle tracking to get phase predictions, fertile-window dates, and a gentle reminder before her next period.
                              </Text>
                              <View style={[styles.primaryButton, { marginTop: 12 }]}>
                                <Text style={styles.primaryBtnText}>Set up cycle tracking</Text>
                              </View>
                            </>
                          )}
                        </TouchableOpacity>
                      );
                    })()}

                    <View style={styles.sectionCard}>
                      <Text style={styles.sectionHeading}>HOSPITAL VISIT LOG</Text>
                      <Text style={styles.inputLabel}>VISIT DATE</Text>
                      <TouchableOpacity 
                        style={styles.calendarPickerBtn} 
                        onPress={() => openCalendarFor('hospitalDate')}
                      >
                        <Text style={styles.calendarPickerBtnText}>
                          {hospitalDate ? `VISIT DATE: ${hospitalDate}` : 'CHOOSE VISIT DATE'}
                        </Text>
                      </TouchableOpacity>
                      <TextInput
                        style={styles.input}
                        placeholder="Reason for visit..."
                        placeholderTextColor="#5A6078"
                        value={hospitalReason}
                        onChangeText={setHospitalReason}
                      />
                      <TextInput
                        multiline
                        textAlignVertical="top"
                        style={[styles.input, styles.noteInput]}
                        placeholder="Test results / doctor notes..."
                        placeholderTextColor="#5A6078"
                        value={hospitalResults}
                        onChangeText={setHospitalResults}
                      />
                      <TouchableOpacity style={styles.primaryButton} onPress={logHospitalVisit}>
                        <Text style={styles.primaryBtnText}>Save Hospital Visit</Text>
                      </TouchableOpacity>
                    </View>

                    <Text style={styles.sectionTitle}>Hospital Visit History</Text>
                    {medLogs.length === 0 && (
                      <Text style={styles.emptyStateText}>No hospital visits logged yet.</Text>
                    )}
                    {medLogs.map((log) => (
                      <TouchableOpacity
                        key={log.id}
                        style={styles.vaultRow}
                        activeOpacity={0.85}
                        onPress={() => setOpenMedLog(log)}
                      >
                        <View style={{ flex: 1, marginRight: 10 }}>
                          <Text style={styles.vaultText}>{getCreatorName(log.user_id)}: {log.value_json?.reason || 'Hospital visit'}</Text>
                          <Text style={styles.financeMeta} numberOfLines={1}>{log.value_json?.test_results || 'No test results added.'}</Text>
                        </View>
                        <View style={{ alignItems: 'flex-end' }}>
                          <Text style={styles.vaultDate}>{new Date(log.record_date).toLocaleDateString()}</Text>
                          <Text style={styles.vaultOpenHint}>View →</Text>
                        </View>
                      </TouchableOpacity>
                    ))}
                  </View>
                )}

                {/* Bucket List Tab */}
                {activeTab === 'bucket' && (
                  <View style={styles.tabContent}>
                    <TouchableOpacity style={styles.backRow} onPress={() => setActiveTab('hub')}>
                      <ChevronLeft size={20} color="#0E9594" />
                      <Text style={styles.backRowText}>Hub</Text>
                    </TouchableOpacity>
                    <View style={styles.sectionCard}>
                      <Text style={styles.sectionHeading}>ADD EXPERIENCES GOAL</Text>
                      <TextInput
                        style={styles.input}
                        placeholder="Header..."
                        placeholderTextColor="#5A6078"
                        value={newBucketTitle}
                        onChangeText={setNewBucketTitle}
                      />
                      <TextInput
                        multiline
                        textAlignVertical="top"
                        style={[styles.input, styles.noteInput]}
                        placeholder="Description..."
                        placeholderTextColor="#5A6078"
                        value={newBucketDescription}
                        onChangeText={setNewBucketDescription}
                      />
                      <TouchableOpacity style={styles.primaryButton} onPress={handleAddBucket}>
                        <Text style={styles.primaryBtnText}>Add experience to list</Text>
                      </TouchableOpacity>
                    </View>

                    <Text style={styles.sectionTitle}>Our Aspirations Checklist</Text>
                    {bucketList.length === 0 ? (
                      <Text style={styles.mutedText}>Bucket list is currently empty.</Text>
                    ) : (
                      bucketList.map((item) => (
                        <BlinkingBucketRow 
                          key={item.id} 
                          item={item} 
                          getCreatorName={getCreatorName} 
                          onToggle={() => toggleBucketItemShared(item)}
                          onDelete={() => deleteBucketItem(item.id)}
                        />
                      ))
                    )}
                  </View>
                )}
                </ScreenTransition>
              </ScrollView>
            </KeyboardAvoidingView>
            </SafeAreaView>

          {/* Bottom Absolute Black Fade Vignette Overlay */}
          <View style={styles.bottomOverlayFade} pointerEvents="none">
            <Svg width="100%" height="100%">
              <Defs>
                <SvgLinearGradient id="bottomOverlayBlackFade" x1="0" y1="1" x2="0" y2="0">
                  <Stop offset="0%" stopColor="#1E2030" stopOpacity="1" />
                  <Stop offset="15%" stopColor="#1E2030" stopOpacity="1" />
                  <Stop offset="45%" stopColor="#1E2030" stopOpacity="0.9" />
                  <Stop offset="70%" stopColor="#1E2030" stopOpacity="0.5" />
                  <Stop offset="100%" stopColor="#1E2030" stopOpacity="0" />
                </SvgLinearGradient>
              </Defs>
              <Rect width="100%" height="100%" fill="url(#bottomOverlayBlackFade)" />
            </Svg>
          </View>

          {/* Premium Bottom Tab Bar. Hidden while the drawer is open so its
              high elevation can't poke through the drawer's scrim/panel. */}
          {!isDrawerOpen && (
            <AnimatedTabBar
              tabs={['hub', 'notes', 'finances', 'health'] as const}
              activeTab={activeTab}
              onChange={setActiveTab}
            />
          )}

          {/* Visual Calendar Modal */}
          <Modal
            visible={isCalendarVisible}
            transparent={true}
            animationType="fade"
            onRequestClose={() => {
              setIsCalendarVisible(false);
              setCalendarTarget(null);
            }}
          >
            <View style={styles.calendarModalOverlay}>
              <View style={styles.calendarModalContent}>
                <Text style={styles.calendarModalTitle}>
                  SELECT {calendarTarget === 'periodStartDate' ? 'START DATE' :
                          calendarTarget === 'periodEndDate' ? 'END DATE' :
                          calendarTarget === 'hospitalDate' ? 'VISIT DATE' :
                          calendarTarget === 'todoDate' ? 'TODO DATE' : 'DUE DATE'}
                </Text>
                <Calendar
                  onDayPress={(day: any) => handleDateSelect(day.dateString)}
                  theme={{
                    backgroundColor: '#262A40',
                    calendarBackground: '#262A40',
                    textSectionTitleColor: '#E0A458',
                    selectedDayBackgroundColor: '#0E9594',
                    // Cream ink on the red selection — reads cleanly against #0E9594.
                    selectedDayTextColor: '#EDEDF4',
                    todayTextColor: '#0E9594',
                    dayTextColor: '#F4F5FA',
                    textDisabledColor: '#2B2F44',
                    dotColor: '#0E9594',
                    selectedDotColor: '#EDEDF4',
                    arrowColor: '#0E9594',
                    monthTextColor: '#EDEDF4',
                    // The calendar takes font families through its own theme keys,
                    // so it isn't covered by the stylesheet — without these it
                    // would be the one surface still rendering in the system font.
                    textDayFontFamily: FONTS.medium,
                    textMonthFontFamily: FONTS.display,
                    textDayHeaderFontFamily: FONTS.semibold,
                    textDayFontSize: 13,
                    textMonthFontSize: 16,
                    textDayHeaderFontSize: 11
                  }}
                />
                <TouchableOpacity 
                  style={styles.calendarCloseBtn} 
                  onPress={() => {
                    setIsCalendarVisible(false);
                    setCalendarTarget(null);
                  }}
                >
                  <Text style={styles.calendarCloseBtnText}>CANCEL</Text>
                </TouchableOpacity>
              </View>
            </View>
          </Modal>

          {/* Sliding Side Drawer Overlay */}
          {isDrawerOpen && (
            <View style={styles.drawerBackdrop}>
              <Animated.View style={[StyleSheet.absoluteFill, { backgroundColor: 'rgba(0,0,0,0.6)', opacity: drawerAnim }]}>
                <TouchableOpacity 
                  style={{ flex: 1 }} 
                  activeOpacity={1} 
                  onPress={() => toggleDrawer(false)} 
                />
              </Animated.View>

              <Animated.View 
                style={[
                  styles.drawerPanel,
                  {
                    transform: [{
                      translateX: drawerAnim.interpolate({
                        inputRange: [0, 1],
                        outputRange: [-280, 0]
                      })
                    }]
                  }
                ]}
              >
                <View style={styles.drawerProfileSection}>
                  <View style={styles.drawerAvatar}>
                    <Text style={styles.drawerAvatarText}>
                      {welcomeName.charAt(0).toUpperCase()}
                    </Text>
                  </View>
                  <Text style={styles.drawerProfileName}>{welcomeName}</Text>
                  <Text style={styles.drawerProfileEmail}>{session?.user?.email}</Text>
                  {partnerProfile && (
                    <View style={styles.drawerPartnerRow}>
                      <Heart size={12} color="#0E9594" fill="#0E9594" style={{ marginRight: 4 }} />
                      <Text style={styles.drawerPartnerText}>Paired with {partnerProfile.display_name || partnerName}</Text>
                    </View>
                  )}
                </View>

                <TouchableOpacity
                  style={styles.drawerMenuItem}
                  onPress={() => {
                    toggleDrawer(false);
                    setIsEditingCycle(false);
                    setIsCycleModalVisible(true);
                  }}
                >
                  <Activity color="#0E9594" size={20} style={{ marginRight: 12 }} />
                  <Text style={styles.drawerMenuText}>Cycle Tracker</Text>
                </TouchableOpacity>

                <TouchableOpacity
                  style={styles.drawerMenuItem}
                  onPress={() => {
                    toggleDrawer(false);
                    setIsChangelogVisible(true);
                    markUpdatesViewed();
                  }}
                >
                  <ScrollText color="#0E9594" size={20} style={{ marginRight: 12 }} />
                  <View style={{ flexDirection: 'row', alignItems: 'center' }}>
                    <Text style={styles.drawerMenuText}>Changelog</Text>
                    {hasUnseenUpdate && <View style={styles.unseenDot} />}
                  </View>
                </TouchableOpacity>

                <TouchableOpacity
                  style={styles.drawerMenuItem}
                  onPress={() => {
                    toggleDrawer(false);
                    setIsSettingsVisible(true);
                  }}
                >
                  <SettingsIcon color="#0E9594" size={20} style={{ marginRight: 12 }} />
                  <View style={{ flexDirection: 'row', alignItems: 'center' }}>
                    <Text style={styles.drawerMenuText}>Settings</Text>
                  </View>
                </TouchableOpacity>

                <TouchableOpacity 
                  style={[styles.drawerMenuItem, styles.drawerMenuItemLogout]} 
                  onPress={() => {
                    toggleDrawer(false);
                    Alert.alert(
                      "Sign Out",
                      "Are you sure you want to end your synchronized session?",
                      [
                        { text: "Cancel", style: "cancel" },
                        { text: "Sign Out", style: "destructive", onPress: signOut }
                      ]
                    );
                  }}
                >
                  <LogOut color="#F24722" size={20} style={{ marginRight: 12 }} />
                  <Text style={[styles.drawerMenuText, { color: '#F24722' }]}>Sign Out</Text>
                </TouchableOpacity>

                {/* Branding + running version, pinned to the bottom of the drawer. */}
                <View style={styles.drawerFooter}>
                  <Text style={styles.drawerBrand}>NOVIA</Text>
                  <Text style={styles.drawerBrandTag}>Your companion, in sync.</Text>
                  <Text style={styles.drawerVersion}>
                    v{Constants.expoConfig?.version ?? '2.1.0'}
                    {Updates.updateId ? ` · ${Updates.updateId.slice(0, 8)}` : ' · dev'}
                  </Text>
                </View>
              </Animated.View>
            </View>
          )}

          {/* Account & Pairing Settings Modal */}
          <Modal
            visible={isSettingsVisible}
            transparent={true}
            animationType="slide"
            onRequestClose={() => setIsSettingsVisible(false)}
          >
            <View style={styles.settingsModalOverlay}>
              <View style={styles.settingsModalContent}>
                <View style={styles.settingsHeader}>
                  <Text style={styles.settingsTitle}>ACCOUNT &amp; PAIRING</Text>
                  <TouchableOpacity onPress={() => setIsSettingsVisible(false)}>
                    <X color="#F4F5FA" size={20} />
                  </TouchableOpacity>
                </View>
                
                <ScrollView style={styles.settingsBody} keyboardShouldPersistTaps="handled">
                  <View style={styles.settingsSection}>
                    <Text style={styles.settingsSectionTitle}>My Profile</Text>
                    
                    <View style={styles.inputGroup}>
                      <Text style={styles.inputLabel}>YOUR DISPLAY NAME</Text>
                      <TextInput
                        style={styles.settingsInput}
                        placeholder="Enter name..."
                        placeholderTextColor="#5A6078"
                        value={tempDisplayName}
                        onChangeText={setTempDisplayName}
                      />
                    </View>
                    
                    <TouchableOpacity 
                      style={styles.settingsSaveButton} 
                      onPress={handleSaveDisplayName}
                    >
                      <Text style={styles.settingsSaveBtnText}>SAVE NAME</Text>
                    </TouchableOpacity>
                  </View>
                  
                  <View style={styles.settingsSection}>
                    <Text style={styles.settingsSectionTitle}>Sync Key</Text>
                    <Text style={styles.settingsHelpText}>
                      Share this unique key if your partner needs to sync with you.
                    </Text>
                    <View style={[styles.userIdContainer, { marginTop: 0 }]}>
                      <TextInput
                        style={styles.copyableIdText}
                        value={session?.user?.id}
                        editable={false}
                        selectTextOnFocus={true}
                      />
                      <Text style={styles.copyInstructions}>
                        Hold or double-tap to select and copy key.
                      </Text>
                    </View>
                  </View>

                  {coupleId && (
                    <View style={[styles.settingsSection, { marginBottom: 0, paddingBottom: 0 }]}>
                      <Text style={styles.settingsSectionTitle}>Danger Zone</Text>
                      <Text style={styles.settingsHelpText}>
                        Unpairing will decouple your screens. Your data remains safe on Supabase.
                      </Text>
                      
                      <TouchableOpacity 
                        style={styles.unpairButton} 
                        onPress={handleUnpairPress}
                      >
                        <Text style={styles.unpairBtnText}>UNPAIR PARTNER</Text>
                      </TouchableOpacity>
                    </View>
                  )}
                </ScrollView>
              </View>
            </View>
          </Modal>

          {/* Season Stakes Modal — set the forfeit the loser owes */}
          <Modal
            visible={stakesModalOpen}
            transparent={true}
            animationType="slide"
            onRequestClose={() => setStakesModalOpen(false)}
          >
            <View style={styles.settingsModalOverlay}>
              <View style={styles.settingsModalContent}>
                <View style={styles.settingsHeader}>
                  <Text style={styles.settingsTitle}>SEASON STAKES</Text>
                  <TouchableOpacity onPress={() => setStakesModalOpen(false)}>
                    <X color="#F4F5FA" size={20} />
                  </TouchableOpacity>
                </View>
                <View>
                  <Text style={styles.settingsHelpText}>
                    What does the loser owe the champion when {stepSeason.label} wraps up? Either of you can set or change it.
                  </Text>
                  <View style={styles.inputGroup}>
                    <Text style={styles.inputLabel}>THE FORFEIT</Text>
                    <TextInput
                      style={[styles.settingsInput, { minHeight: 84, textAlignVertical: 'top' }]}
                      placeholder="e.g. Loser cooks dinner for a week"
                      placeholderTextColor="#5A6078"
                      value={stakesDraft}
                      onChangeText={setStakesDraft}
                      multiline
                      maxLength={140}
                    />
                  </View>
                  <TouchableOpacity
                    style={[styles.settingsSaveButton, !stakesDraft.trim() && { opacity: 0.5 }]}
                    disabled={!stakesDraft.trim()}
                    onPress={async () => { await setStepForfeit(stakesDraft); setStakesModalOpen(false); }}
                  >
                    <Text style={styles.settingsSaveBtnText}>SAVE STAKES</Text>
                  </TouchableOpacity>
                </View>
              </View>
            </View>
          </Modal>

          {/* Cycle Tracker Modal — detailed prediction + editor */}
          <Modal
            visible={isCycleModalVisible}
            transparent={true}
            animationType="slide"
            onRequestClose={() => setIsCycleModalVisible(false)}
          >
            <View style={styles.settingsModalOverlay}>
              <View style={styles.settingsModalContent}>
                <View style={styles.settingsHeader}>
                  <Text style={styles.settingsTitle}>CYCLE TRACKER</Text>
                  <TouchableOpacity onPress={() => setIsCycleModalVisible(false)}>
                    <X color="#F4F5FA" size={20} />
                  </TouchableOpacity>
                </View>

                <ScrollView style={styles.settingsBody} keyboardShouldPersistTaps="handled">
                  {(!records || records.length === 0 || isEditingCycle) ? (
                    <>
                      <Text style={styles.inputLabel}>CHOOSE CYCLE START DATE</Text>
                      <TouchableOpacity style={styles.calendarPickerBtn} onPress={() => openCalendarFor('periodStartDate')}>
                        <Text style={styles.calendarPickerBtnText}>
                          {periodStartDate ? `START: ${periodStartDate}` : 'CHOOSE START DATE'}
                        </Text>
                      </TouchableOpacity>

                      <Text style={styles.inputLabel}>CHOOSE CYCLE END DATE (OPTIONAL)</Text>
                      <TouchableOpacity style={styles.calendarPickerBtn} onPress={() => openCalendarFor('periodEndDate')}>
                        <Text style={styles.calendarPickerBtnText}>
                          {periodEndDate ? `END: ${periodEndDate}` : 'CHOOSE END DATE (OPTIONAL)'}
                        </Text>
                      </TouchableOpacity>

                      <Text style={styles.inputLabel}>GIRLFRIEND SYMPTOMS QUESTIONNAIRE</Text>
                      <View style={styles.questionnaireCard}>
                        <Text style={styles.questionTitle}>1. Bleeding / Flow</Text>
                        <View style={styles.optionsRow}>
                          {(['none', 'spotting', 'light', 'heavy'] as const).map((opt) => (
                            <TouchableOpacity key={opt} style={[styles.optionChip, gfBleeding === opt && styles.optionChipSelected]} onPress={() => setGfBleeding(opt)}>
                              <Text style={[styles.optionText, gfBleeding === opt && styles.optionTextSelected]}>{opt.toUpperCase()}</Text>
                            </TouchableOpacity>
                          ))}
                        </View>

                        <Text style={styles.questionTitle}>2. Physical Sensations</Text>
                        <View style={styles.optionsRow}>
                          {(['none', 'cramps', 'tender', 'bloating', 'energized'] as const).map((opt) => (
                            <TouchableOpacity key={opt} style={[styles.optionChip, gfPhysical === opt && styles.optionChipSelected]} onPress={() => setGfPhysical(opt)}>
                              <Text style={[styles.optionText, gfPhysical === opt && styles.optionTextSelected]}>{opt === 'tender' ? 'TENDER BREASTS' : opt.toUpperCase()}</Text>
                            </TouchableOpacity>
                          ))}
                        </View>

                        <Text style={styles.questionTitle}>3. Cervical Fluid Type</Text>
                        <View style={styles.optionsRow}>
                          {(['none', 'dry', 'sticky', 'creamy', 'eggwhite'] as const).map((opt) => (
                            <TouchableOpacity key={opt} style={[styles.optionChip, gfFluid === opt && styles.optionChipSelected]} onPress={() => setGfFluid(opt)}>
                              <Text style={[styles.optionText, gfFluid === opt && styles.optionTextSelected]}>{opt === 'eggwhite' ? 'EGG-WHITE (FERTILE)' : opt.toUpperCase()}</Text>
                            </TouchableOpacity>
                          ))}
                        </View>

                        <Text style={styles.questionTitle}>4. Emotional Vibe</Text>
                        <View style={styles.optionsRow}>
                          {(['calm', 'irritable', 'sad', 'anxious', 'happy'] as const).map((opt) => (
                            <TouchableOpacity key={opt} style={[styles.optionChip, gfEmotion === opt && styles.optionChipSelected]} onPress={() => setGfEmotion(opt)}>
                              <Text style={[styles.optionText, gfEmotion === opt && styles.optionTextSelected]}>{opt === 'calm' ? 'CALM/BALANCED' : opt.toUpperCase()}</Text>
                            </TouchableOpacity>
                          ))}
                        </View>

                        <Text style={styles.questionTitle}>5. Energy &amp; Sleep</Text>
                        <View style={styles.optionsRow}>
                          {(['low', 'normal', 'stressed', 'high'] as const).map((opt) => (
                            <TouchableOpacity key={opt} style={[styles.optionChip, gfEnergy === opt && styles.optionChipSelected]} onPress={() => setGfEnergy(opt)}>
                              <Text style={[styles.optionText, gfEnergy === opt && styles.optionTextSelected]}>{opt === 'low' ? 'LOW ENERGY' : opt === 'stressed' ? 'STRESSED/RESTLESS' : opt.toUpperCase()}</Text>
                            </TouchableOpacity>
                          ))}
                        </View>
                      </View>

                      <TouchableOpacity style={styles.primaryButton} onPress={handleAddPeriodLog}>
                        <Text style={styles.primaryBtnText}>Save Cycle Data</Text>
                      </TouchableOpacity>

                      <TouchableOpacity
                        style={[styles.calendarPickerBtn, { marginTop: 8, marginBottom: 20, backgroundColor: 'rgba(237, 237, 244,0.06)' }]}
                        onPress={() => {
                          if (records && records.length > 0) setIsEditingCycle(false);
                          else setIsCycleModalVisible(false);
                        }}
                      >
                        <Text style={styles.calendarPickerBtnText}>{records && records.length > 0 ? 'Cancel Editing' : 'Close'}</Text>
                      </TouchableOpacity>
                    </>
                  ) : (
                    (() => {
                      const latestRecord = records && records.length > 0 ? records[0] : null;
                      const phaseData = getCyclePhaseAndTips(latestRecord, predictions);
                      const PHASE_ORDER = ['Menstruation', 'Follicular', 'Ovulation', 'Luteal'];
                      const activeIdx = PHASE_ORDER.indexOf(phaseData.phase);
                      const fmt = (d: Date) => d.toLocaleDateString(undefined, { day: 'numeric', month: 'short' });
                      return (
                        <View style={{ paddingBottom: 24 }}>
                          {/* Hero */}
                          <View style={[styles.cycleHero, { backgroundColor: phaseData.color + '22', borderColor: phaseData.color + '55' }]}>
                            <Text style={[styles.cycleHeroPhase, { color: phaseData.color }]}>{phaseData.phase}</Text>
                            <Text style={styles.cycleHeroBadge}>{phaseData.badge}</Text>
                            {predictions && (
                              <Text style={styles.cycleHeroDay}>Cycle day {predictions.cycleDay} of ~{predictions.avgCycleLength}</Text>
                            )}
                            {phaseData.fertileNow && (
                              <View style={[styles.fertileChip, { alignSelf: 'flex-start', marginTop: 10 }]}>
                                <Sparkles size={12} color="#EDEDF4" strokeWidth={2.4} />
                                <Text style={styles.fertileChipText}>Fertile window open</Text>
                              </View>
                            )}
                          </View>

                          {/* Phase stepper */}
                          <View style={styles.phaseStepper}>
                            {PHASE_ORDER.map((p, i) => {
                              const on = i === activeIdx;
                              const c = (PHASE_COLORS as any)[p] || THEME.colors.primary;
                              return (
                                <View key={p} style={styles.phaseStep}>
                                  <View style={[styles.phaseStepDot, { borderColor: c }, on && { backgroundColor: c }]} />
                                  <Text style={[styles.phaseStepLabel, on && { color: c, fontFamily: FONTS.bold }]}>{p === 'Menstruation' ? 'Period' : p === 'Follicular' ? 'Follic.' : p === 'Ovulation' ? 'Ovul.' : 'Luteal'}</Text>
                                </View>
                              );
                            })}
                          </View>

                          {predictions && (
                            <>
                              <AnimatedBar
                                progress={predictions.cycleDay / predictions.avgCycleLength}
                                color={phaseData.color}
                                trackStyle={[styles.cycleTrack, { marginTop: 4, marginBottom: 16 }]}
                              />

                              {/* Key dates */}
                              <View style={styles.cycleDatesGrid}>
                                <View style={styles.cycleDateBox}>
                                  <Text style={styles.cycleDateLabel}>NEXT PERIOD</Text>
                                  <Text style={styles.cycleDateValue}>{fmt(predictions.nextPeriodStart)}</Text>
                                  <Text style={styles.cycleDateSub}>
                                    {predictions.daysUntilNextPeriod > 0
                                      ? `in ${predictions.daysUntilNextPeriod} day${predictions.daysUntilNextPeriod === 1 ? '' : 's'}`
                                      : predictions.daysUntilNextPeriod === 0 ? 'today' : 'overdue'}
                                  </Text>
                                </View>
                                <View style={styles.cycleDateBox}>
                                  <Text style={styles.cycleDateLabel}>OVULATION</Text>
                                  <Text style={styles.cycleDateValue}>{fmt(predictions.predictedOvulation)}</Text>
                                  <Text style={styles.cycleDateSub}>peak fertility</Text>
                                </View>
                                <View style={styles.cycleDateBox}>
                                  <Text style={styles.cycleDateLabel}>FERTILE WINDOW</Text>
                                  <Text style={styles.cycleDateValue}>{fmt(predictions.fertileWindowStart)} – {fmt(predictions.fertileWindowEnd)}</Text>
                                  <Text style={styles.cycleDateSub}>higher chance to conceive</Text>
                                </View>
                                <View style={styles.cycleDateBox}>
                                  <Text style={styles.cycleDateLabel}>AVERAGES</Text>
                                  <Text style={styles.cycleDateValue}>{predictions.avgCycleLength}d cycle</Text>
                                  <Text style={styles.cycleDateSub}>~{predictions.avgPeriodLength}d period</Text>
                                </View>
                              </View>

                              {predictions.isStale ? (
                                <Text style={[styles.predText, { color: THEME.colors.warning, marginTop: 12 }]}>
                                  Estimated only — the last logged period is {predictions.cyclesSkipped} cycles old. Log her latest period to re-anchor these dates.
                                </Text>
                              ) : predictions.confidence === 'low' ? (
                                <Text style={[styles.predText, { color: THEME.colors.textMuted, marginTop: 12 }]}>
                                  Based on a default 28-day cycle — log a couple more periods to personalise this.
                                </Text>
                              ) : (
                                <Text style={[styles.predText, { color: THEME.colors.textMuted, marginTop: 12 }]}>
                                  Confidence: {predictions.confidence} · from her logged history.
                                </Text>
                              )}
                            </>
                          )}

                          <View style={[styles.adviceCard, { marginTop: 16 }]}>
                            <Text style={styles.adviceHeading}>WHAT'S HAPPENING</Text>
                            <Text style={[styles.adviceBody, { marginBottom: 10 }]}>{phaseData.forecast}</Text>
                            <Text style={[styles.predText, { fontStyle: 'italic', opacity: 0.85 }]}>{phaseData.symptomNote}</Text>
                          </View>

                          <View style={[styles.adviceCard, { marginTop: 12 }]}>
                            <Text style={styles.adviceHeading}>COZY TIPS FOR THE BOYFRIEND</Text>
                            <Text style={styles.adviceBody}>{phaseData.tips}</Text>
                          </View>

                          <Text style={[styles.predText, { opacity: 0.7, fontSize: 12, marginTop: 12 }]}>
                            Reminder: you both get a notification the morning before her predicted next period.
                          </Text>

                          <TouchableOpacity style={[styles.primaryButton, { marginTop: 16, marginBottom: 24 }]} onPress={() => setIsEditingCycle(true)}>
                            <Text style={styles.primaryBtnText}>Edit details / Log symptoms</Text>
                          </TouchableOpacity>
                        </View>
                      );
                    })()
                  )}
                </ScrollView>
              </View>
            </View>
          </Modal>

          {/* Changelog Modal */}
          <Modal
            visible={isChangelogVisible}
            transparent={true}
            animationType="slide"
            onRequestClose={() => setIsChangelogVisible(false)}
          >
            <View style={styles.settingsModalOverlay}>
              <View style={styles.settingsModalContent}>
                <View style={styles.settingsHeader}>
                  <Text style={styles.settingsTitle}>CHANGELOG</Text>
                  <TouchableOpacity onPress={() => setIsChangelogVisible(false)}>
                    <X color="#F4F5FA" size={20} />
                  </TouchableOpacity>
                </View>

                <ScrollView style={styles.settingsBody} keyboardShouldPersistTaps="handled">
                  <Text style={[styles.settingsHelpText, { marginBottom: 12 }]}>
                    Recent updates pushed to NOVIA. You and your partner see the same list.
                  </Text>
                  {appUpdates.length === 0 ? (
                    <Text style={styles.settingsHelpText}>No updates published yet.</Text>
                  ) : (
                    appUpdates.map((u) => (
                      <View key={u.id} style={styles.updateEntry}>
                        <View style={styles.rowBetween}>
                          <Text style={styles.updateVersion}>v{u.version}</Text>
                          <Text style={styles.updateDate}>{new Date(u.created_at).toLocaleDateString()}</Text>
                        </View>
                        <Text style={styles.updateTitle}>{u.title}</Text>
                        {u.body ? <Text style={styles.updateBody}>{u.body}</Text> : null}
                      </View>
                    ))
                  )}
                  <View style={{ height: 24 }} />
                </ScrollView>
              </View>
            </View>
          </Modal>

          {/* Hospital Visit detail */}
          <Modal
            visible={!!openMedLog}
            transparent={true}
            animationType="slide"
            onRequestClose={() => setOpenMedLog(null)}
          >
            <View style={styles.settingsModalOverlay}>
              <View style={styles.settingsModalContent}>
                <View style={styles.settingsHeader}>
                  <Text style={styles.settingsTitle}>HOSPITAL VISIT</Text>
                  <TouchableOpacity onPress={() => setOpenMedLog(null)}>
                    <X color="#F4F5FA" size={20} />
                  </TouchableOpacity>
                </View>

                <ScrollView style={styles.settingsBody} keyboardShouldPersistTaps="handled">
                  {openMedLog && (
                    <>
                      <View style={styles.rowBetween}>
                        <Text style={styles.medDetailWho}>{getCreatorName(openMedLog.user_id)}</Text>
                        <Text style={styles.updateDate}>{new Date(openMedLog.record_date).toLocaleDateString()}</Text>
                      </View>

                      <Text style={styles.medDetailLabel}>REASON FOR VISIT</Text>
                      <Text style={styles.medDetailValue}>{openMedLog.value_json?.reason || 'Not specified.'}</Text>

                      <Text style={styles.medDetailLabel}>TEST RESULTS / DOCTOR NOTES</Text>
                      <Text style={styles.medDetailValue}>{openMedLog.value_json?.test_results || 'No test results added.'}</Text>
                    </>
                  )}
                  <View style={{ height: 24 }} />
                </ScrollView>
              </View>
            </View>
          </Modal>
        </View>
      )}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  appShell: {
    flex: 1,
    backgroundColor: '#1E2030',
  },
  container: {
    flex: 1,
    backgroundColor: 'transparent',
    paddingTop: Platform.OS === 'android' ? StatusBar.currentHeight || 0 : 0,
  },
  center: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  authContainer: {
    padding: THEME.spacing.md,
    alignItems: 'center',
  },
  card: {
    backgroundColor: THEME.glass.surface,
    padding: THEME.spacing.lg,
    borderRadius: THEME.borderRadius.lg,
    width: '100%',
    marginTop: THEME.spacing.xl,
    ...THEME.shadow.lifted,
  },
  cardTitle: {
    fontSize: 22,
    fontFamily: FONTS.bold,
    color: '#EDEDF4',
    marginBottom: THEME.spacing.md,
    textAlign: 'center',
  },
  authInfo: {
    fontFamily: FONTS.body,
    color: '#C6CAD6',
    fontSize: 14,
    lineHeight: 20,
    textAlign: 'center',
    marginBottom: THEME.spacing.md,
  },
  authNote: {
    fontFamily: FONTS.body,
    color: THEME.colors.primary,
    fontSize: 11,
    fontStyle: 'italic',
    textAlign: 'center',
    lineHeight: 16,
  },
  scrollArea: {
    flex: 1,
  },
  tabContent: {
    paddingBottom: 140,
  },
  welcomeCard: {
    paddingHorizontal: THEME.spacing.xs,
    paddingVertical: THEME.spacing.md,
    marginBottom: THEME.spacing.sm,
  },
  welcomeTitle: {
    color: THEME.colors.text,
    fontSize: 34,
    fontFamily: FONTS.displayBold,
    // Display sizes need negative tracking; the default spacing that suits
    // 13px UI text reads loose and cheap at 34px.
    letterSpacing: -0.8,
    lineHeight: 40,
    marginBottom: 2,
  },
  welcomeSubtitle: {
    color: '#F4F5FA',
    fontSize: 24,
    fontFamily: FONTS.bold,
    marginBottom: THEME.spacing.xs,
  },
  suggestionContainer: {
    backgroundColor: 'rgba(237, 237, 244, 0.03)',
    borderRadius: 14,
    paddingHorizontal: 14,
    paddingVertical: 12,
    marginTop: 8,
  },
  welcomeCopy: {
    color: '#8B90A4',
    fontSize: 13,
    lineHeight: 18,
    fontFamily: FONTS.body,
  },
  partnerCard: {
    backgroundColor: THEME.glass.surface,
    padding: THEME.spacing.md,
    borderRadius: THEME.borderRadius.md,
    marginBottom: THEME.spacing.md,
    ...THEME.shadow.soft,
  },
  sectionHeading: {
    fontSize: 15,
    fontFamily: FONTS.heavy,
    color: THEME.colors.primary,
    letterSpacing: 1.5,
    marginBottom: THEME.spacing.sm,
  },
  rowBetween: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  partnerName: {
    fontSize: 20,
    color: '#EDEDF4',
    fontFamily: FONTS.display,
  },
  moodBadge: {
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: THEME.borderRadius.round,
  },
  moodBadgeText: {
    color: THEME.colors.text,
    fontFamily: FONTS.bold,
    fontSize: 11,
  },
  typingNotice: {
    fontFamily: FONTS.body,
    fontSize: 11,
    color: THEME.colors.primary,
    fontStyle: 'italic',
    marginTop: THEME.spacing.sm,
  },
  sectionCard: {
    backgroundColor: THEME.glass.surface,
    padding: THEME.spacing.md,
    borderRadius: THEME.borderRadius.md,
    marginBottom: THEME.spacing.md,
    ...THEME.shadow.soft,
  },

  // --- Step Duel card ---
  stepCompetitor: {
    marginTop: 6,
  },
  stepRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  stepNameWrap: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  stepName: {
    fontSize: 15,
    fontFamily: FONTS.semibold,
    color: THEME.colors.text,
  },
  stepValue: {
    fontSize: 20,
    fontFamily: FONTS.display,
    color: THEME.colors.textMuted,
  },
  stepValueLead: {
    color: THEME.colors.text,
  },
  stepTrack: {
    height: 10,
    borderRadius: THEME.borderRadius.round,
    backgroundColor: THEME.glass.inset,
    marginTop: 8,
    overflow: 'hidden',
  },
  stepFill: {
    height: '100%',
    borderRadius: THEME.borderRadius.round,
    minWidth: 6,
  },
  stepFillLead: {
    backgroundColor: THEME.colors.primary,
  },
  stepFillMuted: {
    backgroundColor: 'rgba(237, 237, 244, 0.22)',
  },
  leaderPill: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: THEME.borderRadius.round,
    backgroundColor: THEME.colors.primary,
  },
  leaderPillText: {
    fontSize: 10,
    fontFamily: FONTS.bold,
    color: THEME.colors.background,
    letterSpacing: 0.4,
  },
  stepFootnote: {
    fontSize: 11,
    fontFamily: FONTS.body,
    color: THEME.colors.textFaint,
    marginTop: 14,
  },
  stepFootnoteAction: {
    color: '#0E9594',
    fontFamily: FONTS.heavy,
  },
  stepDivider: {
    height: 1,
    backgroundColor: THEME.colors.border,
    marginTop: 16,
    marginBottom: 14,
  },
  streakRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    marginBottom: 12,
  },
  streakText: {
    fontSize: 12,
    fontFamily: FONTS.semibold,
    color: THEME.colors.warning,
  },
  seasonRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  seasonLabel: {
    fontSize: 12,
    fontFamily: FONTS.heavy,
    color: THEME.colors.textMuted,
    letterSpacing: 1.2,
  },
  seasonSub: {
    fontSize: 11,
    fontFamily: FONTS.body,
    color: THEME.colors.textFaint,
    marginTop: 2,
  },
  seasonScore: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  seasonSideName: {
    fontSize: 11,
    fontFamily: FONTS.medium,
    color: THEME.colors.textFaint,
  },
  seasonWins: {
    fontSize: 22,
    fontFamily: FONTS.display,
    color: THEME.colors.textMuted,
  },
  seasonWinsLead: {
    color: THEME.colors.primary,
  },
  seasonDash: {
    fontSize: 16,
    fontFamily: FONTS.body,
    color: THEME.colors.textFaint,
  },
  stakesRow: {
    marginTop: 16,
    padding: 12,
    borderRadius: THEME.borderRadius.sm,
    backgroundColor: THEME.glass.inset,
  },
  stakesLabel: {
    fontSize: 11,
    fontFamily: FONTS.heavy,
    color: THEME.colors.accent,
    letterSpacing: 1.2,
  },
  stakesAction: {
    fontSize: 11,
    fontFamily: FONTS.bold,
    color: THEME.colors.primary,
    letterSpacing: 0.5,
  },
  stakesValue: {
    fontSize: 13,
    fontFamily: FONTS.medium,
    color: THEME.colors.text,
    marginTop: 6,
    lineHeight: 18,
  },
  stakesValueEmpty: {
    fontFamily: FONTS.body,
    color: THEME.colors.textFaint,
  },

  // --- Finance ledger ---
  overduePill: {
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: THEME.borderRadius.round,
    backgroundColor: THEME.glass.danger,
  },
  overduePillText: {
    color: THEME.colors.danger,
    fontSize: 11,
    fontFamily: FONTS.bold,
  },
  progressSubLabel: {
    fontFamily: FONTS.body,
    color: THEME.colors.textFaint,
    fontSize: 10,
    marginTop: 4,
  },
  ledgerWarning: {
    fontFamily: FONTS.body,
    color: THEME.colors.warning,
    fontSize: 11,
    lineHeight: 16,
    marginTop: 12,
  },
  financeCardPersonal: {
    backgroundColor: THEME.glass.moss,
  },
  financeCardOverdue: {
    backgroundColor: THEME.glass.danger,
  },

  // --- OTA "update ready" banner ---
  otaBanner: {
    position: 'absolute',
    top: 8,
    left: 64,
    right: 16,
    zIndex: 20,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingVertical: 10,
    paddingHorizontal: 14,
    borderRadius: THEME.borderRadius.round,
    backgroundColor: THEME.glass.accentStrong,
    ...THEME.shadow.soft,
  },
  otaBannerText: {
    color: THEME.colors.text,
    fontSize: 13,
    fontFamily: FONTS.semibold,
  },
  otaBannerAction: {
    color: THEME.colors.primary,
    fontSize: 13,
    fontFamily: FONTS.bold,
  },

  // --- Home-screen cycle snapshot ---
  cycleMiniCard: {
    backgroundColor: THEME.glass.surface,
    padding: THEME.spacing.md,
    borderRadius: THEME.borderRadius.md,
    marginBottom: THEME.spacing.md,
    overflow: 'hidden', // clips the Shimmer sweep to the card's rounded corners
    ...THEME.shadow.soft,
  },
  cyclePhasePill: {
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: THEME.borderRadius.round,
  },
  cyclePhasePillText: {
    fontSize: 11,
    fontFamily: FONTS.bold,
    letterSpacing: 0.4,
  },
  cycleMiniRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginTop: 14,
    marginBottom: 12,
  },
  cycleMiniStat: {
    flex: 1,
    alignItems: 'center',
  },
  cycleMiniValue: {
    color: THEME.colors.text,
    fontSize: 22,
    fontFamily: FONTS.displayBold,
  },
  cycleMiniLabel: {
    fontFamily: FONTS.body,
    color: THEME.colors.textMuted,
    fontSize: 10,
    letterSpacing: 0.5,
    marginTop: 2,
    textTransform: 'uppercase',
  },
  cycleMiniDivider: {
    width: 1,
    height: 26,
    backgroundColor: 'rgba(237, 237, 244, 0.12)',
  },
  cycleTrack: {
    height: 5,
    marginTop: 0, // reset progressBarBg's margin when composed by AnimatedBar
    borderRadius: THEME.borderRadius.round,
    backgroundColor: THEME.glass.inset,
    overflow: 'hidden',
  },
  cycleMiniFooter: {
    fontFamily: FONTS.body,
    color: THEME.colors.textMuted,
    fontSize: 11,
    marginTop: 10,
  },
  // --- Cycle summary (Health tab) + detailed tracker (modal) ---------------
  cycleSummaryBadge: {
    fontFamily: FONTS.bold,
    fontSize: 13,
    marginTop: 8,
    marginBottom: 4,
  },
  cycleTapHint: {
    fontFamily: FONTS.body,
    color: THEME.colors.textMuted,
    fontSize: 11,
    marginTop: 12,
  },
  fertileChip: {
    flexDirection: 'row',
    alignItems: 'center',
    alignSelf: 'flex-start',
    gap: 5,
    marginTop: 10,
    paddingHorizontal: 10,
    paddingVertical: 5,
    borderRadius: THEME.borderRadius.round,
    backgroundColor: THEME.colors.primary,
  },
  fertileChipText: {
    fontFamily: FONTS.bold,
    color: '#EDEDF4',
    fontSize: 11,
    letterSpacing: 0.3,
  },
  cycleHero: {
    borderRadius: THEME.borderRadius.lg,
    borderWidth: 1,
    padding: 18,
    marginBottom: 18,
  },
  cycleHeroPhase: {
    fontFamily: FONTS.display,
    fontSize: 26,
    letterSpacing: 0.5,
  },
  cycleHeroBadge: {
    fontFamily: FONTS.semibold,
    color: THEME.colors.text,
    fontSize: 13,
    opacity: 0.85,
    marginTop: 2,
  },
  cycleHeroDay: {
    fontFamily: FONTS.body,
    color: THEME.colors.textMuted,
    fontSize: 13,
    marginTop: 8,
  },
  phaseStepper: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginBottom: 12,
  },
  phaseStep: {
    flex: 1,
    alignItems: 'center',
    gap: 6,
  },
  phaseStepDot: {
    width: 14,
    height: 14,
    borderRadius: 7,
    borderWidth: 2,
    backgroundColor: 'transparent',
  },
  phaseStepLabel: {
    fontFamily: FONTS.medium,
    color: THEME.colors.textMuted,
    fontSize: 11,
  },
  cycleDatesGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 10,
  },
  cycleDateBox: {
    flexGrow: 1,
    flexBasis: '46%',
    backgroundColor: THEME.glass.surface,
    borderRadius: THEME.borderRadius.md,
    padding: 12,
  },
  cycleDateLabel: {
    fontFamily: FONTS.bold,
    color: THEME.colors.textMuted,
    fontSize: 10,
    letterSpacing: 0.6,
  },
  cycleDateValue: {
    fontFamily: FONTS.bold,
    color: THEME.colors.text,
    fontSize: 15,
    marginTop: 4,
  },
  cycleDateSub: {
    fontFamily: FONTS.body,
    color: THEME.colors.textMuted,
    fontSize: 11,
    marginTop: 2,
  },
  moodRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
  },
  moodBtn: {
    backgroundColor: THEME.glass.surface,
    flex: 1,
    marginHorizontal: 3,
    paddingVertical: 12,
    borderRadius: THEME.borderRadius.sm,
    alignItems: 'center',
    ...THEME.shadow.soft,
  },
  moodBtnText: {
    color: '#EDEDF4',
    fontSize: 10,
    fontFamily: FONTS.semibold,
  },
  input: {
    fontFamily: FONTS.body,
    backgroundColor: THEME.glass.inset,
    color: '#EDEDF4',
    borderRadius: THEME.borderRadius.md,
    paddingHorizontal: THEME.spacing.md,
    paddingVertical: 14,
    fontSize: 19,
    marginBottom: THEME.spacing.sm,
  },
  primaryButton: {
    backgroundColor: '#0E9594',
    padding: THEME.spacing.md,
    borderRadius: THEME.borderRadius.md,
    alignItems: 'center',
    marginTop: THEME.spacing.xs,
    ...THEME.shadow.glowAccent,
  },
  primaryBtnText: {
    color: '#EDEDF4',
    fontFamily: FONTS.heavy,
    fontSize: 19,
    letterSpacing: 1.5,
  },
  noteInput: {
    minHeight: 96,
  },
  noteGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    justifyContent: 'space-between',
  },
  noteCard: {
    backgroundColor: THEME.glass.surface,
    borderRadius: THEME.borderRadius.md,
    padding: THEME.spacing.md,
    width: '48%',
    marginBottom: THEME.spacing.md,
    minHeight: 128,
    ...THEME.shadow.soft,
  },
  noteAuthor: {
    color: THEME.colors.primary,
    fontSize: 11,
    fontFamily: FONTS.heavy,
  },
  noteBody: {
    fontFamily: FONTS.body,
    color: '#EDEDF4',
    fontSize: 13,
    lineHeight: 19,
    marginTop: THEME.spacing.sm,
  },
  removeText: {
    color: THEME.colors.danger,
    fontSize: 10,
    fontFamily: FONTS.heavy,
  },
  reactionBar: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 5,
    marginTop: 'auto',
    paddingTop: 10,
  },
  reactionChip: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 3,
    paddingHorizontal: 6,
    paddingVertical: 3,
    borderRadius: THEME.borderRadius.round,
    backgroundColor: THEME.glass.inset,
  },
  reactionChipActive: {
    backgroundColor: THEME.glass.accent,
  },
  reactionChipMine: {
    backgroundColor: THEME.glass.accentStrong,
    ...THEME.shadow.glowAccent,
  },
  reactionEmoji: {
    fontSize: 13,
  },
  reactionCount: {
    fontFamily: FONTS.bold,
    color: THEME.colors.primary,
    fontSize: 10,
  },
  sectionTitle: {
    fontSize: 26,
    fontFamily: FONTS.display,
    color: '#EDEDF4',
    marginBottom: THEME.spacing.sm,
    marginTop: THEME.spacing.md,
    letterSpacing: -0.4,
  },
  spinnerRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: THEME.spacing.md,
  },
  spinnerPanel: {
    flex: 1,
    alignItems: 'center',
    backgroundColor: THEME.glass.inset,
    borderRadius: THEME.borderRadius.md,
    padding: THEME.spacing.sm,
  },
  spinnerButton: {
    width: 44,
    height: 36,
    borderRadius: THEME.borderRadius.sm,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: THEME.glass.accentStrong,
  },
  spinnerButtonText: {
    color: '#0E9594',
    fontSize: 22,
    lineHeight: 24,
    fontFamily: FONTS.heavy,
  },
  spinnerValue: {
    color: '#EDEDF4',
    fontSize: 40,
    fontFamily: FONTS.heavy,
    marginTop: THEME.spacing.sm,
  },
  spinnerLabel: {
    color: '#C6CAD6',
    fontSize: 10,
    fontFamily: FONTS.heavy,
    marginBottom: THEME.spacing.sm,
  },
  spinnerDivider: {
    width: 28,
    alignItems: 'center',
  },
  spinnerColon: {
    color: '#0E9594',
    fontSize: 32,
    fontFamily: FONTS.heavy,
  },
  segmentControl: {
    flexDirection: 'row',
    backgroundColor: THEME.glass.inset,
    borderRadius: THEME.borderRadius.sm,
    padding: 5,
    marginBottom: THEME.spacing.sm,
  },
  segmentOption: {
    flex: 1,
    paddingVertical: 10,
    alignItems: 'center',
    borderRadius: THEME.borderRadius.sm,
  },
  activeSegmentOption: {
    backgroundColor: 'rgba(14, 149, 148, 0.12)',
  },
  segmentText: {
    color: '#8B90A4',
    fontSize: 11,
    fontFamily: FONTS.heavy,
  },
  activeSegmentText: {
    color: '#0E9594',
  },
  emptyCard: {
    backgroundColor: 'rgba(237, 237, 244, 0.035)',
    padding: THEME.spacing.lg,
    borderRadius: THEME.borderRadius.md,
    alignItems: 'center',
  },
  emptyText: {
    fontFamily: FONTS.body,
    color: '#C6CAD6',
    fontSize: 15,
    textAlign: 'center',
  },
  reminderDateButton: {
    backgroundColor: THEME.glass.inset,
    paddingHorizontal: 14,
    paddingVertical: 8,
    borderRadius: 12,
  },
  reminderDateButtonText: {
    color: '#E0A458',
    fontSize: 12,
    fontFamily: FONTS.bold,
  },
  btnText: {
    color: '#EDEDF4',
    fontSize: 13,
    fontFamily: FONTS.bold,
  },
  smallBtn: {
    flex: 1,
    marginHorizontal: 3,
    paddingVertical: 12,
    borderRadius: THEME.borderRadius.sm,
    alignItems: 'center',
    backgroundColor: THEME.glass.surface,
    marginBottom: THEME.spacing.sm,
    ...THEME.shadow.soft,
  },
  financeCard: {
    backgroundColor: THEME.glass.surface,
    padding: THEME.spacing.md,
    borderRadius: THEME.borderRadius.md,
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: THEME.spacing.sm,
    ...THEME.shadow.soft,
  },
  financeName: {
    fontSize: 15,
    color: '#EDEDF4',
    fontFamily: FONTS.bold,
  },
  financeMeta: {
    fontFamily: FONTS.body,
    fontSize: 11,
    color: '#8B90A4',
    marginTop: 2,
  },
  financeAmount: {
    fontSize: 16,
    fontFamily: FONTS.displayBold,
    color: '#0E9594',
  },
  financeActions: {
    alignItems: 'flex-end',
    gap: 6,
  },
  miniActionButton: {
    backgroundColor: THEME.glass.accentStrong,
    borderRadius: THEME.borderRadius.sm,
    paddingHorizontal: 12,
    paddingVertical: 8,
  },
  miniDangerButton: {
    backgroundColor: THEME.glass.danger,
    borderRadius: THEME.borderRadius.sm,
    paddingHorizontal: 12,
    paddingVertical: 8,
  },
  predText: {
    color: '#0E9594',
    fontSize: 13,
    lineHeight: 20,
    fontFamily: FONTS.semibold,
  },
  vaultRow: {
    backgroundColor: THEME.glass.surface,
    borderRadius: THEME.borderRadius.sm,
    marginBottom: THEME.spacing.xs,
    padding: THEME.spacing.md,
    flexDirection: 'row',
    justifyContent: 'space-between',
  },
  vaultText: {
    color: '#EDEDF4',
    fontSize: 13,
    fontFamily: FONTS.bold,
  },
  vaultDate: {
    fontFamily: FONTS.body,
    color: '#8B90A4',
    fontSize: 11,
  },
  vaultOpenHint: {
    fontFamily: FONTS.semibold,
    color: '#0E9594',
    fontSize: 11,
    marginTop: 4,
  },
  emptyStateText: {
    fontFamily: FONTS.body,
    color: '#8B90A4',
    fontSize: 13,
    marginBottom: THEME.spacing.sm,
  },
  medDetailWho: {
    fontFamily: FONTS.bold,
    color: '#0E9594',
    fontSize: 15,
  },
  medDetailLabel: {
    fontFamily: FONTS.heavy,
    color: '#8B90A4',
    fontSize: 11,
    letterSpacing: 1.2,
    marginTop: 18,
    marginBottom: 6,
  },
  medDetailValue: {
    fontFamily: FONTS.body,
    color: '#EDEDF4',
    fontSize: 15,
    lineHeight: 22,
  },
  bucketRow: {
    backgroundColor: THEME.glass.surface,
    padding: THEME.spacing.md,
    borderRadius: THEME.borderRadius.sm,
    marginBottom: THEME.spacing.sm,
    ...THEME.shadow.soft,
  },
  bucketText: {
    color: '#EDEDF4',
    fontSize: 14,
    fontFamily: FONTS.semibold,
  },
  bucketDescription: {
    fontFamily: FONTS.body,
    color: '#C6CAD6',
    fontSize: 12,
    lineHeight: 18,
    marginTop: THEME.spacing.xs,
    marginBottom: THEME.spacing.xs,
  },
  strikethrough: {
    textDecorationLine: 'line-through',
    color: THEME.colors.textMuted,
  },
  tabBar: {
    flexDirection: 'row',
    // Near-opaque: at 0.82 the screen content behind the glass bled through as a
    // faint dark line under the active icon. Solid slate removes it.
    backgroundColor: 'rgba(30, 32, 48, 0.98)',
    borderRadius: 34,
    position: 'absolute',
    // `bottom` is set dynamically (TAB_BAR_BOTTOM) on the element itself.
    left: 16,
    right: 16,
    height: 66,
    justifyContent: 'space-around',
    alignItems: 'center',
    paddingHorizontal: 6,
    shadowColor: '#000000',
    shadowOpacity: 0.6,
    shadowRadius: 30,
    shadowOffset: { width: 0, height: 18 },
    zIndex: 10,
    elevation: 16,
  },
  tabIndicator: {
    position: 'absolute',
    left: 0,
    top: 8,
    bottom: 8,
    borderRadius: 24,
    backgroundColor: 'rgba(14, 149, 148, 0.18)',
    shadowColor: '#0E9594',
    shadowOpacity: 0.45,
    shadowRadius: 16,
    shadowOffset: { width: 0, height: 0 },
    // No Android elevation: its dark drop-shadow rendered as a line under the
    // active icon. The teal tint (+ iOS glow above) carries the highlight.
    elevation: 0,
  },
  bottomOverlayFade: {
    position: 'absolute',
    bottom: 0,
    left: 0,
    right: 0,
    height: 220,
    zIndex: 8,
    elevation: 8,
  },
  tabItem: {
    alignItems: 'center',
    justifyContent: 'center',
    flex: 1,
    height: '100%',
  },
  mutedText: {
    fontFamily: FONTS.body,
    color: '#3A3F55',
    fontSize: 12,
    textAlign: 'center',
    marginTop: THEME.spacing.xs,
  },
  authTabRow: {
    flexDirection: 'row',
    marginBottom: THEME.spacing.md,
    backgroundColor: THEME.glass.inset,
    borderRadius: THEME.borderRadius.sm,
    padding: 5,
  },
  authTab: {
    flex: 1,
    paddingVertical: THEME.spacing.sm,
    alignItems: 'center',
    borderRadius: THEME.borderRadius.sm,
  },
  activeAuthTab: {
    backgroundColor: THEME.glass.accentStrong,
  },
  authTabText: {
    color: '#8B90A4',
    fontSize: 12,
    fontFamily: FONTS.bold,
    letterSpacing: 1,
  },
  activeAuthTabText: {
    color: THEME.colors.primary,
  },
  inputGroup: {
    marginBottom: THEME.spacing.md,
    width: '100%',
  },
  inputLabel: {
    fontSize: 10,
    fontFamily: FONTS.heavy,
    color: '#C6CAD6',
    letterSpacing: 1,
    marginBottom: THEME.spacing.xs,
  },
  userIdContainer: {
    backgroundColor: THEME.glass.inset,
    borderRadius: THEME.borderRadius.md,
    padding: THEME.spacing.md,
    width: '100%',
    marginBottom: THEME.spacing.md,
    alignItems: 'center',
  },
  userIdLabel: {
    fontSize: 10,
    fontFamily: FONTS.heavy,
    color: THEME.colors.primary,
    letterSpacing: 1.5,
    marginBottom: THEME.spacing.sm,
  },
  copyableIdText: {
    color: '#EDEDF4',
    fontSize: 12,
    fontFamily: FONTS.bold,
    backgroundColor: THEME.glass.surfaceStrong,
    borderRadius: THEME.borderRadius.sm,
    padding: THEME.spacing.sm,
    width: '100%',
    textAlign: 'center',
  },
  copyInstructions: {
    fontFamily: FONTS.body,
    fontSize: 10,
    color: '#8B90A4',
    marginTop: THEME.spacing.xs,
    fontStyle: 'italic',
  },
  divider: {
    height: 0,
    backgroundColor: 'transparent',
    width: '100%',
    marginVertical: THEME.spacing.md,
  },
  signOutButton: {
    backgroundColor: THEME.glass.danger,
    padding: THEME.spacing.md,
    borderRadius: THEME.borderRadius.sm,
    alignItems: 'center',
    marginTop: THEME.spacing.md,
    width: '100%',
  },
  signOutBtnText: {
    color: THEME.colors.danger,
    fontFamily: FONTS.bold,
    fontSize: 13,
    letterSpacing: 1,
  },
  reminderDeleteButton: {
    marginLeft: THEME.spacing.sm,
    padding: 8,
    borderRadius: THEME.borderRadius.sm,
    backgroundColor: THEME.glass.danger,
    justifyContent: 'center',
    alignItems: 'center',
  },
  analyticsCombinedRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: THEME.spacing.md,
    backgroundColor: THEME.glass.accent,
    padding: THEME.spacing.md,
    borderRadius: THEME.borderRadius.md,
  },
  analyticsLabel: {
    fontSize: 10,
    fontFamily: FONTS.heavy,
    color: '#8B90A4',
    letterSpacing: 1.5,
  },
  analyticsCombinedValue: {
    fontSize: 28,
    fontFamily: FONTS.displayBold,
    color: '#0E9594',
    marginTop: 4,
  },
  progressGroup: {
    marginBottom: THEME.spacing.sm,
  },
  progressLabel: {
    fontSize: 10,
    fontFamily: FONTS.heavy,
    color: '#EDEDF4',
    letterSpacing: 1,
  },
  progressValue: {
    fontSize: 12,
    fontFamily: FONTS.displayBold,
    color: '#0E9594',
  },
  progressBarBg: {
    height: 8,
    backgroundColor: 'rgba(237, 237, 244, 0.12)',
    borderRadius: 4,
    marginTop: 4,
    overflow: 'hidden',
  },
  progressBarFill: {
    height: '100%',
    borderRadius: 4,
  },
  dateStrip: {
    flexDirection: 'row',
    marginVertical: THEME.spacing.xs,
  },
  dateCard: {
    width: 58,
    height: 72,
    borderRadius: THEME.borderRadius.md,
    backgroundColor: THEME.glass.surface,
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: THEME.spacing.xs,
    ...THEME.shadow.soft,
  },
  activeDateCard: {
    backgroundColor: '#0E9594',
    ...THEME.shadow.glowAccent,
  },
  dateCardDay: {
    fontSize: 9,
    fontFamily: FONTS.heavy,
    color: '#C6CAD6',
    letterSpacing: 1,
  },
  activeDateCardText: {
    color: '#EDEDF4',
    fontFamily: FONTS.heavy,
  },
  dateCardNum: {
    fontSize: 18,
    fontFamily: FONTS.heavy,
    color: '#EDEDF4',
  },
  dateCardMonth: {
    fontSize: 9,
    fontFamily: FONTS.heavy,
    color: '#C6CAD6',
    letterSpacing: 1,
  },
  chipsRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: THEME.spacing.sm,
    marginBottom: THEME.spacing.md,
  },
  quickAddChip: {
    backgroundColor: THEME.glass.accentStrong,
    borderRadius: THEME.borderRadius.round,
    paddingHorizontal: 14,
    paddingVertical: 8,
  },
  quickAddChipText: {
    color: '#0E9594',
    fontSize: 12,
    fontFamily: FONTS.heavy,
  },
  addReminderRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: THEME.spacing.sm,
    marginBottom: THEME.spacing.md,
  },
  plusAddButton: {
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: '#0E9594',
    alignItems: 'center',
    justifyContent: 'center',
    shadowColor: '#0E9594',
    shadowOpacity: 0.2,
    shadowRadius: 8,
    elevation: 3,
  },
  noRemindersText: {
    fontFamily: FONTS.body,
    color: '#8B90A4',
    fontSize: 13,
    textAlign: 'center',
    paddingVertical: THEME.spacing.md,
    fontStyle: 'italic',
  },
  reminderItemRow: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: THEME.glass.surface,
    paddingHorizontal: THEME.spacing.md,
    paddingVertical: 14,
    borderRadius: THEME.borderRadius.md,
    ...THEME.shadow.soft,
  },
  reminderCheckbox: {
    width: 24,
    height: 24,
    borderRadius: 8,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: THEME.glass.inset,
  },
  reminderCheckboxCompleted: {
    backgroundColor: '#0E9594',
    ...THEME.shadow.glowAccent,
  },
  reminderTitle: {
    flex: 1,
    color: '#EDEDF4',
    fontSize: 15,
    fontFamily: FONTS.semibold,
    marginLeft: THEME.spacing.sm,
  },
  strikethroughText: {
    textDecorationLine: 'line-through',
    color: '#8B90A4',
  },
  calendarModalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(30, 32, 48, 0.92)',
    justifyContent: 'center',
    alignItems: 'center',
    padding: 20,
  },
  calendarModalContent: {
    width: '100%',
    maxWidth: 340,
    backgroundColor: 'rgba(38, 42, 64, 0.94)',
    borderRadius: 24,
    padding: 18,
    ...THEME.shadow.lifted,
  },
  calendarModalTitle: {
    fontSize: 12,
    fontFamily: FONTS.heavy,
    color: '#0E9594',
    letterSpacing: 2,
    textAlign: 'center',
    marginBottom: 12,
  },
  calendarCloseBtn: {
    marginTop: 16,
    backgroundColor: THEME.glass.surfaceStrong,
    paddingVertical: 14,
    borderRadius: 12,
    alignItems: 'center',
  },
  calendarCloseBtnText: {
    color: '#F4F5FA',
    fontFamily: FONTS.bold,
    fontSize: 12,
    letterSpacing: 1.5,
  },
  calendarPickerBtn: {
    backgroundColor: THEME.glass.inset,
    borderRadius: 12,
    paddingVertical: 14,
    paddingHorizontal: 16,
    marginBottom: 12,
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  calendarPickerBtnText: {
    color: '#EDEDF4',
    fontSize: 14,
    fontFamily: FONTS.semibold,
  },
  questionnaireCard: {
    backgroundColor: THEME.glass.surface,
    borderRadius: 16,
    padding: 16,
    marginBottom: 16,
    ...THEME.shadow.soft,
  },
  questionTitle: {
    color: '#E0A458',
    fontSize: 10,
    fontFamily: FONTS.heavy,
    letterSpacing: 1,
    marginBottom: 8,
    textTransform: 'uppercase',
  },
  optionsRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 6,
    marginBottom: 14,
  },
  optionChip: {
    backgroundColor: THEME.glass.surface,
    borderRadius: 10,
    paddingVertical: 8,
    paddingHorizontal: 12,
  },
  optionChipSelected: {
    backgroundColor: THEME.glass.accentStrong,
  },
  optionText: {
    color: '#F4F5FA',
    fontSize: 11,
    fontFamily: FONTS.semibold,
  },
  optionTextSelected: {
    color: '#0E9594',
    fontFamily: FONTS.bold,
  },
  adviceCard: {
    backgroundColor: THEME.glass.accent,
    borderRadius: 16,
    padding: 16,
    marginTop: 12,
  },
  adviceHeading: {
    color: '#E0A458',
    fontSize: 12,
    fontFamily: FONTS.heavy,
    letterSpacing: 1.5,
    marginBottom: 6,
  },
  adviceBody: {
    fontFamily: FONTS.display,
    color: '#F4F5FA',
    fontSize: 12,
    lineHeight: 18,
  },
  settlementCard: {
    backgroundColor: THEME.glass.surface,
    borderRadius: 16,
    padding: 16,
    marginBottom: 16,
    ...THEME.shadow.soft,
  },
  subscriptionForecastCard: {
    backgroundColor: THEME.glass.surface,
    borderRadius: 16,
    padding: 16,
    marginBottom: 16,
    ...THEME.shadow.soft,
  },
  floatingMenuButton: {
    position: 'absolute',
    top: Platform.OS === 'ios' ? 12 : 16,
    left: 16,
    width: 46,
    height: 46,
    borderRadius: 23,
    backgroundColor: 'rgba(38, 42, 64, 0.82)',
    justifyContent: 'center',
    alignItems: 'center',
    zIndex: 50,
    ...THEME.shadow.soft,
  },
  drawerBackdrop: {
    position: 'absolute',
    top: 0,
    bottom: 0,
    left: 0,
    right: 0,
    backgroundColor: 'transparent',
    zIndex: 999,
  },
  drawerPanel: {
    position: 'absolute',
    top: 0,
    bottom: 0,
    left: 0,
    width: 280,
    backgroundColor: 'rgba(30, 32, 48, 0.96)',
    paddingTop: Platform.OS === 'ios' ? 60 : 40,
    paddingHorizontal: 20,
    zIndex: 1000,
    shadowColor: '#000',
    shadowOffset: { width: 8, height: 0 },
    shadowOpacity: 0.45,
    shadowRadius: 24,
    elevation: 20,
  },
  drawerFooter: {
    marginTop: 'auto',      // pins branding to the bottom of the drawer column
    paddingTop: 20,
    paddingBottom: Platform.OS === 'ios' ? 28 : 20,
  },
  drawerBrand: {
    fontFamily: FONTS.displayBold,
    fontSize: 22,
    color: '#0E9594',
    letterSpacing: 2,
  },
  drawerBrandTag: {
    fontFamily: FONTS.body,
    fontSize: 12,
    color: '#8B90A4',
    marginTop: 2,
  },
  drawerVersion: {
    fontFamily: FONTS.medium,
    fontSize: 11,
    color: '#5A6078',
    marginTop: 8,
  },
  drawerProfileSection: {
    alignItems: 'center',
    paddingBottom: 24,
    marginBottom: 24,
  },
  drawerAvatar: {
    width: 68,
    height: 68,
    borderRadius: 34,
    backgroundColor: THEME.glass.accentStrong,
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 12,
    ...THEME.shadow.glowAccent,
  },
  drawerAvatarText: {
    fontSize: 24,
    fontFamily: FONTS.bold,
    color: '#0E9594',
  },
  drawerProfileName: {
    fontSize: 18,
    fontFamily: FONTS.bold,
    color: '#EDEDF4',
  },
  drawerProfileEmail: {
    fontFamily: FONTS.body,
    fontSize: 13,
    color: '#8B90A4',
    marginTop: 2,
    marginBottom: 8,
  },
  drawerPartnerRow: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: THEME.glass.accent,
    paddingVertical: 6,
    paddingHorizontal: 12,
    borderRadius: 12,
  },
  drawerPartnerText: {
    fontSize: 11,
    fontFamily: FONTS.semibold,
    color: '#E0A458',
  },
  drawerMenuItem: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 14,
    paddingHorizontal: 12,
    borderRadius: 8,
    marginBottom: 8,
    backgroundColor: 'rgba(237, 237, 244, 0.02)',
  },
  drawerMenuItemLogout: {
    marginTop: 'auto',
    marginBottom: Platform.OS === 'ios' ? 40 : 24,
    backgroundColor: 'rgba(242, 71, 34, 0.05)',
  },
  drawerMenuText: {
    fontSize: 15,
    fontFamily: FONTS.semibold,
    color: '#EDEDF4',
  },
  settingsModalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(30, 32, 48, 0.95)',
    justifyContent: 'center',
    alignItems: 'center',
    padding: 20,
  },
  settingsModalContent: {
    width: '100%',
    maxWidth: 360,
    backgroundColor: 'rgba(30, 32, 48, 0.95)',
    borderRadius: 24,
    padding: 22,
    ...THEME.shadow.lifted,
  },
  settingsHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 20,
    paddingBottom: 12,
  },
  settingsTitle: {
    fontSize: 13,
    fontFamily: FONTS.heavy,
    color: '#0E9594',
    letterSpacing: 1.5,
  },
  settingsBody: {
    maxHeight: 400,
  },
  settingsSection: {
    marginBottom: 20,
    paddingBottom: 16,
  },
  settingsSectionTitle: {
    fontSize: 11,
    fontFamily: FONTS.heavy,
    color: '#E0A458',
    letterSpacing: 1.5,
    marginBottom: 12,
    textTransform: 'uppercase',
  },
  settingsInput: {
    fontFamily: FONTS.body,
    backgroundColor: THEME.glass.inset,
    borderRadius: 12,
    color: '#EDEDF4',
    paddingHorizontal: 14,
    paddingVertical: 12,
    fontSize: 14,
  },
  settingsSaveButton: {
    backgroundColor: '#0E9594',
    paddingVertical: 12,
    borderRadius: 12,
    alignItems: 'center',
    marginTop: 10,
    ...THEME.shadow.glowAccent,
  },
  settingsSaveBtnText: {
    color: '#EDEDF4',
    fontFamily: FONTS.bold,
    fontSize: 12,
    letterSpacing: 1.5,
  },
  settingsHelpText: {
    fontFamily: FONTS.body,
    color: '#8B90A4',
    fontSize: 12,
    lineHeight: 16,
    marginBottom: 12,
  },
  unpairButton: {
    backgroundColor: 'rgba(242, 71, 34, 0.14)',
    paddingVertical: 12,
    borderRadius: 12,
    alignItems: 'center',
  },
  unpairBtnText: {
    color: '#F24722',
    fontFamily: FONTS.bold,
    fontSize: 12,
    letterSpacing: 1.5,
  },

  // ---- Navigation / Todo / Complaint / Updates additions -------------------
  backRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 12,
    alignSelf: 'flex-start',
  },
  backRowText: {
    color: '#0E9594',
    fontSize: 14,
    fontFamily: FONTS.bold,
    marginLeft: 4,
  },
  navGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    justifyContent: 'space-between',
    marginBottom: 4,
  },
  navCard: {
    width: '48%',
    backgroundColor: THEME.glass.inset,
    borderRadius: THEME.borderRadius.md,
    paddingVertical: 22,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 12,
    ...THEME.shadow.soft,
  },
  navCardLabel: {
    color: '#F4F5FA',
    fontSize: 13,
    fontFamily: FONTS.bold,
    marginTop: 8,
    letterSpacing: 0.3,
  },

  // ---- Daily check-in ----
  streakPill: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    paddingHorizontal: 10,
    paddingVertical: 5,
    borderRadius: THEME.borderRadius.round,
    backgroundColor: 'rgba(224, 164, 88, 0.16)',
  },
  streakPillText: {
    color: '#E0A458',
    fontSize: 12,
    fontFamily: FONTS.bold,
    letterSpacing: 0.3,
  },
  checkInPrompt: {
    color: '#F4F5FA',
    fontSize: 14,
    fontFamily: FONTS.medium,
    marginTop: 10,
    marginBottom: 12,
  },
  checkInEmojiRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
  },
  checkInEmojiBtn: {
    flex: 1,
    marginHorizontal: 3,
    paddingVertical: 10,
    borderRadius: THEME.borderRadius.sm,
    backgroundColor: THEME.glass.inset,
    alignItems: 'center',
    justifyContent: 'center',
  },
  checkInEmojiBtnActive: {
    backgroundColor: THEME.glass.accentStrong,
    ...THEME.shadow.glowAccent,
  },
  checkInEmoji: {
    fontSize: 22,
  },
  checkInEmojiLabel: {
    color: '#8B90A4',
    fontSize: 10,
    fontFamily: FONTS.semibold,
    marginTop: 4,
    letterSpacing: 0.2,
  },
  checkInPartnerRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginTop: 16,
    paddingTop: 14,
    borderTopWidth: StyleSheet.hairlineWidth,
    borderTopColor: THEME.colors.border,
  },
  checkInPartnerLabel: {
    color: '#EDEDF4',
    fontSize: 13,
    fontFamily: FONTS.bold,
  },
  checkInPartnerValue: {
    color: '#9AA0B6',
    fontSize: 12,
    fontFamily: FONTS.body,
    marginTop: 2,
  },
  checkInPartnerMuted: {
    color: '#5A6078',
    fontSize: 12,
    fontFamily: FONTS.body,
    marginTop: 2,
  },

  // ---- Milestones / On this day ----
  onThisDayRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginTop: 12,
  },
  onThisDayEmoji: {
    fontSize: 24,
    marginRight: 12,
  },
  onThisDayTitle: {
    color: '#EDEDF4',
    fontSize: 15,
    fontFamily: FONTS.semibold,
  },
  onThisDayToday: {
    color: '#0E9594',
    fontSize: 12,
    fontFamily: FONTS.bold,
    marginTop: 2,
  },
  onThisDaySub: {
    color: '#8B90A4',
    fontSize: 12,
    fontFamily: FONTS.medium,
    marginTop: 2,
  },
  onThisDayManage: {
    marginTop: 14,
    alignSelf: 'flex-start',
  },
  onThisDayManageText: {
    color: '#0E9594',
    fontSize: 12,
    fontFamily: FONTS.bold,
    letterSpacing: 0.3,
  },
  milestoneEmojiChip: {
    width: 44,
    height: 44,
    borderRadius: THEME.borderRadius.sm,
    backgroundColor: THEME.glass.inset,
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 8,
    marginBottom: 8,
  },
  milestoneRowEmoji: {
    fontSize: 22,
    marginRight: 12,
  },
  vocabWord: {
    color: '#EDEDF4',
    fontSize: 22,
    fontFamily: FONTS.displayBold,
    marginTop: 6,
  },
  vocabMeaning: {
    fontFamily: FONTS.body,
    color: '#F4F5FA',
    fontSize: 14,
    marginTop: 6,
    lineHeight: 20,
  },
  vocabExample: {
    fontFamily: FONTS.display,
    color: '#8B90A4',
    fontSize: 13,
    fontStyle: 'italic',
    marginTop: 8,
  },
  statusChip: {
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 10,
    marginLeft: 8,
  },
  ticketRow: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: THEME.glass.inset,
    borderRadius: 14,
    padding: 14,
    marginTop: 10,
  },
  ticketTitle: {
    color: '#EDEDF4',
    fontSize: 15,
    fontFamily: FONTS.bold,
  },
  replyBubble: {
    borderRadius: 14,
    padding: 10,
    maxWidth: '88%',
  },
  replyMine: {
    backgroundColor: 'rgba(14, 149, 148,0.16)',
    alignSelf: 'flex-end',
  },
  replyTheirs: {
    backgroundColor: THEME.glass.inset,
    alignSelf: 'flex-start',
  },
  secondaryButton: {
    height: 46,
    borderRadius: THEME.borderRadius.sm,
    backgroundColor: THEME.glass.inset,
    alignItems: 'center',
    justifyContent: 'center',
  },
  secondaryBtnText: {
    color: '#F4F5FA',
    fontFamily: FONTS.bold,
    fontSize: 13,
    letterSpacing: 0.3,
  },
  updateEntry: {
    backgroundColor: THEME.glass.inset,
    borderRadius: 12,
    padding: 12,
    marginTop: 10,
  },
  updateVersion: {
    color: '#0E9594',
    fontSize: 13,
    fontFamily: FONTS.heavy,
  },
  updateDate: {
    fontFamily: FONTS.body,
    color: '#8B90A4',
    fontSize: 11,
  },
  updateTitle: {
    color: '#EDEDF4',
    fontSize: 14,
    fontFamily: FONTS.bold,
    marginTop: 4,
  },
  updateBody: {
    fontFamily: FONTS.body,
    color: '#F4F5FA',
    fontSize: 13,
    marginTop: 4,
    lineHeight: 18,
  },
  unseenDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
    backgroundColor: '#0E9594',
    marginLeft: 8,
  },
});
