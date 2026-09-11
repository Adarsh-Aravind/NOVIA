import React, { useState, useEffect, useMemo, useRef } from 'react';
import {
  StyleSheet,
  Text,
  View,
  TextInput,
  TouchableOpacity,
  ScrollView,
  SafeAreaView,
  StatusBar,
  Platform,
  Alert,
  Keyboard,
  KeyboardAvoidingView,
  Animated,
  Easing,
  Modal,
  AppState,
  Dimensions,
  BackHandler,
  Linking,
  PanResponder
} from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { Calendar } from 'react-native-calendars';
import Constants from 'expo-constants';
import * as Updates from 'expo-updates';
import { Menu, Settings as SettingsIcon, LogOut, X, Heart, Check, Square, CheckSquare, Home, FileText, Wallet, Activity, ListChecks, MessageSquareWarning, ChevronLeft, Plus, Send, BookOpen, Sparkles, ScrollText, CalendarHeart, Flame, Footprints, Trophy, ArrowUpRight, ArrowDownLeft, BellRing, BatteryWarning, Pencil } from 'lucide-react-native';
import Svg, { Defs, LinearGradient as SvgLinearGradient, RadialGradient, Rect, Stop } from 'react-native-svg';
import * as Notifications from 'expo-notifications';
import { TodoRecurrence, AppUpdate, Milestone, MilestoneRecurrence } from './src/types';
import { useAuth } from './src/hooks/useAuth';
import { useRealtimeNotes } from './src/hooks/useRealtimeNotes';
import { useMood } from './src/hooks/useMood';
import { useTodos } from './src/hooks/useTodos';
import { usePeriods } from './src/hooks/usePeriods';
import { useComplaints } from './src/hooks/useComplaints';
import { useMilestones } from './src/hooks/useMilestones';
import { useSteps } from './src/hooks/useSteps';
import { Skeleton } from './src/components/common/Skeleton';
import { HubSkeleton } from './src/components/common/HubSkeleton';
import { Avatar } from './src/components/common/Avatar';
import { GlassBacking, GlassCard } from './src/components/common/GlassCard';
import { StepGraph } from './src/components/common/StepGraph';
import { configureNotificationsAsync, PRIORITY_CHANNEL } from './src/services/notification';
import { cancelScheduledNotificationsByPrefix, scheduleLocalNotification } from './src/services/notification';
import { supabase } from './src/services/supabase';
import { applyPendingUpdate, checkAndApplyUpdate, fetchAppUpdates, fetchUpdateInBackground, getLastSeenUpdateAt, markUpdatesSeen, unseenUpdates } from './src/services/updates';
import { claimNotification, getOrCreateBaseline, pruneNotifiedMarkers } from './src/services/notifyOnce';
import { withLock } from './src/utils/asyncLock';
import { parseLocalDate } from './src/utils/dateUtils';
import { directionFor, useTransactions } from './src/hooks/useTransactions';
import { pickProfilePhoto } from './src/services/profilePhoto';
import { openSettings as openListenerSettings, requestIgnoreBatteryOptimizations } from './modules/notification-listener';
import {
  daysUntilNext,
  elapsedAt,
  formatElapsed,
  nextOccurrence,
  occursOn,
} from './src/utils/milestoneMath';
import { BucketListItem, MedicalRecord } from './src/types';
import { getWordOfDay } from './src/constants/vocabulary';
import { ChatMessage, chatWithAI, generateIdeas } from './src/services/groq';
import { useFonts } from 'expo-font';
import { Fraunces_600SemiBold } from '@expo-google-fonts/fraunces/600SemiBold';
import { Fraunces_700Bold } from '@expo-google-fonts/fraunces/700Bold';
import { Manrope_400Regular } from '@expo-google-fonts/manrope/400Regular';
import { Manrope_500Medium } from '@expo-google-fonts/manrope/500Medium';
import { Manrope_600SemiBold } from '@expo-google-fonts/manrope/600SemiBold';
import { Manrope_700Bold } from '@expo-google-fonts/manrope/700Bold';
import { Manrope_800ExtraBold } from '@expo-google-fonts/manrope/800ExtraBold';
import { alpha, FONTS, PALETTE, THEME } from './src/constants/theme';
import { SPRING, projectMomentum } from './src/constants/motion';
import { useReducedMotion } from './src/hooks/useReducedMotion';

// Quick emoji reactions available on each shared note.
const NOTE_REACTIONS = ['❤️', '😂', '👍', '🥺', '🔥'] as const;

/**
 * Idea starters. A blank prompt box is the hardest question in the app, so
 * these give the feature an obvious first move. Phrased as things someone
 * would actually ask, not as feature names.
 */
const IDEA_STARTERS = [
  'Date ideas this weekend',
  'A cheap night in',
  'Gift ideas',
  'Something to cheer her up',
] as const;

// Emoji palette offered when creating a milestone.
const MILESTONE_EMOJIS = ['💛', '💍', '🌹', '🎉', '✈️', '🏡', '🎂', '⭐'] as const;

const PHASE_COLORS = THEME.colors.phase;

/**
 * Payment apps, by package name. Anything not listed still logs correctly —
 * the label just falls back to nothing rather than showing a raw package.
 */
const PAYMENT_APPS: Record<string, string> = {
  'com.google.android.apps.nbu.paisa.user': 'Google Pay',
  'com.phonepe.app': 'PhonePe',
  'net.one97.paytm': 'Paytm',
  'com.paypal.android.p2pmobile': 'PayPal',
  'com.sbi.lotusintouch': 'SBI',
  // Synthetic: a bank SMS rather than an app notification. The couple's own
  // bank texts every UPI transfer, which makes this the common case.
  'android.sms': 'Bank SMS',
};

/** Extra names to match a payment against, beyond the partner's profile name. */
const PARTNER_ALIAS_KEY = 'novia.payments.partnerAliases';

/**
 * Indian digit grouping — 1,00,000 rather than 100,000.
 *
 * Worth the eight lines: these are rupee amounts read by two people in India,
 * and western grouping is the kind of small wrongness that makes an app feel
 * like it was built for somewhere else.
 */
function formatAmount(value: number): string {
  const fixed = value % 1 === 0 ? String(Math.round(value)) : value.toFixed(2);
  const [whole, fraction] = fixed.split('.');
  const last3 = whole.slice(-3);
  const rest = whole.slice(0, -3);
  const grouped = rest ? `${rest.replace(/\B(?=(\d{2})+(?!\d))/g, ',')},${last3}` : last3;
  return fraction ? `${grouped}.${fraction}` : grouped;
}

/**
 * The hub greeting. Morning until noon, afternoon until five, evening after —
 * and the small hours get "evening" too rather than a "good night" that reads
 * like a farewell to someone who just opened the app.
 */
function greetingForHour(hour: number): string {
  if (hour >= 5 && hour < 12) return 'Good Morning';
  // Both bounds, not just the upper one: `hour < 17` alone sweeps up 1am as
  // afternoon, because the morning test above has already failed by then.
  if (hour >= 12 && hour < 17) return 'Good Afternoon';
  return 'Good Evening';
}

/** 'Today' / 'Yesterday' / '8 Sep' — the heading a run of payments sits under. */
function formatDayLabel(iso: string): string {
  const date = new Date(iso);
  const today = new Date();
  const startOf = (d: Date) => new Date(d.getFullYear(), d.getMonth(), d.getDate()).getTime();
  const days = Math.round((startOf(today) - startOf(date)) / 86_400_000);
  if (days === 0) return 'Today';
  if (days === 1) return 'Yesterday';
  return date.toLocaleDateString(undefined, { day: 'numeric', month: 'short' });
}

function formatClock(iso: string): string {
  return new Date(iso).toLocaleTimeString(undefined, { hour: 'numeric', minute: '2-digit' });
}

/**
 * The ground: one neon-orange source burning in the top-left corner, falling
 * away along the diagonal into black.
 *
 * Three details do most of the work:
 *
 * The light is anchored *off-canvas* (cx -6%, cy -4%) rather than at the
 * corner. A radial gradient centred exactly on the corner puts its hottest,
 * flattest point on screen and reads as a sticker; pushing the origin just
 * outside means only the falloff is visible, which is what an actual light
 * source spilling in from beyond the frame looks like.
 *
 * The stops are front-loaded — most of the drop happens in the first 30% —
 * because linear falloff over a whole screen reads as a wash rather than as
 * light. And a single dim ember at the far corner keeps the diagonal from
 * dying into flat black, so the ground still has somewhere to go.
 *
 * There is deliberately no grain overlay. One was tried twice — an SVG
 * feTurbulence filter (which react-native-svg does not implement on native, so
 * it rendered nothing at all) and then a tiled noise texture (which did render,
 * and looked worse). On this backdrop the gradient reads cleaner without it.
 */
function SpaceBackdrop() {
  return (
    <Svg pointerEvents="none" style={StyleSheet.absoluteFill} width="100%" height="100%" viewBox="0 0 390 844" preserveAspectRatio="xMidYMid slice">
      <Defs>
        {/* Key light: neon orange spilling in from beyond the top-left corner */}
        <RadialGradient id="cornerBurn" cx="-8%" cy="-5%" r="175%" fx="-8%" fy="-5%">
          <Stop offset="0%" stopColor={PALETTE.accent} stopOpacity="0.98" />
          <Stop offset="16%" stopColor={PALETTE.accent} stopOpacity="0.72" />
          <Stop offset="31%" stopColor={PALETTE.accent} stopOpacity="0.42" />
          <Stop offset="46%" stopColor={PALETTE.accent} stopOpacity="0.22" />
          <Stop offset="62%" stopColor={PALETTE.accentHot} stopOpacity="0.10" />
          <Stop offset="80%" stopColor={PALETTE.accentHot} stopOpacity="0.035" />
          <Stop offset="100%" stopColor={PALETTE.ground} stopOpacity="0" />
        </RadialGradient>

        {/* A last ember at the far corner, so the diagonal has an end and not
            just an absence. Barely perceptible on its own. */}
        <RadialGradient id="farEmber" cx="104%" cy="102%" r="72%" fx="104%" fy="102%">
          <Stop offset="0%" stopColor={PALETTE.accentHot} stopOpacity="0.10" />
          <Stop offset="46%" stopColor={PALETTE.accentHot} stopOpacity="0.03" />
          <Stop offset="100%" stopColor={PALETTE.ground} stopOpacity="0" />
        </RadialGradient>

        {/* Bottom fade so content sinks away behind the floating tab dock */}
        <SvgLinearGradient id="bottomFade" x1="0%" y1="100%" x2="0%" y2="0%">
          <Stop offset="0%" stopColor={PALETTE.ground} stopOpacity="1.0" />
          <Stop offset="28%" stopColor={PALETTE.ground} stopOpacity="1.0" />
          <Stop offset="38%" stopColor={PALETTE.ground} stopOpacity="0.95" />
          <Stop offset="55%" stopColor={PALETTE.ground} stopOpacity="0.40" />
          <Stop offset="80%" stopColor={PALETTE.ground} stopOpacity="0" />
        </SvgLinearGradient>

      </Defs>

      {/* Black base layer */}
      <Rect width="390" height="844" fill={PALETTE.ground} />

      {/* The diagonal: burn in the top-left, ember in the bottom-right */}
      <Rect width="390" height="844" fill="url(#cornerBurn)" />
      <Rect width="390" height="844" fill="url(#farEmber)" />

      {/* Bottom atmospheric fade covering the area below the pill taskbar */}
      <Rect width="390" height="844" fill="url(#bottomFade)" />

    </Svg>
  );
}

const AnimatedTouchable = Animated.createAnimatedComponent(TouchableOpacity);

/**
 * PressableScale — a touchable that gently springs inward on press.
 * Gives every interactive glass surface a soft, tactile neumorphic response.
 *
 * Two details that separate this from a plain TouchableOpacity:
 *
 * The scale fires on press *down*, not on release. The instant feedback is the
 * whole point — waiting for touch-up to acknowledge a press is the single
 * loudest way an interface reads as laggy, and no amount of animation polish
 * afterwards recovers it.
 *
 * Both directions use the same critically-damped spring. The release used to
 * bounce (`bounciness: 7`), but a finger lifting off carries no momentum into
 * the element, so the overshoot was decoration pretending to be physics. Bounce
 * belongs on motion a gesture actually threw — see SPRING.flick.
 *
 * The default hitSlop is deliberate: the touch target should extend past the
 * visible bounds, so a press that lands a few pixels off still reads as a hit.
 */
const PRESS_HIT_SLOP = { top: 10, bottom: 10, left: 10, right: 10 };

function PressableScale({
  children,
  onPress,
  onLongPress,
  style,
  scaleTo = 0.96,
  disabled = false,
  activeOpacity = 0.92,
  hitSlop = PRESS_HIT_SLOP,
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
    Animated.spring(scale, { toValue: scaleTo, useNativeDriver: true, ...SPRING.press }).start();
  const pressOut = () =>
    Animated.spring(scale, { toValue: 1, useNativeDriver: true, ...SPRING.press }).start();
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
 * SubmitButton — a primary action button that guards against double-submits.
 *
 * Every send/save handler here does a network round-trip (a Supabase insert)
 * before the UI updates. With a plain TouchableOpacity, a second tap during that
 * window fires the same insert again — the reported "send it twice" bug — and the
 * button feels dead ("delay in sending"). This wraps the async onPress: re-taps
 * are ignored while one is in flight (a synchronous ref guard, so it holds even
 * against a fast double-tap within one frame), and the button dims to show it's
 * working. Drop-in replacement for the primaryButton TouchableOpacity.
 */
function SubmitButton({
  children,
  onPress,
  style,
  disabled = false,
  activeOpacity = 0.85,
}: {
  children: React.ReactNode;
  onPress?: () => void | Promise<unknown>;
  style?: any;
  disabled?: boolean;
  activeOpacity?: number;
}) {
  const inFlight = useRef(false);
  const [busy, setBusy] = useState(false);
  const mounted = useRef(true);
  // The primary CTA was the *least* responsive control in the app: every glass
  // surface sprang under the finger via PressableScale, while the button you
  // actually came to press only dimmed. Same press spring, same instant
  // acknowledgement — the dim on top now reads as "working", not as the only
  // feedback there is.
  const scale = useRef(new Animated.Value(1)).current;
  useEffect(() => () => { mounted.current = false; }, []);

  const springTo = (toValue: number) =>
    Animated.spring(scale, { toValue, useNativeDriver: true, ...SPRING.press }).start();

  const handlePress = async () => {
    if (inFlight.current || disabled) return;
    inFlight.current = true;
    setBusy(true);
    try {
      await onPress?.();
    } finally {
      inFlight.current = false;
      if (mounted.current) setBusy(false);
    }
  };

  return (
    <AnimatedTouchable
      style={[style, busy && { opacity: 0.6 }, { transform: [{ scale }] }]}
      onPress={handlePress}
      onPressIn={() => springTo(0.97)}
      onPressOut={() => springTo(1)}
      disabled={disabled || busy}
      activeOpacity={activeOpacity}
      hitSlop={PRESS_HIT_SLOP}
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
  const reducedMotion = useReducedMotion();
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

  // Reduced motion keeps the fade — it still communicates "this is arriving" —
  // and drops only the travel, which is the part that provokes motion
  // sensitivity. Cutting the animation entirely would lose the staggering that
  // tells you the cards are a sequence, not one wall of content.
  const travel = reducedMotion ? 0 : distance;

  return (
    <Animated.View
      style={[
        style,
        {
          opacity: anim,
          transform: [
            { translateY: anim.interpolate({ inputRange: [0, 1], outputRange: [travel, 0] }) },
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
  const reducedMotion = useReducedMotion();
  useEffect(() => {
    // A full-viewport brightness oscillation with a ~10s period sits squarely in
    // the band that provokes motion sensitivity — a slow ambient pulse is the
    // textbook case for honouring reduce-motion. Hold it at the bright end so
    // the backdrop keeps its intended look, just without the breathing.
    if (reducedMotion) {
      anim.setValue(1);
      return;
    }
    const loop = Animated.loop(
      Animated.sequence([
        Animated.timing(anim, { toValue: 1, duration, easing: Easing.inOut(Easing.sin), useNativeDriver: true }),
        Animated.timing(anim, { toValue: 0, duration, easing: Easing.inOut(Easing.sin), useNativeDriver: true }),
      ])
    );
    loop.start();
    return () => loop.stop();
  }, [anim, duration, reducedMotion]);

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
  const reducedMotion = useReducedMotion();

  useEffect(() => {
    if (size.width === 0 || reducedMotion) return;
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
  }, [anim, delay, period, size.width, reducedMotion]);

  const band = Math.max(size.height * 1.6, 48);

  // Pure decoration with no informational job — under reduce-motion it simply
  // shouldn't exist, rather than being animated more gently.
  if (reducedMotion) return null;

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
            backgroundColor: alpha(THEME.ink[95], 0.07),
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
 *
 * The driver holds the *progress itself* (0..1), not a generic 0→1 ramp. An
 * earlier version always animated the driver to 1 and folded `target` into the
 * output range: once it had reached 1, a new target only changed the range, so
 * every later value snapped into place instead of sliding — the step bars never
 * animated after their first paint. Animating the driver *to* the target keeps
 * the interpolations constant and makes each update a real transition from
 * wherever the bar currently sits.
 *
 * And it's a spring, not a 900ms easing curve, because the value behind it
 * moves on its own schedule: a step count arrives from a partner's phone
 * whenever it arrives, sometimes twice within a second. A timing curve
 * re-targeted mid-flight restarts from the head of its easing, so the bar
 * visibly stutters; a spring re-targets from its current position *and*
 * current velocity, so consecutive updates read as one continuous movement.
 */
function AnimatedBar({
  progress,
  color,
  trackStyle,
  fillStyle,
}: {
  progress: number; // 0..1
  color: string;
  trackStyle?: any;
  fillStyle?: any;
}) {
  const anim = useRef(new Animated.Value(0)).current;
  const [width, setWidth] = useState(0);
  const reducedMotion = useReducedMotion();
  const target = Math.max(0, Math.min(1, Number.isFinite(progress) ? progress : 0));

  useEffect(() => {
    if (width === 0) return; // wait for measurement, otherwise the maths is meaningless
    if (reducedMotion) {
      anim.setValue(target);
      return;
    }
    const animation = Animated.spring(anim, {
      toValue: target,
      useNativeDriver: true,
      ...SPRING.move,
    });
    animation.start();
    return () => animation.stop();
  }, [anim, width, target, reducedMotion]);

  return (
    <View
      style={[styles.progressBarBg, trackStyle]}
      onLayout={(e) => setWidth(e.nativeEvent.layout.width)}
    >
      {width > 0 && (
        <Animated.View
          style={[
            styles.progressBarFill,
            fillStyle,
            {
              width: '100%',
              backgroundColor: color,
              transform: [
                // p → (p - 1) * width / 2, i.e. -width/2 at empty, 0 at full.
                { translateX: anim.interpolate({ inputRange: [0, 1], outputRange: [-width / 2, 0] }) },
                { scaleX: anim },
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
  const reducedMotion = useReducedMotion();
  useEffect(() => {
    anim.setValue(0);
    Animated.timing(anim, {
      toValue: 1,
      duration: 440,
      easing: Easing.out(Easing.cubic),
      useNativeDriver: true,
    }).start();
  }, []);
  // A whole screen rising and scaling is the largest single movement in the
  // app; under reduce-motion it becomes a plain cross-fade, which still marks
  // the screen change without the travel.
  const travel = reducedMotion ? 0 : 18;
  const from = reducedMotion ? 1 : 0.985;
  return (
    <Animated.View
      style={{
        opacity: anim,
        transform: [
          { translateY: anim.interpolate({ inputRange: [0, 1], outputRange: [travel, 0] }) },
          { scale: anim.interpolate({ inputRange: [0, 1], outputRange: [from, 1] }) },
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
  ai: Sparkles,
  health: Activity,
  menu: Menu,
};

// Hub sub-screens reachable from Hub cards (not on the tab bar). The device
// back button and their on-screen back rows both return from these to the Hub.
const HUB_SUBSCREENS = ['todos', 'milestones', 'complaints', 'bucket', 'health'];

/**
 * The menu is full-screen, so the panel's width is the window's.
 *
 * Shared by the panel style, the slide transform and the drag maths, which is
 * why this one line is most of what "make it full screen" means. The gesture
 * needs no re-tuning: it works in progress units, so a wider panel is simply a
 * longer drag for the same fraction.
 *
 * Read once at module load, like ANDROID_NAV_INSET above — the app is
 * portrait-locked, so there is no rotation for this to go stale against.
 */
const DRAWER_WIDTH = Dimensions.get('window').width;

/** The credit line in the menu footer links here. */
const DEVELOPER_URL = 'https://www.adarsharavind.com';

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
  const reducedMotion = useReducedMotion();

  useEffect(() => {
    if (!onBar) return;
    if (reducedMotion) {
      indicator.setValue(activeIndex);
      return;
    }
    // Critically damped, not the old bounciness: 9. A tab is selected by a tap,
    // and a tap imparts no momentum for the indicator to overshoot with — the
    // bounce was the indicator claiming physics that never happened. It now
    // glides and stops exactly where the finger said.
    Animated.spring(indicator, {
      toValue: activeIndex,
      useNativeDriver: true,
      ...SPRING.snap,
    }).start();
  }, [activeIndex, onBar, indicator, reducedMotion]);

  const translateX = indicator.interpolate({
    inputRange: tabs.map((_, i) => i),
    outputRange: tabs.map((_, i) => INNER_PAD + i * slotW),
  });

  return (
    <View style={[styles.tabBar, { bottom: TAB_BAR_BOTTOM }]} onLayout={(e) => setBarW(e.nativeEvent.layout.width)}>
      <GlassBacking radius={34} tier="chrome" />
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
              color={isActive ? THEME.colors.primary : alpha(THEME.ink[95], 0.55)}
              strokeWidth={isActive ? 2.5 : 2}
            />
          </PressableScale>
        );
      })}
    </View>
  );
}

/**
 * A bucket-list row that acknowledges the tap and commits it at the same time.
 *
 * This used to run a six-step, 720ms blink and fire onToggle() in the
 * completion callback — the outcome was gated behind the decoration, so ticking
 * an item took the better part of a second and re-tapping during the blink did
 * nothing. Feedback and commit are now concurrent: the checkbox flips on the
 * frame you lift your finger (the parent updates optimistically), and a single
 * confirming pulse plays over the top rather than three flashes demanding
 * attention the action doesn't warrant.
 */
const BlinkingBucketRow = ({ item, getCreatorName, onToggle, onDelete }: { item: any; getCreatorName: (creatorId?: string | null) => string; onToggle: () => void; onDelete: () => void }) => {
  const blinkAnim = React.useRef(new Animated.Value(1)).current;
  const scale = React.useRef(new Animated.Value(1)).current;
  const reducedMotion = useReducedMotion();

  const handlePress = () => {
    onToggle();
    if (reducedMotion) return;
    Animated.sequence([
      Animated.timing(blinkAnim, { toValue: 0.45, duration: 90, useNativeDriver: true }),
      Animated.spring(blinkAnim, { toValue: 1, useNativeDriver: true, ...SPRING.snap }),
    ]).start();
  };

  const springTo = (toValue: number) =>
    Animated.spring(scale, { toValue, useNativeDriver: true, ...SPRING.press }).start();

  return (
    <Animated.View style={{ opacity: blinkAnim, transform: [{ scale }] }}>
      <TouchableOpacity
        style={[
          styles.bucketRow,
        ]}
        onPress={handlePress}
        onPressIn={() => springTo(0.98)}
        onPressOut={() => springTo(1)}
        activeOpacity={0.7}
      >
        <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' }}>
          <View style={{ flexDirection: 'row', alignItems: 'center', flex: 1, paddingRight: 8 }}>
            {item.is_completed ? (
              <CheckSquare size={18} color={THEME.colors.primary} strokeWidth={2} />
            ) : (
              <Square size={18} color={alpha(THEME.ink[95], 0.5)} strokeWidth={2} />
            )}
            <Text style={[styles.bucketText, item.is_completed && styles.strikethrough, { marginLeft: 8 }]}>
              {item.title}
            </Text>
          </View>
          <View style={{ flexDirection: 'row', alignItems: 'center' }}>
            <Text style={[styles.metaLine, { fontSize: 10, opacity: 0.6, marginRight: 12 }]}>By {getCreatorName(item.created_by)}</Text>
            <TouchableOpacity 
              onPress={(e) => {
                e.stopPropagation();
                onDelete();
              }}
              style={{
                width: 26,
                height: 26,
                borderRadius: 13,
                backgroundColor: alpha(THEME.colors.danger, 0.16),
                alignItems: 'center',
                justifyContent: 'center',
              }}
            >
              <X size={12} color={THEME.colors.danger} strokeWidth={2.5} />
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
  const [activeTab, setActiveTab] = useState<'hub' | 'notes' | 'finances' | 'health' | 'ai' | 'bucket' | 'todos' | 'complaints' | 'milestones'>('hub');

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
    updateAvatar,
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

  const { notes, isPartnerTyping, setTyping: setNoteTyping, addNote, removeNote, toggleReaction } = useRealtimeNotes(coupleId, userId);
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
    mySteps,
    partnerSteps,
    series: stepSeries,
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

  // --- Detected payments ---
  /**
   * Extra names to match against, kept on the device.
   *
   * The name a payment app shows is whatever the bank has on file, and it is
   * routinely not the name in the app's profile — "G Udhayan", a maiden name,
   * an initial. Rather than guess at those, the screen lets the user add the
   * name they actually see, which is the only reliable source for it.
   */
  const [customAliases, setCustomAliases] = useState<string[]>([]);
  const [aliasSheetOpen, setAliasSheetOpen] = useState(false);
  const [aliasDraft, setAliasDraft] = useState('');

  useEffect(() => {
    AsyncStorage.getItem(PARTNER_ALIAS_KEY)
      .then((raw) => {
        if (raw) setCustomAliases(JSON.parse(raw));
      })
      .catch(() => {
        /* first run, or storage cleared — the profile name alone still works */
      });
  }, []);

  const saveAliases = async () => {
    const parsed = aliasDraft
      .split(',')
      .map((name) => name.trim())
      .filter(Boolean);
    setCustomAliases(parsed);
    setAliasSheetOpen(false);
    try {
      await AsyncStorage.setItem(PARTNER_ALIAS_KEY, JSON.stringify(parsed));
    } catch (e) {
      Alert.alert('Could not save', 'The names will apply until the app restarts.');
    }
  };

  const partnerLabel = partnerProfile?.display_name || partnerName || 'your partner';

  const paymentAliases = useMemo(
    () =>
      [partnerProfile?.display_name, partnerName, ...customAliases].filter(
        (name): name is string => !!name && name.trim().length > 0
      ),
    [partnerProfile?.display_name, partnerName, customAliases]
  );

  const {
    transactions,
    loading: paymentsLoading,
    supported: paymentsSupported,
    permitted: paymentsPermitted,
    batteryExempt: paymentsBatteryExempt,
    smsGranted: paymentsSmsGranted,
    requestSms: requestPaymentsSms,
    permissionsChecked: paymentsChecked,
    recheckPermission: recheckPaymentsPermission,
  } = useTransactions(coupleId, paymentAliases);

  // Either source alone is enough to detect a payment, so the onboarding gate
  // is "at least one", not "both".
  const paymentsListening = paymentsSmsGranted || paymentsPermitted;

  /**
   * Payments grouped into days, newest first. The rows already arrive ordered,
   * so this only has to break the run wherever the day label changes.
   */
  const paymentDays = useMemo(() => {
    const groups: { label: string; items: typeof transactions }[] = [];
    for (const txn of transactions) {
      const label = formatDayLabel(txn.occurred_at);
      const last = groups[groups.length - 1];
      if (last && last.label === label) last.items.push(txn);
      else groups.push({ label, items: [txn] });
    }
    return groups;
  }, [transactions]);
  // --- AI chat ---
  const [chatMessages, setChatMessages] = useState<ChatMessage[]>([]);
  /**
   * Keyboard height, tracked by hand.
   *
   * The composer is absolutely positioned so it stays put while the transcript
   * scrolls, and KeyboardAvoidingView does not move an absolutely positioned
   * child on Android. With edgeToEdgeEnabled the window doesn't resize under it
   * either, so the keyboard simply covered the input — you could not see what
   * you were typing. Listening for the keyboard and offsetting `bottom` is the
   * one approach that holds regardless of soft-input mode.
   */
  const [keyboardHeight, setKeyboardHeight] = useState(0);
  useEffect(() => {
    const show = Keyboard.addListener('keyboardDidShow', (e) =>
      setKeyboardHeight(e.endCoordinates.height)
    );
    const hide = Keyboard.addListener('keyboardDidHide', () => setKeyboardHeight(0));
    return () => {
      show.remove();
      hide.remove();
    };
  }, []);
  const [chatInput, setChatInput] = useState('');
  const [chatLoading, setChatLoading] = useState(false);
  const [chatError, setChatError] = useState<string | null>(null);

  /**
   * The API is stateless, so the whole conversation is resent every turn. Left
   * unbounded that grows without limit until it hits the context window, and
   * every message is paid for again on each send — so only a recent window
   * goes over the wire.
   */
  const CHAT_HISTORY_LIMIT = 20;

  const sendChat = async () => {
    const text = chatInput.trim();
    if (!text || chatLoading) return;

    const next: ChatMessage[] = [...chatMessages, { role: 'user', content: text }];
    setChatMessages(next);
    setChatInput('');
    setChatError(null);
    setChatLoading(true);
    Keyboard.dismiss();

    const { reply, error } = await chatWithAI(next.slice(-CHAT_HISTORY_LIMIT));
    if (error) {
      setChatError(error);
    } else {
      setChatMessages((prev) => [...prev, { role: 'assistant', content: reply }]);
    }
    setChatLoading(false);
  };

  // --- Ideas (reachable from the notes composer menu) ---
  const [ideaPrompt, setIdeaPrompt] = useState('');
  const [ideas, setIdeas] = useState<string[]>([]);
  const [ideasLoading, setIdeasLoading] = useState(false);
  const [ideasError, setIdeasError] = useState<string | null>(null);
  const [ideasSheetOpen, setIdeasSheetOpen] = useState(false);

  const askForIdeas = async (starter?: string) => {
    const prompt = (starter ?? ideaPrompt).trim();
    if (!prompt || ideasLoading) return;
    if (starter) setIdeaPrompt(starter);
    Keyboard.dismiss();
    setIdeasLoading(true);
    setIdeasError(null);
    // Clear the old batch so a slow request can't leave the previous answer
    // sitting under a spinner as though it were the new one.
    setIdeas([]);
    const { ideas: next, error } = await generateIdeas(prompt);
    setIdeas(next);
    setIdeasError(error ?? null);
    setIdeasLoading(false);
  };

  const saveIdeaToNotes = async (idea: string) => {
    const ok = await addNote(idea);
    if (ok) setIdeasSheetOpen(false);
    Alert.alert(
      ok ? 'Saved' : 'Not saved',
      ok ? 'Added to your shared notes.' : 'Could not save that. Check connectivity.'
    );
  };

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

  /**
   * Open/close the drawer on a spring rather than a fixed 250ms curve.
   *
   * `velocity` is the finger's speed at release, in progress-units/second
   * (see DRAWER_WIDTH below). Handing it to the spring is what removes the seam
   * between dragging and animating: without it the panel stops dead at release
   * and restarts from zero, and you feel the handoff as a hitch even though
   * both halves are individually smooth.
   */
  const toggleDrawer = (open: boolean, velocity = 0) => {
    if (open) setIsDrawerOpen(true);
    Animated.spring(drawerAnim, {
      toValue: open ? 1 : 0,
      velocity,
      useNativeDriver: true,
      ...SPRING.sheet,
    }).start(({ finished }) => {
      // Only unmount when the close actually completed. A close interrupted by
      // the user grabbing the panel again must not rip it off screen — the new
      // gesture owns it now.
      if (!open && finished) setIsDrawerOpen(false);
    });
  };

  // Live mirror of drawerAnim. A native-driven value's JS-side copy is only
  // flushed when its animation ends, so a finger landing on a panel that is
  // still moving has to ask a listener where the panel actually *is*. Starting
  // the drag from the logical target instead is what makes a grabbed element
  // jump — the one artifact that gives away a non-interruptible interface.
  const drawerValue = useRef(0);
  const drawerGrabbedAt = useRef(0);
  useEffect(() => {
    const id = drawerAnim.addListener(({ value }) => {
      drawerValue.current = value;
    });
    return () => drawerAnim.removeListener(id);
  }, [drawerAnim]);

  // Swipe-to-close. Created once: everything it closes over is either a ref or
  // a setState function, both stable for the life of the component, so the
  // first-render closure behaves identically to any later one.
  const drawerPan = useRef(
    PanResponder.create({
      // Taps must still reach the menu rows, so don't claim the gesture on
      // touch-down. Claim it only once the finger has moved far enough to mean
      // it (10px of hysteresis) and clearly horizontally — otherwise a slightly
      // diagonal tap would swallow itself.
      onStartShouldSetPanResponder: () => false,
      onMoveShouldSetPanResponder: (_evt, g) =>
        Math.abs(g.dx) > 10 && Math.abs(g.dx) > Math.abs(g.dy) * 1.5,
      // Also claim it on the capture pass. A menu row becomes the responder the
      // moment you touch it, and the bubble pass then has to negotiate it away;
      // capturing means a drag that starts *on* a row still drags the panel
      // instead of being eaten as a press. Nothing inside the drawer wants a
      // horizontal gesture of its own, so there is nothing to steal from.
      onMoveShouldSetPanResponderCapture: (_evt, g) =>
        Math.abs(g.dx) > 10 && Math.abs(g.dx) > Math.abs(g.dy) * 1.5,

      onPanResponderGrant: () => {
        // Interrupt whatever was running and keep the on-screen position: the
        // panel is now glued to the finger from exactly where it was caught.
        drawerAnim.stopAnimation();
        drawerGrabbedAt.current = drawerValue.current;
      },

      onPanResponderMove: (_evt, g) => {
        // 1:1 with the finger, in progress units. Clamped rather than
        // rubber-banded: the panel is pinned to the screen edge at either end,
        // so there is genuinely nowhere further to go — resistance is for
        // boundaries where movement is possible but exhausted, and faking it
        // here would just open a gap along the edge.
        const next = drawerGrabbedAt.current + g.dx / DRAWER_WIDTH;
        drawerAnim.setValue(Math.max(0, Math.min(1, next)));
      },

      onPanResponderRelease: (_evt, g) => {
        // PanResponder reports px/ms; projectMomentum wants px/s.
        const pxPerSecond = g.vx * 1000;
        // Decide on where the flick is *going*, not where the finger let go —
        // that's what makes a quick flick close the drawer even from 80% open.
        const projected =
          drawerValue.current + projectMomentum(pxPerSecond) / DRAWER_WIDTH;
        toggleDrawer(projected > 0.5, pxPerSecond / DRAWER_WIDTH);
      },

      // Gesture stolen by something else — settle back to open rather than
      // stranding the panel mid-slide.
      onPanResponderTerminate: () => toggleDrawer(true),
    })
  ).current;

  const openDeveloperLink = () => {
    // Rejects when nothing on the device can take the intent. A credit line
    // that quietly does nothing beats an alert about a byline.
    Linking.openURL(DEVELOPER_URL).catch(() => {});
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

  // Bucket list
  const [bucketList, setBucketList] = useState<BucketListItem[]>([]);
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
  const [calendarTarget, setCalendarTarget] = useState<'periodStartDate' | 'periodEndDate' | 'hospitalDate' | 'todoDate' | 'milestoneDate' | null>(null);

  const openCalendarFor = (target: 'periodStartDate' | 'periodEndDate' | 'hospitalDate' | 'todoDate' | 'milestoneDate') => {
    setCalendarTarget(target);
    setIsCalendarVisible(true);
  };

  const handleDateSelect = (dateString: string) => {
    if (calendarTarget === 'periodStartDate') setPeriodStartDate(dateString);
    else if (calendarTarget === 'periodEndDate') setPeriodEndDate(dateString);
    else if (calendarTarget === 'hospitalDate') setHospitalDate(dateString);
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
  const [medLogs, setMedLogs] = useState<MedicalRecord[]>([]);
  const [openMedLog, setOpenMedLog] = useState<MedicalRecord | null>(null); // detail modal
  const [hospitalDate, setHospitalDate] = useState('');
  const [hospitalReason, setHospitalReason] = useState('');
  const [hospitalResults, setHospitalResults] = useState('');

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

    fetchSharedBucketList();

    const bucketChannel = supabase
      .channel(`bucket-sync:${coupleId}`)
      .on('postgres_changes', { event: '*', schema: 'public', table: 'bucket_list', filter: `couple_id=eq.${coupleId}` }, fetchSharedBucketList)
      .subscribe();

    return () => {
      supabase.removeChannel(bucketChannel);
    };
  }, [coupleId]);

  useEffect(() => {
    fetchHospitalVisits();
  }, [coupleId, profile?.id, partnerProfile?.id]);

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

  // Mirror the draft into the shared-notes typing indicator, so the partner's
  // "Companion is active in shared notes..." line actually reflects something.
  // The hook throttles the outgoing pings; we just report the current state.
  const handleNoteDraftChange = (text: string) => {
    setNewNoteContent(text);
    setNoteTyping(text.trim().length > 0);
  };

  const [composerOpen, setComposerOpen] = useState(false);
  const [plusMenuOpen, setPlusMenuOpen] = useState(false);

  /**
   * Close the sheet and stop telling the partner we're typing.
   *
   * Without the explicit stop, dismissing the sheet mid-draft leaves their
   * "Companion is active in shared notes..." banner up until the receiver's
   * own 5s expiry — the indicator outliving the thing it describes.
   */
  const closeComposer = () => {
    setComposerOpen(false);
    setNoteTyping(false);
  };

  /** Add from the sheet, closing it only if the note actually saved. */
  const submitNote = async () => {
    const content = newNoteContent.trim();
    if (!content) return;
    await handleAddNote();
    // handleAddNote restores the draft on failure, so an empty box means it
    // went through; a still-populated one means the user should get the sheet
    // back rather than lose what they wrote.
    setComposerOpen(false);
    setNoteTyping(false);
  };

  const handleAddNote = async () => {
    const content = newNoteContent.trim();
    if (!content) return;
    // Clear the box immediately so it feels instant; restore if the send fails.
    setNewNoteContent('');
    setNoteTyping(false);
    const success = await addNote(content);
    if (!success) setNewNoteContent(content);
  };

  /**
   * Settle an item. A recurring subscription rolls forward to its next billing
   * date instead of being retired — marking Netflix "paid" used to remove it
   * from the ledger permanently, so it silently stopped being tracked.
   */

  /**
   * Clear outstanding borrowings in one direction.
   *
   * Direction matters: this button is shown under both "you owe them" and "they
   * owe you". An unfiltered update would let a single tap on the latter wipe
   * money owed *to* you, so the caller states whose debts are being forgiven.
   */

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
    const logged = await addPeriodLog(periodStartDate, periodEndDate.trim() || null, symptomsArray, null);
    if (!logged) {
      // Keep the form filled so the entry isn't lost to a dropped connection.
      Alert.alert('Cycle not logged', 'NOVIA could not save this entry. Please check connectivity and try again.');
      return;
    }

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
      // parseLocalDate, not new Date(str): 'YYYY-MM-DD' parses as UTC midnight,
      // which reads back as the *previous* calendar day anywhere west of UTC.
      record_date: hospitalDate ? parseLocalDate(hospitalDate).toISOString() : new Date().toISOString(),
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
    const text = replyText.trim();
    if (!text) return;
    // Clear immediately for a snappy send; restore the draft if it fails.
    setReplyText('');
    const created = await addReply(complaintId, text);
    if (!created) setReplyText(text);
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

  /*
   * Keyed on foregroundTick — the counter that already increments whenever the
   * app comes to the foreground. Right granularity: nobody holds the hub open
   * across noon and minds that it still says morning, but everybody opens the
   * app in the morning and again at night, and both should be greeted properly.
   */
  const greeting = useMemo(
    () => greetingForHour(new Date().getHours()),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [foregroundTick]
  );

  const [avatarBusy, setAvatarBusy] = useState(false);
  // The ref is the guard; the state is only what the button renders. setState
  // does not land before the next tap can read it, so two quick presses both
  // see avatarBusy === false and both open a picker.
  const avatarBusyRef = useRef(false);

  const changeProfilePhoto = async () => {
    if (avatarBusyRef.current) return;
    avatarBusyRef.current = true;
    setAvatarBusy(true);
    try {
      const result = await pickProfilePhoto();
      if (result.cancelled) return;
      if (result.error) {
        Alert.alert('Could not use that photo', result.error);
        return;
      }
      await updateAvatar(result.dataUri!);
    } catch (e: any) {
      Alert.alert('Could not save', e?.message ?? 'Please try again.');
    } finally {
      avatarBusyRef.current = false;
      setAvatarBusy(false);
    }
  };

  const removeProfilePhoto = async () => {
    try {
      await updateAvatar(null);
    } catch (e: any) {
      Alert.alert('Could not remove', e?.message ?? 'Please try again.');
    }
  };
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
      <View style={styles.appShell}>
        <SpaceBackdrop />
        <View style={styles.container}>
          <StatusBar barStyle="light-content" translucent backgroundColor="transparent" />
          <SafeAreaView style={{ flex: 1 }}>
            <FadeInUp index={0}>
              <HubSkeleton />
            </FadeInUp>
          </SafeAreaView>
        </View>
      </View>
    );
  }

  // --- Step Duel derived values ---
  // Only crown a leader once we have a real Health Connect read; otherwise a
  // recorded 0 would let the (mocked) partner "win" a day you couldn't track.
  // The two-bar normalisation this used to need is gone: StepGraph scales
  // against the whole week internally, so there is nothing to compute here.
  const stepsLive = stepsStatus === 'ready';
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
            {/* Sits on the key light, not opposite it — a corner source that
                breathes reads as the light itself flickering, whereas a pulse
                somewhere else reads as a second, unexplained lamp. */}
            <RadialGradient id="ambientPulse" cx="4%" cy="8%" r="78%" fx="4%" fy="8%">
              <Stop offset="0%" stopColor={PALETTE.accent} stopOpacity="0.22" />
              <Stop offset="45%" stopColor={PALETTE.accent} stopOpacity="0.07" />
              <Stop offset="100%" stopColor={PALETTE.ground} stopOpacity="0" />
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
                  placeholderTextColor={THEME.ink[35]}
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
                placeholderTextColor={THEME.ink[35]}
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
                placeholderTextColor={THEME.ink[35]}
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
                multiline
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
                placeholderTextColor={THEME.ink[35]}
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
                    // Was 56 to clear the floating hamburger, which now lives in
                    // the dock. Was 220 at the bottom *on top of* tabContent's
                    // own 140 — 360px of dead space to clear a 66px bar.
                    paddingTop: 20,
                    paddingBottom: 24
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
                      {/* The picture is the control: tapping it opens the
                          picker. Settings carries the discoverable version of
                          the same action, and the only way to remove one. */}
                      <TouchableOpacity
                        onPress={changeProfilePhoto}
                        activeOpacity={0.8}
                        disabled={avatarBusy}
                        accessibilityLabel="Change profile picture"
                      >
                        <Avatar uri={profile?.avatar_url} name={welcomeName} size={56} />
                      </TouchableOpacity>
                      <View style={styles.welcomeText}>
                        <Text style={styles.welcomeTitle}>{greeting}</Text>
                        <Text style={styles.welcomeSubtitle} numberOfLines={1}>{welcomeName}</Text>
                      </View>
                    </Animated.View>

                    {/* Companion Status Row */}
                    <FadeInUp index={0}>
                    <GlassCard style={styles.partnerCard}>
                      <Text style={styles.sectionHeading}>RIGHT NOW</Text>
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

                      {/* Your own mood lives here rather than in a card of its
                          own at the bottom of the hub. Both moods belong to the
                          same question — how are the two of you today — and
                          splitting them put the answer and the input three
                          screens apart. */}
                      <View style={styles.myMoodRow}>
                        <Text style={styles.myMoodLabel}>YOU</Text>
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
                    </GlassCard>
                    </FadeInUp>

                    {/* Step Duel — daily step competition. Own steps come from
                        Health Connect; partner steps are placeholder until sync. */}
                    <FadeInUp index={1}>
                    <GlassCard style={styles.sectionCard}>
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
                          {/* Today's totals, then the week behind them. The
                              numbers answer "who is winning right now"; the
                              graph answers everything else. */}
                          <View style={styles.stepTodayRow}>
                            <View style={styles.stepTodaySide}>
                              <Text style={[styles.stepValue, myLeads && styles.stepValueLead]}>
                                {mySteps.toLocaleString()}
                              </Text>
                              <View style={styles.stepNameWrap}>
                                <Text style={styles.stepName}>You</Text>
                                {myLeads && (
                                  <View style={styles.leaderPill}>
                                    <Trophy size={10} color={THEME.colors.background} />
                                  </View>
                                )}
                              </View>
                            </View>

                            <Text style={styles.stepVersus}>vs</Text>

                            <View style={[styles.stepTodaySide, { alignItems: 'flex-end' }]}>
                              <Text style={[styles.stepValue, partnerLeads && styles.stepValueLead]}>
                                {partnerSteps.toLocaleString()}
                              </Text>
                              <View style={styles.stepNameWrap}>
                                {partnerLeads && (
                                  <View style={styles.leaderPill}>
                                    <Trophy size={10} color={THEME.colors.background} />
                                  </View>
                                )}
                                <Text style={styles.stepName} numberOfLines={1}>{partnerName}</Text>
                              </View>
                            </View>
                          </View>

                          <StepGraph series={stepSeries} partnerName={partnerName} />

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
                    </GlassCard>
                    </FadeInUp>

                    {/* On this day — milestones landing today, then upcoming ones. */}
                    {(todayMilestones.length > 0 || upcomingMilestones.length > 0) && (
                      <FadeInUp index={1}>
                      <GlassCard style={styles.sectionCard} blur={false}>
                        <View style={styles.rowBetween}>
                          <Text style={styles.sectionHeading}>ON THIS DAY</Text>
                          <CalendarHeart size={16} color={THEME.colors.primary} />
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
                      </GlassCard>
                      </FadeInUp>
                    )}

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
                                { color: THEME.ink[95] },
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
                        <ListChecks size={26} color={THEME.colors.primary} strokeWidth={2} />
                        <Text style={styles.navCardLabel}>Todo List</Text>
                      </TouchableOpacity>
                      <TouchableOpacity style={styles.navCard} onPress={() => setActiveTab('complaints')} activeOpacity={0.85}>
                        <MessageSquareWarning size={26} color={THEME.colors.primary} strokeWidth={2} />
                        <Text style={styles.navCardLabel}>Complaint Box</Text>
                      </TouchableOpacity>
                      <TouchableOpacity style={styles.navCard} onPress={() => setActiveTab('bucket')} activeOpacity={0.85}>
                        <Text style={{ fontSize: 26 }}>🪣</Text>
                        <Text style={styles.navCardLabel}>Bucket List</Text>
                      </TouchableOpacity>
                      <TouchableOpacity style={styles.navCard} onPress={() => setActiveTab('milestones')} activeOpacity={0.85}>
                        <CalendarHeart size={26} color={THEME.colors.primary} strokeWidth={2} />
                        <Text style={styles.navCardLabel}>Milestones</Text>
                      </TouchableOpacity>
                      <TouchableOpacity style={styles.navCard} onPress={() => setActiveTab('health')} activeOpacity={0.85}>
                        <Activity size={26} color={THEME.colors.primary} strokeWidth={2} />
                        <Text style={styles.navCardLabel}>Health & Cycle</Text>
                      </TouchableOpacity>
                    </View>
                    </FadeInUp>

                    {/* Word of the Day */}
                    {(() => {
                      const w = getWordOfDay();
                      return (
                        <FadeInUp index={3}>
                        {/* A whole card for a word nobody acts on was a third of
                            a screen. One line keeps the daily habit without
                            spending the hub's most valuable space on it. */}
                        <View style={styles.vocabLine}>
                          <BookOpen size={13} color={THEME.colors.primary} />
                          <Text style={styles.vocabLineText} numberOfLines={1}>
                            <Text style={styles.vocabLineWord}>{w.word}</Text>
                            {'  '}{w.meaning}
                          </Text>
                        </View>
                        </FadeInUp>
                      );
                    })()}
                  </View>
                )}

                {/* Collaborative Canvas Tab */}
                {/* Chat. Sends only the conversation itself — no moods,
                    check-ins, cycle data or steps. See [[chatWithAI]]. */}
                {activeTab === 'ai' && (
                  <View style={styles.tabContent}>
                    {chatMessages.length === 0 && !chatLoading ? (
                      <GlassCard style={styles.sectionCard} blur={false}>
                        <View style={styles.rowBetween}>
                          <Text style={styles.sectionHeading}>ASK ANYTHING</Text>
                          <Sparkles size={16} color={THEME.colors.primary} />
                        </View>
                        <Text style={styles.chatEmpty}>
                          Plans, gift ideas, what to say when you don't know what to say —
                          ask away. It only knows what you tell it here.
                        </Text>
                      </GlassCard>
                    ) : null}

                    {chatMessages.map((m, i) => (
                      <View
                        key={i}
                        style={[styles.bubble, m.role === 'user' ? styles.bubbleMine : styles.bubbleAI]}
                      >
                        <Text style={m.role === 'user' ? styles.bubbleMineText : styles.bubbleAIText}>
                          {m.content}
                        </Text>
                      </View>
                    ))}

                    {chatLoading ? (
                      <View style={[styles.bubble, styles.bubbleAI]}>
                        <Skeleton height={12} />
                        <Skeleton width="68%" height={12} style={{ marginTop: 10 }} delay={110} />
                      </View>
                    ) : null}

                    {chatError ? <Text style={styles.chatError}>{chatError}</Text> : null}
                  </View>
                )}

                {activeTab === 'notes' && (
                  <View style={styles.tabContent}>
                    {/* Header, not a composer. The inline textbox + button cost
                        ~250px before a single note was visible — a quarter of
                        the screen permanently spent on an action taken a few
                        times a day, on a screen whose job is reading what is
                        already there. The composer moved into a sheet behind
                        this plus. */}
                    <View style={styles.tabHeader}>
                      <View style={styles.tabHeaderChip}>
                        <Text style={styles.tabHeaderText}>SHARED NOTES</Text>
                      </View>
                      <PressableScale
                        style={styles.notesAddButton}
                        scaleTo={0.88}
                        onPress={() => setPlusMenuOpen(true)}
                      >
                        <Plus size={22} color={THEME.colors.background} strokeWidth={2.8} />
                      </PressableScale>
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

                {/* Detected payments. No manual entry, no ledger, no
                    settle-up: the old finance module asked two people to
                    bookkeep their own relationship, and they didn't. This one
                    only reports what already happened. */}
                {activeTab === 'finances' && (
                  <View style={styles.tabContent}>
                    <View style={styles.tabHeader}>
                      <View style={styles.tabHeaderChip}>
                        <Text style={styles.tabHeaderText}>MONEY</Text>
                      </View>
                      {paymentsSupported && paymentsListening ? (
                        <PressableScale
                          style={styles.aliasButton}
                          scaleTo={0.9}
                          onPress={() => {
                            setAliasDraft(customAliases.join(', '));
                            setAliasSheetOpen(true);
                          }}
                        >
                          <Pencil size={14} color={THEME.colors.primary} strokeWidth={2.4} />
                          <Text style={styles.aliasButtonText}>NAMES</Text>
                        </PressableScale>
                      ) : null}
                    </View>

                    {!paymentsSupported ? (
                      <GlassCard style={styles.sectionCard} blur={false}>
                        <Text style={styles.paymentTitle}>Not available here</Text>
                        <Text style={styles.paymentCopy}>
                          Payment detection reads this phone's texts and notifications,
                          and iOS lets an app do neither. On Android it needs a build that
                          carries the listener — if this phone last updated over the air,
                          install the newest APK and it will appear.
                        </Text>
                      </GlassCard>
                    ) : !paymentsChecked ? (
                      /* The SMS permission read is async. Showing the
                         onboarding card before it lands would flash "turn this
                         on" at someone who turned it on weeks ago. */
                      <GlassCard style={styles.sectionCard} blur={false}>
                        <Skeleton height={14} />
                        <Skeleton width="62%" height={14} style={{ marginTop: 12 }} delay={110} />
                      </GlassCard>
                    ) : !paymentsListening ? (
                      <GlassCard style={styles.sectionCard} blur={false}>
                        <View style={styles.rowBetween}>
                          <Text style={styles.paymentTitle}>Let NOVIA see the money</Text>
                          <BellRing size={18} color={THEME.colors.primary} />
                        </View>
                        <Text style={styles.paymentCopy}>
                          Your bank texts you every transfer. NOVIA reads those texts, keeps
                          the ones with {partnerLabel}’s name on them, and ignores
                          everything else — no one-time codes, no conversations. A text
                          that isn’t a payment is never even stored, and the message
                          itself never leaves this phone: only the amount and the time do.
                        </Text>
                        <SubmitButton
                          style={[styles.primaryButton, { marginTop: 16 }]}
                          onPress={requestPaymentsSms}
                        >
                          <Text style={styles.primaryBtnText}>ALLOW PAYMENT TEXTS</Text>
                        </SubmitButton>

                        {/* The second path, for transfers an app announces but the
                            bank doesn't text about. Secondary because it costs a trip
                            into Settings, where the first is one dialog. */}
                        <TouchableOpacity
                          style={styles.secondaryLink}
                          activeOpacity={0.7}
                          onPress={() => openListenerSettings()}
                        >
                          <Text style={styles.secondaryLinkText}>
                            Or watch payment apps instead
                          </Text>
                        </TouchableOpacity>
                        <Text style={styles.paymentHint}>
                          That opens Settings → Notification access. Switch NOVIA on
                          there and come back — this screen rechecks itself.
                        </Text>
                      </GlassCard>
                    ) : (
                      <>
                        {/* Samsung's "put unused apps to sleep" stops delivery after a
                            few idle days and reports nothing, so the warning has to
                            come from us. */}
                        {!paymentsBatteryExempt ? (
                          <TouchableOpacity
                            style={styles.batteryWarning}
                            activeOpacity={0.85}
                            onPress={() => {
                              requestIgnoreBatteryOptimizations();
                              recheckPaymentsPermission();
                            }}
                          >
                            <BatteryWarning size={17} color={THEME.colors.accent} />
                            <Text style={styles.batteryWarningText}>
                              Battery saving can put NOVIA to sleep and quietly stop
                              detection. Tap to let it run unrestricted.
                            </Text>
                          </TouchableOpacity>
                        ) : null}

                        {paymentsLoading ? (
                          <GlassCard style={styles.sectionCard} blur={false}>
                            <Skeleton height={14} />
                            <Skeleton width="62%" height={14} style={{ marginTop: 12 }} delay={110} />
                            <Skeleton width="80%" height={14} style={{ marginTop: 12 }} delay={200} />
                          </GlassCard>
                        ) : transactions.length === 0 ? (
                          <View style={styles.emptyCard}>
                            <Text style={styles.emptyText}>Nothing detected yet.</Text>
                            <Text style={[styles.paymentHint, { textAlign: 'center' }]}>
                              The next payment either of you sends the other lands here on
                              its own — nothing to add by hand.
                            </Text>
                          </View>
                        ) : (
                          paymentDays.map((day) => (
                            <View key={day.label} style={styles.paymentDay}>
                              <Text style={styles.paymentDayLabel}>{day.label}</Text>
                              {day.items.map((txn) => {
                                // Only one of the two phones' observations survives the
                                // pairing done server-side, so a stored direction can be
                                // the partner's point of view. Read it back as this
                                // reader's own.
                                const direction = directionFor(txn, userId);
                                const sent = direction === 'sent';
                                const app = PAYMENT_APPS[txn.source_package];
                                return (
                                  <View key={txn.id} style={styles.txnRow}>
                                    <View
                                      style={[
                                        styles.txnIcon,
                                        sent ? styles.txnIconSent : styles.txnIconReceived,
                                      ]}
                                    >
                                      {sent ? (
                                        <ArrowUpRight size={17} color={THEME.ink[70]} strokeWidth={2.6} />
                                      ) : (
                                        <ArrowDownLeft size={17} color={THEME.colors.primary} strokeWidth={2.6} />
                                      )}
                                    </View>
                                    <View style={styles.txnBody}>
                                      <Text style={styles.txnName} numberOfLines={1}>
                                        {sent ? 'Sent to' : 'From'} {partnerLabel}
                                      </Text>
                                      <Text style={styles.metaLine}>
                                        {formatClock(txn.occurred_at)}
                                        {app ? ` · ${app}` : ''}
                                      </Text>
                                    </View>
                                    <Text
                                      style={[
                                        styles.txnAmount,
                                        sent ? styles.txnAmountSent : styles.txnAmountReceived,
                                      ]}
                                    >
                                      {sent ? '−' : '+'}
                                      {'₹'}
                                      {formatAmount(txn.amount)}
                                    </Text>
                                  </View>
                                );
                              })}
                            </View>
                          ))
                        )}
                      </>
                    )}
                  </View>
                )}

                {/* Shared Todo List (Hub sub-screen) */}
                {activeTab === 'todos' && (
                  <View style={styles.tabContent}>
                    <TouchableOpacity style={styles.backRow} onPress={() => setActiveTab('hub')}>
                      <ChevronLeft size={20} color={THEME.colors.primary} />
                      <Text style={styles.backRowText}>Hub</Text>
                    </TouchableOpacity>

                    <GlassCard style={styles.sectionCard} blur={false}>
                      <Text style={styles.sectionHeading}>NEW SHARED TODO</Text>
                      <TextInput
                        style={styles.input}
                        placeholder="What needs doing?"
                        placeholderTextColor={THEME.ink[35]}
                        value={newTodoTitle}
                        onChangeText={setNewTodoTitle}
                      />
                      <TextInput
                        style={[styles.input, { height: 60, textAlignVertical: 'top' }]}
                        placeholder="Notes (optional)"
                        placeholderTextColor={THEME.ink[35]}
                        value={newTodoNotes}
                        onChangeText={setNewTodoNotes}
                        multiline
                      />

                      <View style={[styles.rowBetween, { marginBottom: 10 }]}>
                        <Text style={styles.inputLabel}>FIRST REMINDER DATE</Text>
                        <View style={{ flexDirection: 'row', alignItems: 'center' }}>
                          {todoDate ? (
                            <TouchableOpacity onPress={() => setTodoDate('')} style={{ marginRight: 10 }}>
                              <Text style={{ color: THEME.colors.primary, fontSize: 12, fontFamily: FONTS.bold }}>Clear</Text>
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

                      <SubmitButton style={[styles.primaryButton, { marginTop: 16 }]} onPress={handleAddTodo}>
                        <Text style={styles.primaryBtnText}>ADD TODO</Text>
                      </SubmitButton>
                    </GlassCard>

                    <GlassCard style={styles.sectionCard} blur={false}>
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
                                {t.is_completed && <Check size={13} color={THEME.ink[95]} strokeWidth={3} />}
                              </TouchableOpacity>
                              <View style={{ flex: 1 }}>
                                <Text style={[styles.reminderTitle, t.is_completed && styles.strikethroughText]}>{t.title}</Text>
                                <Text style={{ color: THEME.colors.primary, fontSize: 11, fontFamily: FONTS.bold, marginTop: 2 }}>
                                  {timeLabel} · {recLabel} · by {getCreatorName(t.created_by)}
                                </Text>
                                {t.notes ? <Text style={{ color: THEME.ink[50], fontSize: 12, marginTop: 2, fontFamily: FONTS.body }}>{t.notes}</Text> : null}
                              </View>
                              <TouchableOpacity style={styles.reminderDeleteButton} onPress={() => deleteTodo(t.id)}>
                                <X size={13} color={THEME.colors.primary} strokeWidth={2.5} />
                              </TouchableOpacity>
                            </View>
                          );
                        })
                      )}
                    </GlassCard>
                    <View style={{ height: 100 }} />
                  </View>
                )}

                {/* Milestones / Anniversaries (Hub sub-screen) */}
                {activeTab === 'milestones' && (
                  <View style={styles.tabContent}>
                    <TouchableOpacity style={styles.backRow} onPress={() => setActiveTab('hub')}>
                      <ChevronLeft size={20} color={THEME.colors.primary} />
                      <Text style={styles.backRowText}>Hub</Text>
                    </TouchableOpacity>

                    <GlassCard style={styles.sectionCard} blur={false}>
                      <Text style={styles.sectionHeading}>NEW MILESTONE</Text>
                      <TextInput
                        style={styles.input}
                        placeholder="e.g. First Date, Anniversary"
                        placeholderTextColor={THEME.ink[35]}
                        value={newMilestoneTitle}
                        onChangeText={setNewMilestoneTitle}
                      />

                      <View style={[styles.rowBetween, { marginTop: 12, marginBottom: 10 }]}>
                        <Text style={styles.inputLabel}>DATE</Text>
                        <View style={{ flexDirection: 'row', alignItems: 'center' }}>
                          {milestoneDate ? (
                            <TouchableOpacity onPress={() => setMilestoneDate('')} style={{ marginRight: 10 }}>
                              <Text style={{ color: THEME.colors.primary, fontSize: 12, fontFamily: FONTS.bold }}>Clear</Text>
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

                      <SubmitButton style={[styles.primaryButton, { marginTop: 16 }]} onPress={handleAddMilestone}>
                        <Text style={styles.primaryBtnText}>ADD MILESTONE</Text>
                      </SubmitButton>
                    </GlassCard>

                    <GlassCard style={styles.sectionCard} blur={false}>
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
                                <Text style={{ color: THEME.colors.primary, fontSize: 11, fontFamily: FONTS.bold, marginTop: 2 }}>
                                  {base.toLocaleDateString(undefined, { day: 'numeric', month: 'short', year: 'numeric' })} · {recLabel} · {whenLabel}
                                </Text>
                              </View>
                              <TouchableOpacity style={styles.reminderDeleteButton} onPress={() => deleteMilestone(m.id)}>
                                <X size={13} color={THEME.colors.primary} strokeWidth={2.5} />
                              </TouchableOpacity>
                            </View>
                          );
                        })
                      )}
                    </GlassCard>
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
                      <ChevronLeft size={20} color={THEME.colors.primary} />
                      <Text style={styles.backRowText}>{openComplaintId ? 'All complaints' : 'Hub'}</Text>
                    </TouchableOpacity>

                    {openComplaintId ? (() => {
                      const c = complaints.find((x) => x.id === openComplaintId);
                      if (!c) return <Text style={styles.noRemindersText}>This complaint was removed.</Text>;
                      const thread = repliesFor(c.id);
                      return (
                        <GlassCard style={styles.sectionCard} blur={false}>
                          <View style={styles.rowBetween}>
                            <Text style={[styles.sectionHeading, { flex: 1 }]}>{c.title}</Text>
                            <View style={[styles.statusChip, { backgroundColor: c.status === 'resolved' ? alpha(THEME.colors.primary, 0.18) : alpha(THEME.colors.primary, 0.18) }]}>
                              <Text style={{ color: c.status === 'resolved' ? THEME.colors.primary : THEME.colors.primary, fontSize: 10, fontFamily: FONTS.heavy }}>{c.status.toUpperCase()}</Text>
                            </View>
                          </View>
                          <Text style={{ color: THEME.ink[50], fontSize: 11, marginBottom: 6, fontFamily: FONTS.body }}>Filed by {getCreatorName(c.created_by)}</Text>
                          {c.body ? <Text style={{ color: THEME.ink[100], fontSize: 14, marginBottom: 12, fontFamily: FONTS.body }}>{c.body}</Text> : null}

                          <View style={{ gap: 8, marginBottom: 12 }}>
                            {thread.length === 0 ? (
                              <Text style={styles.noRemindersText}>No replies yet.</Text>
                            ) : thread.map((r) => {
                              const mine = r.author_id === userId;
                              return (
                                <View key={r.id} style={[styles.replyBubble, mine ? styles.replyMine : styles.replyTheirs]}>
                                  <Text style={{ color: THEME.colors.primary, fontSize: 10, fontFamily: FONTS.heavy, marginBottom: 2 }}>{getCreatorName(r.author_id)}</Text>
                                  <Text style={{ color: THEME.ink[100], fontSize: 13, fontFamily: FONTS.body }}>{r.body}</Text>
                                </View>
                              );
                            })}
                          </View>

                          <View style={styles.addReminderRow}>
                            <TextInput
                              style={[styles.input, { flex: 1, marginBottom: 0 }]}
                              placeholder="Write a reply..."
                              placeholderTextColor={THEME.ink[35]}
                              value={replyText}
                              onChangeText={setReplyText}
                            />
                            <SubmitButton style={styles.plusAddButton} onPress={() => handleAddReply(c.id)}>
                              <Send size={18} color={THEME.ink[95]} />
                            </SubmitButton>
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
                                style={[styles.secondaryButton, { flex: 1, backgroundColor: alpha(THEME.colors.primary, 0.16) }]}
                                onPress={() => { deleteComplaint(c.id); setOpenComplaintId(null); }}
                              >
                                <Text style={[styles.secondaryBtnText, { color: THEME.colors.primary }]}>Delete</Text>
                              </TouchableOpacity>
                            ) : null}
                          </View>
                        </GlassCard>
                      );
                    })() : (
                      <>
                        <GlassCard style={styles.sectionCard} blur={false}>
                          <Text style={styles.sectionHeading}>FILE A COMPLAINT</Text>
                          <TextInput
                            style={styles.input}
                            placeholder="Title (e.g. You left the lights on)"
                            placeholderTextColor={THEME.ink[35]}
                            value={newComplaintTitle}
                            onChangeText={setNewComplaintTitle}
                          />
                          <TextInput
                            style={[styles.input, { height: 80, textAlignVertical: 'top' }]}
                            placeholder="Describe it (optional)"
                            placeholderTextColor={THEME.ink[35]}
                            value={newComplaintBody}
                            onChangeText={setNewComplaintBody}
                            multiline
                          />
                          <SubmitButton style={styles.primaryButton} onPress={handleAddComplaint}>
                            <Text style={styles.primaryBtnText}>SUBMIT COMPLAINT</Text>
                          </SubmitButton>
                        </GlassCard>

                        <GlassCard style={styles.sectionCard} blur={false}>
                          <Text style={styles.sectionHeading}>COMPLAINT TICKETS</Text>
                          {complaints.length === 0 ? (
                            <Text style={styles.noRemindersText}>No complaints. All is well.</Text>
                          ) : complaints.map((c) => {
                            const count = repliesFor(c.id).length;
                            return (
                              <TouchableOpacity key={c.id} style={styles.ticketRow} onPress={() => setOpenComplaintId(c.id)}>
                                <View style={{ flex: 1 }}>
                                  <Text style={styles.ticketTitle}>{c.title}</Text>
                                  <Text style={{ color: THEME.ink[50], fontSize: 11, marginTop: 2, fontFamily: FONTS.body }}>
                                    by {getCreatorName(c.created_by)} · {count} {count === 1 ? 'reply' : 'replies'}
                                  </Text>
                                </View>
                                <View style={[styles.statusChip, { backgroundColor: c.status === 'resolved' ? alpha(THEME.colors.primary, 0.18) : alpha(THEME.colors.primary, 0.18) }]}>
                                  <Text style={{ color: c.status === 'resolved' ? THEME.colors.primary : THEME.colors.primary, fontSize: 10, fontFamily: FONTS.heavy }}>{c.status.toUpperCase()}</Text>
                                </View>
                              </TouchableOpacity>
                            );
                          })}
                        </GlassCard>
                      </>
                    )}
                    <View style={{ height: 100 }} />
                  </View>
                )}

                {/* Subscriptions & Borrowings Tab */}
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
                                <Text style={[styles.cyclePhasePillText, { color: THEME.ink[95] }]}>{phaseData.phase}</Text>
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
                                  <Sparkles size={12} color={THEME.ink[95]} strokeWidth={2.4} />
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

                    <GlassCard style={styles.sectionCard} blur={false}>
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
                        placeholderTextColor={THEME.ink[35]}
                        value={hospitalReason}
                        onChangeText={setHospitalReason}
                      />
                      <TextInput
                        multiline
                        textAlignVertical="top"
                        style={[styles.input, styles.noteInput]}
                        placeholder="Test results / doctor notes..."
                        placeholderTextColor={THEME.ink[35]}
                        value={hospitalResults}
                        onChangeText={setHospitalResults}
                      />
                      <SubmitButton style={styles.primaryButton} onPress={logHospitalVisit}>
                        <Text style={styles.primaryBtnText}>Save Hospital Visit</Text>
                      </SubmitButton>
                    </GlassCard>

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
                          <Text style={styles.metaLine} numberOfLines={1}>{log.value_json?.test_results || 'No test results added.'}</Text>
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
                      <ChevronLeft size={20} color={THEME.colors.primary} />
                      <Text style={styles.backRowText}>Hub</Text>
                    </TouchableOpacity>
                    <GlassCard style={styles.sectionCard} blur={false}>
                      <Text style={styles.sectionHeading}>ADD EXPERIENCES GOAL</Text>
                      <TextInput
                        style={styles.input}
                        placeholder="Header..."
                        placeholderTextColor={THEME.ink[35]}
                        value={newBucketTitle}
                        onChangeText={setNewBucketTitle}
                      />
                      <TextInput
                        multiline
                        textAlignVertical="top"
                        style={[styles.input, styles.noteInput]}
                        placeholder="Description..."
                        placeholderTextColor={THEME.ink[35]}
                        value={newBucketDescription}
                        onChangeText={setNewBucketDescription}
                      />
                      <SubmitButton style={styles.primaryButton} onPress={handleAddBucket}>
                        <Text style={styles.primaryBtnText}>Add experience to list</Text>
                      </SubmitButton>
                    </GlassCard>

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

          {/* Content sinking away behind the floating dock. It exists for the
              dock, so it goes when the dock goes — over the full-screen menu it
              is pure harm, and the elevation it carries makes it harm that
              outranks most things put in front of it. */}
          {!isDrawerOpen && (
          <View style={styles.bottomOverlayFade} pointerEvents="none">
            <Svg width="100%" height="100%">
              <Defs>
                <SvgLinearGradient id="bottomOverlayBlackFade" x1="0" y1="1" x2="0" y2="0">
                  <Stop offset="0%" stopColor={THEME.colors.background} stopOpacity="1" />
                  <Stop offset="15%" stopColor={THEME.colors.background} stopOpacity="1" />
                  <Stop offset="45%" stopColor={THEME.colors.background} stopOpacity="0.9" />
                  <Stop offset="70%" stopColor={THEME.colors.background} stopOpacity="0.5" />
                  <Stop offset="100%" stopColor={THEME.colors.background} stopOpacity="0" />
                </SvgLinearGradient>
              </Defs>
              <Rect width="100%" height="100%" fill="url(#bottomOverlayBlackFade)" />
            </Svg>
          </View>
          )}

          {/* Chat composer. Lives outside the ScrollView so it stays put while
              the transcript scrolls under it — a composer that scrolls away is
              the single most irritating thing a chat UI can do. */}
          {activeTab === 'ai' && !isDrawerOpen && (
            <View
              style={[
                styles.chatBar,
                // Above the dock normally; above the keyboard when it's up, at
                // which point the dock is behind it anyway.
                { bottom: keyboardHeight > 0 ? keyboardHeight + 12 : TAB_BAR_BOTTOM + 78 },
              ]}
            >
              {/* blur={false} so the fill below actually applies: GlassCard
                  forces a transparent background when it is blurring, and over
                  the flat black of an empty transcript the blur has nothing to
                  sample anyway. */}
              <GlassCard style={styles.chatBarInner} tier="chrome" radius={THEME.borderRadius.xl} blur={false}>
                <TextInput
                  style={styles.chatInput}
                  placeholder="Ask anything..."
                  // INK[55], not [35]: measured 4.35:1 on the S23, under the
                  // AA floor, on the one control this screen exists for.
                  placeholderTextColor={THEME.ink[55]}
                  value={chatInput}
                  onChangeText={setChatInput}
                  onSubmitEditing={sendChat}
                  returnKeyType="send"
                  multiline
                />
                <PressableScale style={styles.chatSend} scaleTo={0.88} onPress={sendChat}>
                  <Send size={18} color={THEME.colors.background} strokeWidth={2.6} />
                </PressableScale>
              </GlassCard>
            </View>
          )}

          {/* Premium Bottom Tab Bar. Hidden while the drawer is open so its
              high elevation can't poke through the drawer's scrim/panel. */}
          {!isDrawerOpen && (
            <AnimatedTabBar
              tabs={['hub', 'notes', 'finances', 'ai', 'menu'] as const}
              activeTab={activeTab}
              // `menu` is a dock item that isn't a screen: it opens the drawer
              // instead of switching tabs. activeTab therefore never becomes
              // 'menu', which is also why the sliding indicator still behaves —
              // it simply never lands on this slot.
              onChange={(t) => {
                if (t === 'menu') toggleDrawer(true);
                else setActiveTab(t);
              }}
            />
          )}

          {/* Two ways to fill a note, so the plus asks which rather than
              assuming. Anchored to the top-right because that is where the
              button that opened it lives — a menu that appears somewhere else
              breaks the link to what you pressed. */}
          <Modal visible={plusMenuOpen} transparent animationType="fade" onRequestClose={() => setPlusMenuOpen(false)}>
            <TouchableOpacity
              style={styles.plusMenuScrim}
              activeOpacity={1}
              onPress={() => setPlusMenuOpen(false)}
            >
              <GlassCard style={styles.plusMenu} tier="chrome" radius={THEME.borderRadius.md}>
                <TouchableOpacity
                  style={styles.plusMenuItem}
                  activeOpacity={0.8}
                  onPress={() => { setPlusMenuOpen(false); setComposerOpen(true); }}
                >
                  <FileText size={18} color={THEME.colors.primary} />
                  <Text style={styles.plusMenuText}>Write a note</Text>
                </TouchableOpacity>
                <View style={styles.plusMenuDivider} />
                <TouchableOpacity
                  style={styles.plusMenuItem}
                  activeOpacity={0.8}
                  onPress={() => { setPlusMenuOpen(false); setIdeasSheetOpen(true); }}
                >
                  <Sparkles size={18} color={THEME.colors.primary} />
                  <Text style={styles.plusMenuText}>Get ideas from AI</Text>
                </TouchableOpacity>
              </GlassCard>
            </TouchableOpacity>
          </Modal>

          {/* The names to match payments against. Its own sheet rather than a
              settings row because it is the one thing that can make detection
              silently miss everything, and it belongs next to the feed that
              would look empty if it were wrong. */}
          <Modal visible={aliasSheetOpen} transparent animationType="slide" onRequestClose={() => setAliasSheetOpen(false)}>
            <KeyboardAvoidingView
              behavior={Platform.OS === 'ios' ? 'padding' : undefined}
              style={styles.settingsModalOverlay}
            >
              <GlassCard style={styles.settingsModalContent} tier="chrome" radius={24}>
                <View style={styles.settingsHeader}>
                  <Text style={styles.settingsTitle}>MATCH NAMES</Text>
                  <TouchableOpacity onPress={() => setAliasSheetOpen(false)} hitSlop={PRESS_HIT_SLOP}>
                    <X size={22} color={THEME.colors.text} />
                  </TouchableOpacity>
                </View>

                <Text style={styles.paymentCopy}>
                  Payments are matched against {partnerLabel} already. Add any other
                  spelling your payment app shows — a bank’s version of the name, a
                  maiden name, an initial. Separate them with commas.
                </Text>

                <TextInput
                  style={[styles.input, { marginTop: 14 }]}
                  placeholder="Gayathri Udhayan, G Udhayan"
                  placeholderTextColor={THEME.ink[35]}
                  value={aliasDraft}
                  onChangeText={setAliasDraft}
                  autoCapitalize="words"
                  autoCorrect={false}
                />

                <SubmitButton style={[styles.primaryButton, { marginTop: 14 }]} onPress={saveAliases}>
                  <Text style={styles.primaryBtnText}>SAVE</Text>
                </SubmitButton>
              </GlassCard>
            </KeyboardAvoidingView>
          </Modal>

          {/* Ideas sheet. Lives here rather than in its own tab because its
              output is a note — the action and its destination belong together. */}
          <Modal visible={ideasSheetOpen} transparent animationType="slide" onRequestClose={() => setIdeasSheetOpen(false)}>
            <KeyboardAvoidingView
              behavior={Platform.OS === 'ios' ? 'padding' : undefined}
              style={styles.settingsModalOverlay}
            >
              <GlassCard style={styles.settingsModalContent} tier="chrome" radius={24}>
                <View style={styles.settingsHeader}>
                  <Text style={styles.settingsTitle}>GET IDEAS</Text>
                  <TouchableOpacity onPress={() => setIdeasSheetOpen(false)} hitSlop={PRESS_HIT_SLOP}>
                    <X size={22} color={THEME.colors.text} />
                  </TouchableOpacity>
                </View>

                <TextInput
                  style={styles.input}
                  placeholder="Dates, gifts, what to say..."
                  placeholderTextColor={THEME.ink[35]}
                  value={ideaPrompt}
                  onChangeText={setIdeaPrompt}
                  onSubmitEditing={() => askForIdeas()}
                  returnKeyType="search"
                />

                {/* Starters, because a blank box is the hardest prompt to
                    answer. Each runs immediately rather than filling the field. */}
                <View style={styles.starterRow}>
                  {IDEA_STARTERS.map((starter) => (
                    <TouchableOpacity
                      key={starter}
                      style={styles.starterChip}
                      onPress={() => askForIdeas(starter)}
                      activeOpacity={0.85}
                    >
                      <Text style={styles.starterChipText}>{starter}</Text>
                    </TouchableOpacity>
                  ))}
                </View>

                <SubmitButton style={[styles.primaryButton, { marginTop: 14 }]} onPress={() => askForIdeas()}>
                  <Text style={styles.primaryBtnText}>{ideasLoading ? 'THINKING...' : 'GET IDEAS'}</Text>
                </SubmitButton>

                {ideasError ? <Text style={styles.chatError}>{ideasError}</Text> : null}

                <ScrollView style={styles.ideaScroll} keyboardShouldPersistTaps="handled">
                  {ideasLoading && ideas.length === 0 ? (
                    <View style={{ marginTop: 14 }}>
                      <Skeleton height={13} />
                      <Skeleton height={13} style={{ marginTop: 10 }} delay={90} />
                    </View>
                  ) : null}
                  {ideas.map((idea, i) => (
                    <TouchableOpacity
                      key={`${idea}-${i}`}
                      style={styles.ideaRow}
                      activeOpacity={0.85}
                      onPress={() => saveIdeaToNotes(idea)}
                    >
                      <Text style={styles.ideaText}>{idea}</Text>
                      <Text style={styles.ideaSaveText}>Tap to save as a note</Text>
                    </TouchableOpacity>
                  ))}
                </ScrollView>
              </GlassCard>
            </KeyboardAvoidingView>
          </Modal>

          {/* Note composer. A sheet rather than an inline box, so the notes
              screen spends its space on notes. */}
          <Modal
            visible={composerOpen}
            transparent
            animationType="slide"
            onRequestClose={closeComposer}
          >
            <KeyboardAvoidingView
              behavior={Platform.OS === 'ios' ? 'padding' : undefined}
              style={styles.settingsModalOverlay}
            >
              <GlassCard style={styles.settingsModalContent} tier="chrome" radius={24}>
                <View style={styles.settingsHeader}>
                  <Text style={styles.settingsTitle}>NEW SHARED NOTE</Text>
                  <TouchableOpacity onPress={closeComposer} hitSlop={PRESS_HIT_SLOP}>
                    <X size={22} color={THEME.colors.text} />
                  </TouchableOpacity>
                </View>

                <TextInput
                  multiline
                  autoFocus
                  textAlignVertical="top"
                  style={[styles.input, styles.noteInput]}
                  value={newNoteContent}
                  onChangeText={handleNoteDraftChange}
                  onBlur={() => setNoteTyping(false)}
                  placeholder="Write a note for both partners..."
                  placeholderTextColor={THEME.ink[35]}
                />
                <SubmitButton style={styles.primaryButton} onPress={submitNote}>
                  <Text style={styles.primaryBtnText}>ADD NOTE</Text>
                </SubmitButton>
              </GlassCard>
            </KeyboardAvoidingView>
          </Modal>

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
              <GlassCard style={styles.calendarModalContent} tier="chrome" radius={24}>
                <Text style={styles.calendarModalTitle}>
                  SELECT {calendarTarget === 'periodStartDate' ? 'START DATE' :
                          calendarTarget === 'periodEndDate' ? 'END DATE' :
                          calendarTarget === 'hospitalDate' ? 'VISIT DATE' :
                          calendarTarget === 'todoDate' ? 'TODO DATE' : 'DUE DATE'}
                </Text>
                <Calendar
                  onDayPress={(day: any) => handleDateSelect(day.dateString)}
                  theme={{
                    backgroundColor: THEME.colors.charcoal,
                    calendarBackground: THEME.colors.charcoal,
                    textSectionTitleColor: THEME.colors.warning,
                    selectedDayBackgroundColor: THEME.colors.primary,
                    // Body ink on the accent selection — the one pairing here
                    // that has to stay legible whatever the accent hue becomes.
                    selectedDayTextColor: THEME.ink[95],
                    todayTextColor: THEME.colors.primary,
                    dayTextColor: THEME.ink[100],
                    textDisabledColor: THEME.ink[16],
                    dotColor: THEME.colors.primary,
                    selectedDotColor: THEME.ink[95],
                    arrowColor: THEME.colors.primary,
                    monthTextColor: THEME.ink[95],
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
              </GlassCard>
            </View>
          </Modal>

          {/* Sliding Side Drawer Overlay */}
          {isDrawerOpen && (
            <View style={styles.drawerBackdrop}>
              {/* The scrim opacity is driven by the same value as the panel, so
                  it dims continuously *during* the drag rather than snapping at
                  the end — the background receding under your finger is what
                  tells you how far along the gesture is. */}
              <Animated.View
                style={[
                  StyleSheet.absoluteFill,
                  {
                    backgroundColor: alpha(THEME.ink[0], 0.6),
                    opacity: drawerAnim.interpolate({
                      inputRange: [0, 1],
                      outputRange: [0, 1],
                      extrapolate: 'clamp',
                    }),
                  },
                ]}
              >
                <TouchableOpacity
                  style={{ flex: 1 }}
                  activeOpacity={1}
                  onPress={() => toggleDrawer(false)}
                />
              </Animated.View>

              <Animated.View
                {...drawerPan.panHandlers}
                style={[
                  styles.drawerPanel,
                  {
                    transform: [{
                      translateX: drawerAnim.interpolate({
                        inputRange: [0, 1],
                        outputRange: [-DRAWER_WIDTH, 0],
                        extrapolate: 'clamp',
                      })
                    }]
                  }
                ]}
              >
                <GlassBacking radius={0} tier="chrome" />

                {/* At 280px the scrim beside the panel was the way out. A
                    full-width panel covers every pixel of it, leaving only the
                    back button and the swipe — neither of which announces
                    itself. */}
                <View style={styles.drawerTopRow}>
                  <TouchableOpacity
                    style={styles.drawerClose}
                    onPress={() => toggleDrawer(false)}
                    hitSlop={PRESS_HIT_SLOP}
                  >
                    <X size={22} color={THEME.ink[95]} />
                  </TouchableOpacity>
                </View>

                <View style={styles.drawerProfileSection}>
                  <View style={styles.drawerAvatarWrap}>
                    <Avatar uri={profile?.avatar_url} name={welcomeName} size={68} />
                  </View>
                  <Text style={styles.drawerProfileName}>{welcomeName}</Text>
                  <Text style={styles.drawerProfileEmail}>{session?.user?.email}</Text>
                  {partnerProfile && (
                    <View style={styles.drawerPartnerRow}>
                      <Heart size={12} color={THEME.colors.primary} fill={THEME.colors.primary} style={{ marginRight: 4 }} />
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
                  <Activity color={THEME.colors.primary} size={20} style={{ marginRight: 12 }} />
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
                  <ScrollText color={THEME.colors.primary} size={20} style={{ marginRight: 12 }} />
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
                  <SettingsIcon color={THEME.colors.primary} size={20} style={{ marginRight: 12 }} />
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
                  <LogOut color={THEME.colors.danger} size={20} style={{ marginRight: 12 }} />
                  <Text style={[styles.drawerMenuText, { color: THEME.colors.danger }]}>Sign Out</Text>
                </TouchableOpacity>

                {/* Branding + running version, pinned to the bottom of the drawer. */}
                <View style={styles.drawerFooter}>
                  <Text style={styles.drawerBrand}>NOVIA</Text>
                  <Text style={styles.drawerBrandTag}>Your companion, in sync.</Text>
                  <TouchableOpacity
                    style={styles.drawerCredit}
                    onPress={openDeveloperLink}
                    activeOpacity={0.7}
                    hitSlop={PRESS_HIT_SLOP}
                  >
                    <Text style={styles.drawerCreditText}>Developed by Adarsh Aravind</Text>
                  </TouchableOpacity>
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
              <GlassCard style={styles.settingsModalContent} tier="chrome" radius={24}>
                <View style={styles.settingsHeader}>
                  <Text style={styles.settingsTitle}>ACCOUNT &amp; PAIRING</Text>
                  <TouchableOpacity onPress={() => setIsSettingsVisible(false)}>
                    <X color={THEME.ink[100]} size={20} />
                  </TouchableOpacity>
                </View>
                
                <ScrollView style={styles.settingsBody} keyboardShouldPersistTaps="handled">
                  <View style={styles.settingsSection}>
                    <Text style={styles.settingsSectionTitle}>My Profile</Text>

                    {/* "Tap your picture" is not a discoverable instruction, and
                        Remove needs somewhere to live regardless. */}
                    <View style={styles.photoRow}>
                      <Avatar uri={profile?.avatar_url} name={welcomeName} size={52} />
                      <View style={styles.photoActions}>
                        <TouchableOpacity
                          style={styles.photoBtn}
                          onPress={changeProfilePhoto}
                          disabled={avatarBusy}
                          activeOpacity={0.8}
                        >
                          <Text style={styles.photoBtnText}>
                            {avatarBusy ? 'WORKING...' : profile?.avatar_url ? 'CHANGE PHOTO' : 'ADD PHOTO'}
                          </Text>
                        </TouchableOpacity>
                        {profile?.avatar_url ? (
                          <TouchableOpacity style={styles.photoBtn} onPress={removeProfilePhoto} activeOpacity={0.8}>
                            <Text style={[styles.photoBtnText, { color: THEME.ink[70] }]}>REMOVE</Text>
                          </TouchableOpacity>
                        ) : null}
                      </View>
                    </View>
                    
                    <View style={styles.inputGroup}>
                      <Text style={styles.inputLabel}>YOUR DISPLAY NAME</Text>
                      <TextInput
                        style={styles.settingsInput}
                        placeholder="Enter name..."
                        placeholderTextColor={THEME.ink[35]}
                        value={tempDisplayName}
                        onChangeText={setTempDisplayName}
                      />
                    </View>
                    
                    <SubmitButton
                      style={styles.settingsSaveButton}
                      onPress={handleSaveDisplayName}
                    >
                      <Text style={styles.settingsSaveBtnText}>SAVE NAME</Text>
                    </SubmitButton>
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
                        multiline
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
              </GlassCard>
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
              <GlassCard style={styles.settingsModalContent} tier="chrome" radius={24}>
                <View style={styles.settingsHeader}>
                  <Text style={styles.settingsTitle}>SEASON STAKES</Text>
                  <TouchableOpacity onPress={() => setStakesModalOpen(false)}>
                    <X color={THEME.ink[100]} size={20} />
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
                      placeholderTextColor={THEME.ink[35]}
                      value={stakesDraft}
                      onChangeText={setStakesDraft}
                      multiline
                      maxLength={140}
                    />
                  </View>
                  <SubmitButton
                    style={[styles.settingsSaveButton, !stakesDraft.trim() && { opacity: 0.5 }]}
                    disabled={!stakesDraft.trim()}
                    onPress={async () => { await setStepForfeit(stakesDraft); setStakesModalOpen(false); }}
                  >
                    <Text style={styles.settingsSaveBtnText}>SAVE STAKES</Text>
                  </SubmitButton>
                </View>
              </GlassCard>
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
              <GlassCard style={styles.settingsModalContent} tier="chrome" radius={24}>
                <View style={styles.settingsHeader}>
                  <Text style={styles.settingsTitle}>CYCLE TRACKER</Text>
                  <TouchableOpacity onPress={() => setIsCycleModalVisible(false)}>
                    <X color={THEME.ink[100]} size={20} />
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
                      <GlassCard style={styles.questionnaireCard} blur={false}>
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
                      </GlassCard>

                      <SubmitButton style={styles.primaryButton} onPress={handleAddPeriodLog}>
                        <Text style={styles.primaryBtnText}>Save Cycle Data</Text>
                      </SubmitButton>

                      <TouchableOpacity
                        style={[styles.calendarPickerBtn, { marginTop: 8, marginBottom: 20, backgroundColor: alpha(THEME.ink[95], 0.06) }]}
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
                            <Text style={[styles.cycleHeroPhase, { color: THEME.ink[95] }]}>{phaseData.phase}</Text>
                            <Text style={styles.cycleHeroBadge}>{phaseData.badge}</Text>
                            {predictions && (
                              <Text style={styles.cycleHeroDay}>Cycle day {predictions.cycleDay} of ~{predictions.avgCycleLength}</Text>
                            )}
                            {phaseData.fertileNow && (
                              <View style={[styles.fertileChip, { alignSelf: 'flex-start', marginTop: 10 }]}>
                                <Sparkles size={12} color={THEME.ink[95]} strokeWidth={2.4} />
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
              </GlassCard>
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
              <GlassCard style={styles.settingsModalContent} tier="chrome" radius={24}>
                <View style={styles.settingsHeader}>
                  <Text style={styles.settingsTitle}>CHANGELOG</Text>
                  <TouchableOpacity onPress={() => setIsChangelogVisible(false)}>
                    <X color={THEME.ink[100]} size={20} />
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
              </GlassCard>
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
              <GlassCard style={styles.settingsModalContent} tier="chrome" radius={24}>
                <View style={styles.settingsHeader}>
                  <Text style={styles.settingsTitle}>HOSPITAL VISIT</Text>
                  <TouchableOpacity onPress={() => setOpenMedLog(null)}>
                    <X color={THEME.ink[100]} size={20} />
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
              </GlassCard>
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
    backgroundColor: THEME.colors.background,
  },
  container: {
    flex: 1,
    backgroundColor: 'transparent',
    paddingTop: Platform.OS === 'android' ? StatusBar.currentHeight || 0 : 0,
  },
  authContainer: {
    padding: THEME.spacing.md,
    alignItems: 'center',
  },
  card: {
    ...THEME.material.regular,
    padding: THEME.spacing.lg,
    borderRadius: THEME.borderRadius.lg,
    width: '100%',
    marginTop: THEME.spacing.xl,
  },
  cardTitle: {
    fontSize: 22,
    fontFamily: FONTS.bold,
    color: THEME.ink[95],
    marginBottom: THEME.spacing.md,
    textAlign: 'center',
  },
  authInfo: {
    fontFamily: FONTS.body,
    color: THEME.ink[70],
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
    // Clears the floating dock (66px tall, sitting TAB_BAR_BOTTOM off the
    // bottom) with a little breathing room — not the 140 it used to carry on
    // top of the ScrollView's own 220.
    paddingBottom: 96,
  },
  welcomeCard: {
    // A row now, with the picture beside the two lines rather than a card
    // around them: the greeting still sits as bare text on the backdrop.
    flexDirection: 'row',
    alignItems: 'center',
    gap: 14,
    paddingHorizontal: THEME.spacing.xs,
    paddingVertical: THEME.spacing.md,
    marginBottom: THEME.spacing.sm,
  },
  welcomeText: {
    // flex, so a long display name wraps or ellipsises instead of shoving the
    // picture off the left edge.
    flex: 1,
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
    color: THEME.ink[100],
    fontSize: 24,
    fontFamily: FONTS.bold,
    marginBottom: THEME.spacing.xs,
  },
  suggestionContainer: {
    backgroundColor: alpha(THEME.ink[95], 0.03),
    borderRadius: 14,
    paddingHorizontal: 14,
    paddingVertical: 12,
    marginTop: 8,
  },
  welcomeCopy: {
    // INK[70], not [50]: this is the partner-advice paragraph, the one piece of
    // running prose on the hub. At [50] it measured 4.1:1 on the card — under
    // AA, and visibly murky on device.
    color: THEME.ink[70],
    fontSize: 13,
    lineHeight: 18,
    fontFamily: FONTS.body,
  },
  partnerCard: {
    ...THEME.material.regular,
    padding: THEME.spacing.md,
    borderRadius: THEME.borderRadius.md,
    marginBottom: THEME.spacing.md,
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
    color: THEME.ink[95],
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
    ...THEME.material.regular,
    padding: THEME.spacing.md,
    borderRadius: THEME.borderRadius.md,
    marginBottom: THEME.spacing.md,
  },

  // --- Step Duel card ---
  stepTodayRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginTop: 10,
  },
  stepTodaySide: { flex: 1, gap: 2 },
  stepVersus: {
    fontFamily: FONTS.medium,
    fontSize: 11,
    color: THEME.colors.textFaint,
    paddingHorizontal: 10,
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
  // Icon-only since the duel became a graph — the word "Leading" was carrying
  // information the two numbers beside it already state. Sized as a circle
  // rather than left on the old text pill's horizontal padding, which would
  // stretch a lone icon into a lozenge.
  leaderPill: {
    width: 20,
    height: 20,
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: THEME.borderRadius.round,
    backgroundColor: THEME.colors.primary,
  },
  stepFootnote: {
    fontSize: 11,
    fontFamily: FONTS.body,
    color: THEME.colors.textFaint,
    marginTop: 14,
  },
  stepFootnoteAction: {
    color: THEME.colors.primary,
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
    ...THEME.material.well,
    marginTop: 16,
    padding: 12,
    borderRadius: THEME.borderRadius.sm,
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
    ...THEME.material.regular,
    padding: THEME.spacing.md,
    borderRadius: THEME.borderRadius.md,
    marginBottom: THEME.spacing.md,
    overflow: 'hidden', // clips the Shimmer sweep to the card's rounded corners
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
    backgroundColor: alpha(THEME.ink[95], 0.12),
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
    color: THEME.ink[95],
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
    ...THEME.material.well,
    flexGrow: 1,
    flexBasis: '46%',
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
  myMoodRow: {
    marginTop: 14,
    paddingTop: 12,
    borderTopWidth: 1,
    borderTopColor: alpha(THEME.ink[95], 0.08),
  },
  myMoodLabel: {
    fontSize: 10,
    fontFamily: FONTS.heavy,
    letterSpacing: 1.4,
    color: THEME.colors.textFaint,
    marginBottom: 8,
  },
  vocabLine: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    paddingHorizontal: 4,
    marginBottom: THEME.spacing.md,
  },
  vocabLineText: {
    flex: 1,
    fontSize: 12,
    fontFamily: FONTS.body,
    color: THEME.colors.textMuted,
  },
  vocabLineWord: {
    fontFamily: FONTS.bold,
    color: THEME.colors.text,
  },
  chatEmpty: {
    fontFamily: FONTS.body,
    fontSize: 13,
    lineHeight: 20,
    color: THEME.colors.textMuted,
  },
  bubble: {
    maxWidth: '86%',
    paddingHorizontal: 14,
    paddingVertical: 11,
    borderRadius: THEME.borderRadius.md,
    marginBottom: 10,
  },
  // The user's own turns are the accent; the assistant's are glass. Asymmetric
  // corners on the "tail" side so the two sides read as a conversation rather
  // than as a list of equal blocks.
  bubbleMine: {
    alignSelf: 'flex-end',
    backgroundColor: THEME.colors.primary,
    borderBottomRightRadius: 6,
  },
  bubbleMineText: {
    fontFamily: FONTS.medium,
    fontSize: 14,
    lineHeight: 20,
    color: THEME.colors.background,
  },
  bubbleAI: {
    ...THEME.material.regular,
    alignSelf: 'flex-start',
    borderBottomLeftRadius: 6,
  },
  bubbleAIText: {
    fontFamily: FONTS.body,
    fontSize: 14,
    lineHeight: 21,
    color: THEME.colors.text,
  },
  chatError: {
    fontFamily: FONTS.body,
    fontSize: 13,
    color: THEME.colors.danger,
    marginTop: 4,
  },
  chatBar: {
    position: 'absolute',
    left: 16,
    right: 16,
    // elevation, not just zIndex. On Android elevation decides who draws on top
    // across the tree, and the bottom vignette carries 8 — which is why the
    // composer, sitting ~100dp up inside that 220dp band, was being painted
    // over and reading as a washed-out bar.
    zIndex: 20,
    elevation: 20,
  },
  chatBarInner: {
    flexDirection: 'row',
    alignItems: 'flex-end',
    gap: 8,
    paddingVertical: 8,
    paddingLeft: 16,
    paddingRight: 8,
    /*
     * The composer sits on an empty black transcript, where a dark scrim on a
     * dark ground is no surface at all: chrome's fill measured 1.03:1 against
     * the page and the bar simply wasn't there.
     *
     * A fill can't fix that without turning into a light grey slab, so the rim
     * carries the boundary — 0.45 white clears the 3:1 non-text floor at
     * 3.9:1 — and the fill only lifts enough that the interior reads as a
     * surface rather than a hole.
     */
    backgroundColor: alpha(THEME.ink[95], 0.09),
    borderWidth: 1,
    borderColor: alpha(THEME.ink[95], 0.45),
  },
  chatInput: {
    flex: 1,
    fontFamily: FONTS.body,
    fontSize: 15,
    color: THEME.colors.text,
    maxHeight: 110,
    paddingVertical: 8,
  },
  chatSend: {
    width: 40,
    height: 40,
    borderRadius: THEME.borderRadius.round,
    backgroundColor: THEME.colors.primary,
    alignItems: 'center',
    justifyContent: 'center',
  },
  starterRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
    marginTop: 12,
  },
  starterChip: {
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: THEME.borderRadius.round,
    backgroundColor: THEME.glass.accent,
    borderWidth: 1,
    borderColor: alpha(THEME.colors.primary, 0.32),
  },
  starterChipText: {
    fontFamily: FONTS.semibold,
    fontSize: 12,
    color: THEME.colors.text,
  },
  ideaText: {
    fontFamily: FONTS.body,
    fontSize: 14,
    lineHeight: 21,
    color: THEME.colors.text,
  },
  plusMenuScrim: {
    flex: 1,
    backgroundColor: alpha(THEME.ink[0], 0.55),
    paddingTop: 96,
    paddingRight: 16,
    alignItems: 'flex-end',
  },
  plusMenu: {
    minWidth: 220,
    paddingVertical: 4,
  },
  plusMenuItem: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    paddingHorizontal: 16,
    paddingVertical: 14,
  },
  plusMenuText: {
    fontFamily: FONTS.semibold,
    fontSize: 14,
    color: THEME.colors.text,
  },
  plusMenuDivider: {
    height: 1,
    backgroundColor: alpha(THEME.ink[95], 0.08),
    marginHorizontal: 12,
  },
  ideaScroll: {
    maxHeight: 260,
    marginTop: 6,
  },
  ideaRow: {
    ...THEME.material.well,
    borderRadius: THEME.borderRadius.sm,
    padding: 12,
    marginTop: 10,
  },
  ideaSaveText: {
    fontFamily: FONTS.semibold,
    fontSize: 12,
    color: THEME.colors.primary,
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
    color: THEME.ink[95],
    fontSize: 10,
    fontFamily: FONTS.semibold,
  },
  input: {
    ...THEME.material.well,
    fontFamily: FONTS.body,
    color: THEME.ink[95],
    borderRadius: THEME.borderRadius.md,
    paddingHorizontal: THEME.spacing.md,
    paddingVertical: 14,
    fontSize: 19,
    marginBottom: THEME.spacing.sm,
  },
  primaryButton: {
    backgroundColor: THEME.colors.primary,
    padding: THEME.spacing.md,
    borderRadius: THEME.borderRadius.md,
    alignItems: 'center',
    marginTop: THEME.spacing.xs,
    ...THEME.shadow.glowAccent,
  },
  primaryBtnText: {
    color: THEME.ink[95],
    fontFamily: FONTS.heavy,
    fontSize: 19,
    letterSpacing: 1.5,
  },
  noteInput: {
    minHeight: 96,
  },
  // A tab's title row. Named for the job, not for Notes, which was the only
  // screen that had one when it was written.
  tabHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: THEME.spacing.md,
    paddingHorizontal: THEME.spacing.xs,
  },
  /*
   * The heading sits in the hottest part of the backdrop's corner burn, where
   * the composite is roughly rgb(208, 87, 1) — accent orange on accent orange,
   * which measured 1.45:1 on device and was effectively invisible. Neither
   * white (3.74:1) nor pure white (4.16:1) clears AA against a ground that
   * bright, so the fix is a scrim rather than a colour: chrome dims the burn to
   * near-black and the same accent then reads at 6.25:1.
   *
   * Chrome's own shadow is sized for a nav bar; a chip this small takes the
   * chip shadow instead, per the material rule that thickness tracks size.
   */
  tabHeaderChip: {
    ...THEME.material.chrome,
    ...THEME.shadow.chip,
    paddingHorizontal: 14,
    paddingVertical: 8,
    borderRadius: THEME.borderRadius.round,
  },
  tabHeaderText: {
    fontSize: 13,
    fontFamily: FONTS.heavy,
    color: THEME.colors.primary,
    letterSpacing: 1.5,
  },
  notesAddButton: {
    width: 42,
    height: 42,
    borderRadius: THEME.borderRadius.round,
    backgroundColor: THEME.colors.primary,
    alignItems: 'center',
    justifyContent: 'center',
    ...THEME.shadow.glowAccent,
  },
  noteGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    justifyContent: 'space-between',
  },
  noteCard: {
    ...THEME.material.regular,
    borderRadius: THEME.borderRadius.md,
    padding: THEME.spacing.md,
    width: '48%',
    marginBottom: THEME.spacing.md,
    minHeight: 128,
  },
  noteAuthor: {
    color: THEME.colors.primary,
    fontSize: 11,
    fontFamily: FONTS.heavy,
  },
  noteBody: {
    fontFamily: FONTS.body,
    color: THEME.ink[95],
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
    color: THEME.ink[95],
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
    ...THEME.material.regular,
    flex: 1,
    alignItems: 'center',
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
    color: THEME.colors.primary,
    fontSize: 22,
    lineHeight: 24,
    fontFamily: FONTS.heavy,
  },
  spinnerValue: {
    color: THEME.ink[95],
    fontSize: 40,
    fontFamily: FONTS.heavy,
    marginTop: THEME.spacing.sm,
  },
  spinnerLabel: {
    color: THEME.ink[70],
    fontSize: 10,
    fontFamily: FONTS.heavy,
    marginBottom: THEME.spacing.sm,
  },
  spinnerDivider: {
    width: 28,
    alignItems: 'center',
  },
  spinnerColon: {
    color: THEME.colors.primary,
    fontSize: 32,
    fontFamily: FONTS.heavy,
  },
  emptyCard: {
    backgroundColor: alpha(THEME.ink[95], 0.035),
    padding: THEME.spacing.lg,
    borderRadius: THEME.borderRadius.md,
    alignItems: 'center',
  },
  emptyText: {
    fontFamily: FONTS.body,
    color: THEME.ink[70],
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
    color: THEME.colors.warning,
    fontSize: 12,
    fontFamily: FONTS.bold,
  },
  // --- Detected payments ---
  //
  // Direction is carried by intensity, not by hue: money in is the accent,
  // money out is neutral ink. Under a single-accent palette there is no green
  // and red to reach for, and this reads correctly in greyscale anyway — which
  // the five-hue version never did.
  aliasButton: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: THEME.borderRadius.round,
    backgroundColor: alpha(THEME.colors.primary, 0.12),
  },
  aliasButtonText: {
    color: THEME.colors.primary,
    fontFamily: FONTS.heavy,
    fontSize: 10,
    letterSpacing: 1.2,
  },
  secondaryLink: {
    alignSelf: 'center',
    paddingVertical: 12,
    paddingHorizontal: 8,
    marginTop: 4,
  },
  secondaryLinkText: {
    color: THEME.colors.primary,
    fontSize: 13,
    fontFamily: FONTS.semibold,
  },
  paymentTitle: {
    color: THEME.ink[95],
    fontSize: 17,
    fontFamily: FONTS.bold,
    flexShrink: 1,
    marginBottom: 10,
  },
  paymentCopy: {
    color: THEME.ink[70],
    fontSize: 13,
    lineHeight: 19,
    fontFamily: FONTS.body,
  },
  paymentHint: {
    color: THEME.colors.textFaint,
    fontSize: 12,
    lineHeight: 17,
    fontFamily: FONTS.body,
    marginTop: 12,
  },
  batteryWarning: {
    ...THEME.material.thin,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    padding: 14,
    borderRadius: THEME.borderRadius.sm,
    borderColor: alpha(THEME.colors.accent, 0.35),
    marginBottom: THEME.spacing.md,
  },
  batteryWarningText: {
    flex: 1,
    color: THEME.ink[70],
    fontSize: 12,
    lineHeight: 17,
    fontFamily: FONTS.body,
  },
  paymentDay: {
    marginBottom: THEME.spacing.md,
  },
  paymentDayLabel: {
    color: THEME.colors.textFaint,
    fontSize: 11,
    fontFamily: FONTS.heavy,
    letterSpacing: 1.3,
    textTransform: 'uppercase',
    marginBottom: THEME.spacing.sm,
    paddingHorizontal: THEME.spacing.xs,
  },
  txnRow: {
    ...THEME.material.regular,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    padding: 14,
    borderRadius: THEME.borderRadius.sm,
    marginBottom: THEME.spacing.sm,
  },
  txnIcon: {
    width: 36,
    height: 36,
    borderRadius: THEME.borderRadius.round,
    alignItems: 'center',
    justifyContent: 'center',
  },
  txnIconSent: {
    backgroundColor: alpha(THEME.ink[95], 0.07),
  },
  txnIconReceived: {
    backgroundColor: alpha(THEME.colors.primary, 0.16),
  },
  txnBody: {
    flex: 1,
  },
  txnName: {
    color: THEME.ink[95],
    fontSize: 15,
    fontFamily: FONTS.semibold,
  },
  txnAmount: {
    fontSize: 16,
    fontFamily: FONTS.heavy,
    // Amounts stack down a column and have to line up; proportional digits
    // make the decimal points wander.
    fontVariant: ['tabular-nums'],
  },
  txnAmountSent: {
    color: THEME.ink[70],
  },
  txnAmountReceived: {
    color: THEME.colors.primary,
  },
  metaLine: {
    fontFamily: FONTS.body,
    fontSize: 11,
    color: THEME.ink[50],
    marginTop: 2,
  },
  predText: {
    color: THEME.colors.primary,
    fontSize: 13,
    lineHeight: 20,
    fontFamily: FONTS.semibold,
  },
  vaultRow: {
    ...THEME.material.well,
    borderRadius: THEME.borderRadius.sm,
    marginBottom: THEME.spacing.xs,
    padding: THEME.spacing.md,
    flexDirection: 'row',
    justifyContent: 'space-between',
  },
  vaultText: {
    color: THEME.ink[95],
    fontSize: 13,
    fontFamily: FONTS.bold,
  },
  vaultDate: {
    fontFamily: FONTS.body,
    color: THEME.ink[50],
    fontSize: 11,
  },
  vaultOpenHint: {
    fontFamily: FONTS.semibold,
    color: THEME.colors.primary,
    fontSize: 11,
    marginTop: 4,
  },
  emptyStateText: {
    fontFamily: FONTS.body,
    color: THEME.ink[50],
    fontSize: 13,
    marginBottom: THEME.spacing.sm,
  },
  medDetailWho: {
    fontFamily: FONTS.bold,
    color: THEME.colors.primary,
    fontSize: 15,
  },
  medDetailLabel: {
    fontFamily: FONTS.heavy,
    color: THEME.ink[50],
    fontSize: 11,
    letterSpacing: 1.2,
    marginTop: 18,
    marginBottom: 6,
  },
  medDetailValue: {
    fontFamily: FONTS.body,
    color: THEME.ink[95],
    fontSize: 15,
    lineHeight: 22,
  },
  bucketRow: {
    ...THEME.material.well,
    padding: THEME.spacing.md,
    borderRadius: THEME.borderRadius.sm,
    marginBottom: THEME.spacing.sm,
  },
  bucketText: {
    color: THEME.ink[95],
    fontSize: 14,
    fontFamily: FONTS.semibold,
  },
  bucketDescription: {
    fontFamily: FONTS.body,
    color: THEME.ink[70],
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
    ...THEME.material.chrome,
    flexDirection: 'row',
    // No explicit fill: GlassBacking owns the material here, and an opaque
    // background on this view would paint behind the BlurView and leave it
    // nothing of the screen to sample. The old near-opaque slate existed to
    // stop content bleeding through as a faint line under the active icon —
    // a real blur solves that properly rather than by hiding it.
    backgroundColor: 'transparent',
    borderRadius: 34,
    position: 'absolute',
    // `bottom` is set dynamically (TAB_BAR_BOTTOM) on the element itself.
    left: 16,
    right: 16,
    height: 66,
    justifyContent: 'space-around',
    alignItems: 'center',
    paddingHorizontal: 6,
    shadowColor: THEME.ink[0],
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
    backgroundColor: alpha(THEME.colors.primary, 0.18),
    shadowColor: THEME.colors.primary,
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
    color: THEME.ink[22],
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
    color: THEME.ink[50],
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
    color: THEME.ink[70],
    letterSpacing: 1,
    marginBottom: THEME.spacing.xs,
  },
  userIdContainer: {
    ...THEME.material.well,
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
    color: THEME.ink[95],
    // 11, not 12, and multiline on the inputs themselves. A single-line
    // TextInput SCROLLS its content rather than wrapping, so a UUID that
    // doesn't fit is silently shown truncated with no indication — on a 360dp
    // device the key rendered as `bc9374-65d2-...`, six characters into a group
    // that has eight. Someone reading their key off this screen would copy a
    // value that isn't theirs.
    fontSize: 11,
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
    color: THEME.ink[50],
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
  progressBarBg: {
    height: 8,
    backgroundColor: alpha(THEME.ink[95], 0.12),
    borderRadius: 4,
    marginTop: 4,
    overflow: 'hidden',
  },
  progressBarFill: {
    height: '100%',
    borderRadius: 4,
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
    color: THEME.colors.primary,
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
    backgroundColor: THEME.colors.primary,
    alignItems: 'center',
    justifyContent: 'center',
    shadowColor: THEME.colors.primary,
    shadowOpacity: 0.2,
    shadowRadius: 8,
    elevation: 3,
  },
  noRemindersText: {
    fontFamily: FONTS.body,
    color: THEME.ink[50],
    fontSize: 13,
    textAlign: 'center',
    paddingVertical: THEME.spacing.md,
    fontStyle: 'italic',
  },
  reminderItemRow: {
    ...THEME.material.well,
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: THEME.spacing.md,
    paddingVertical: 14,
    borderRadius: THEME.borderRadius.md,
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
    backgroundColor: THEME.colors.primary,
    ...THEME.shadow.glowAccent,
  },
  reminderTitle: {
    flex: 1,
    color: THEME.ink[95],
    fontSize: 15,
    fontFamily: FONTS.semibold,
    marginLeft: THEME.spacing.sm,
  },
  strikethroughText: {
    textDecorationLine: 'line-through',
    color: THEME.ink[50],
  },
  calendarModalOverlay: {
    flex: 1,
    backgroundColor: alpha(THEME.colors.background, 0.92),
    justifyContent: 'center',
    alignItems: 'center',
    padding: 20,
  },
  calendarModalContent: {
    ...THEME.material.chrome,
    width: '100%',
    maxWidth: 340,
    borderRadius: 24,
    padding: 18,
  },
  calendarModalTitle: {
    fontSize: 12,
    fontFamily: FONTS.heavy,
    color: THEME.colors.primary,
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
    color: THEME.ink[100],
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
    color: THEME.ink[95],
    fontSize: 14,
    fontFamily: FONTS.semibold,
  },
  questionnaireCard: {
    ...THEME.material.regular,
    borderRadius: 16,
    padding: 16,
    marginBottom: 16,
  },
  questionTitle: {
    color: THEME.colors.warning,
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
    color: THEME.ink[100],
    fontSize: 11,
    fontFamily: FONTS.semibold,
  },
  optionTextSelected: {
    color: THEME.colors.primary,
    fontFamily: FONTS.bold,
  },
  adviceCard: {
    backgroundColor: THEME.glass.accent,
    borderRadius: 16,
    padding: 16,
    marginTop: 12,
  },
  adviceHeading: {
    color: THEME.colors.warning,
    fontSize: 12,
    fontFamily: FONTS.heavy,
    letterSpacing: 1.5,
    marginBottom: 6,
  },
  adviceBody: {
    fontFamily: FONTS.display,
    color: THEME.ink[100],
    fontSize: 12,
    lineHeight: 18,
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
    width: DRAWER_WIDTH,
    ...THEME.material.chrome,
    // GlassBacking owns the fill (see tabBar), so this stays out of its way.
    backgroundColor: 'transparent',
    // No rim and no cast shadow: both existed to separate a 280px pane from the
    // dimmed screen beside it, and at full width that edge is off the display.
    //
    // The elevation stays, though, and dropping it is a trap. On Android
    // elevation — not zIndex — decides who draws on top across the tree, and
    // `bottomOverlayFade` carries elevation 8. At elevation 0 that vignette
    // painted straight over the bottom of this panel: measured on the S23, the
    // footer's own opaque fill came back as rgb(5,5,5) and the credit line at
    // 1.05:1, which is to say invisible. shadowOpacity 0 is what removes the
    // cast shadow; elevation is only here for the stacking.
    borderWidth: 0,
    shadowOpacity: 0,
    elevation: 20,
    // styles.container already offsets the tree past the status bar, so the old
    // 40 was slack a full-height panel turns into a gap above the close row.
    paddingTop: Platform.OS === 'ios' ? 20 : 12,
    paddingHorizontal: 24,
    // The panel now reaches the bottom of the window, which a 280px drawer never
    // had to think about. Mirrors TAB_BAR_BOTTOM so the footer clears Android
    // 3-button navigation.
    paddingBottom: Platform.OS === 'android' ? Math.max(ANDROID_NAV_INSET + 8, 20) : 28,
    zIndex: 1000,
  },
  drawerTopRow: {
    flexDirection: 'row',
    justifyContent: 'flex-end',
  },
  drawerClose: {
    ...THEME.material.well,
    width: 40,
    height: 40,
    borderRadius: THEME.borderRadius.round,
    alignItems: 'center',
    justifyContent: 'center',
  },
  drawerFooter: {
    marginTop: 'auto',      // pins branding to the bottom of the drawer column
    paddingTop: 20,
    paddingBottom: Platform.OS === 'ios' ? 28 : 20,
  },
  drawerBrand: {
    fontFamily: FONTS.displayBold,
    fontSize: 22,
    color: THEME.colors.primary,
    letterSpacing: 2,
  },
  drawerBrandTag: {
    fontFamily: FONTS.body,
    fontSize: 12,
    // INK[70], not [50]. Measured on the S23 once the vignette stopped covering
    // this footer, [50] came in at 4.47:1 — close enough to the AA floor to be
    // a rounding error rather than a pass.
    color: THEME.ink[70],
    marginTop: 2,
  },
  drawerCredit: {
    alignSelf: 'flex-start',
    marginTop: 10,
  },
  drawerCreditText: {
    fontFamily: FONTS.semibold,
    fontSize: 12,
    // Accent, not INK[50]. It is the app's signal for tappable text, and INK[50]
    // over the chrome panel measures 4.35:1 — under AA, on the one line in this
    // footer that is meant to be pressed. Accent on the same ground is 6.57:1.
    color: THEME.colors.primary,
  },
  drawerVersion: {
    fontFamily: FONTS.medium,
    fontSize: 11,
    // Same measurement: INK[35] was 4.27:1 here, under the floor.
    color: THEME.ink[50],
    marginTop: 8,
  },
  drawerProfileSection: {
    alignItems: 'center',
    paddingBottom: 24,
    marginBottom: 24,
  },
  // The avatar itself is a shared component now; this only carries the spacing
  // the drawer's column wants beneath it.
  drawerAvatarWrap: {
    marginBottom: 12,
  },
  drawerProfileName: {
    fontSize: 18,
    fontFamily: FONTS.bold,
    color: THEME.ink[95],
  },
  drawerProfileEmail: {
    fontFamily: FONTS.body,
    fontSize: 13,
    color: THEME.ink[50],
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
    color: THEME.colors.warning,
  },
  drawerMenuItem: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 16,
    paddingHorizontal: 12,
    borderRadius: 8,
    marginBottom: 8,
    backgroundColor: alpha(THEME.ink[95], 0.02),
  },
  drawerMenuItemLogout: {
    marginTop: 'auto',
    marginBottom: Platform.OS === 'ios' ? 40 : 24,
    backgroundColor: alpha(THEME.colors.danger, 0.05),
  },
  drawerMenuText: {
    fontSize: 15,
    fontFamily: FONTS.semibold,
    color: THEME.ink[95],
  },
  settingsModalOverlay: {
    flex: 1,
    backgroundColor: alpha(THEME.colors.background, 0.95),
    justifyContent: 'center',
    alignItems: 'center',
    padding: 20,
  },
  settingsModalContent: {
    ...THEME.material.chrome,
    width: '100%',
    maxWidth: 360,
    borderRadius: 24,
    padding: 22,
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
    color: THEME.colors.primary,
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
    color: THEME.colors.warning,
    letterSpacing: 1.5,
    marginBottom: 12,
    textTransform: 'uppercase',
  },
  settingsInput: {
    ...THEME.material.well,
    fontFamily: FONTS.body,
    borderRadius: 12,
    color: THEME.ink[95],
    paddingHorizontal: 14,
    paddingVertical: 12,
    fontSize: 14,
  },
  photoRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 14,
    marginBottom: THEME.spacing.md,
  },
  photoActions: {
    flex: 1,
    gap: 8,
  },
  photoBtn: {
    ...THEME.material.well,
    paddingVertical: 10,
    paddingHorizontal: 14,
    borderRadius: THEME.borderRadius.sm,
    alignItems: 'center',
  },
  photoBtnText: {
    fontFamily: FONTS.heavy,
    fontSize: 11,
    letterSpacing: 1.2,
    color: THEME.colors.primary,
  },
  settingsSaveButton: {
    backgroundColor: THEME.colors.primary,
    paddingVertical: 12,
    borderRadius: 12,
    alignItems: 'center',
    marginTop: 10,
    ...THEME.shadow.glowAccent,
  },
  settingsSaveBtnText: {
    color: THEME.ink[95],
    fontFamily: FONTS.bold,
    fontSize: 12,
    letterSpacing: 1.5,
  },
  settingsHelpText: {
    fontFamily: FONTS.body,
    color: THEME.ink[50],
    fontSize: 12,
    lineHeight: 16,
    marginBottom: 12,
  },
  unpairButton: {
    backgroundColor: alpha(THEME.colors.danger, 0.14),
    paddingVertical: 12,
    borderRadius: 12,
    alignItems: 'center',
  },
  unpairBtnText: {
    color: THEME.colors.danger,
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
    color: THEME.colors.primary,
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
    ...THEME.material.well,
    width: '48%',
    borderRadius: THEME.borderRadius.md,
    paddingVertical: 22,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 12,
  },
  navCardLabel: {
    color: THEME.ink[100],
    fontSize: 13,
    fontFamily: FONTS.bold,
    marginTop: 8,
    letterSpacing: 0.3,
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
    color: THEME.ink[95],
    fontSize: 15,
    fontFamily: FONTS.semibold,
  },
  onThisDayToday: {
    color: THEME.colors.primary,
    fontSize: 12,
    fontFamily: FONTS.bold,
    marginTop: 2,
  },
  onThisDaySub: {
    color: THEME.ink[50],
    fontSize: 12,
    fontFamily: FONTS.medium,
    marginTop: 2,
  },
  onThisDayManage: {
    marginTop: 14,
    alignSelf: 'flex-start',
  },
  onThisDayManageText: {
    color: THEME.colors.primary,
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
  statusChip: {
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 10,
    marginLeft: 8,
  },
  ticketRow: {
    ...THEME.material.regular,
    flexDirection: 'row',
    alignItems: 'center',
    borderRadius: 14,
    padding: 14,
    marginTop: 10,
  },
  ticketTitle: {
    color: THEME.ink[95],
    fontSize: 15,
    fontFamily: FONTS.bold,
  },
  replyBubble: {
    borderRadius: 14,
    padding: 10,
    maxWidth: '88%',
  },
  replyMine: {
    backgroundColor: alpha(THEME.colors.primary, 0.16),
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
    color: THEME.ink[100],
    fontFamily: FONTS.bold,
    fontSize: 13,
    letterSpacing: 0.3,
  },
  updateEntry: {
    ...THEME.material.regular,
    borderRadius: 12,
    padding: 12,
    marginTop: 10,
  },
  updateVersion: {
    color: THEME.colors.primary,
    fontSize: 13,
    fontFamily: FONTS.heavy,
  },
  updateDate: {
    fontFamily: FONTS.body,
    color: THEME.ink[50],
    fontSize: 11,
  },
  updateTitle: {
    color: THEME.ink[95],
    fontSize: 14,
    fontFamily: FONTS.bold,
    marginTop: 4,
  },
  updateBody: {
    fontFamily: FONTS.body,
    color: THEME.ink[100],
    fontSize: 13,
    marginTop: 4,
    lineHeight: 18,
  },
  unseenDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
    backgroundColor: THEME.colors.primary,
    marginLeft: 8,
  },
});
