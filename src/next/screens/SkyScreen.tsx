import React, { useEffect, useMemo, useRef, useState } from 'react';
import { Pressable, StyleSheet, Text, useWindowDimensions, Vibration, View } from 'react-native';
import Animated, {
  FadeIn,
  FadeOut,
  useAnimatedStyle,
  useSharedValue,
  withSpring,
  withTiming,
} from 'react-native-reanimated';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useClock } from '@shopify/react-native-skia';
import * as Haptics from 'expo-haptics';
import { Footprints } from 'lucide-react-native';

import { SkyCanvas, cometHead, lightPositions, ORB_SCALE, SPIN_PER_MS, starXY } from '../sky/SkyCanvas';
import type { Streak } from '../hooks/useStreak';
import { useConstellation, Star } from '../hooks/useConstellation';
import { useTogether } from '../hooks/useTogether';
import { useTilt } from '../hooks/useTilt';
import { useMood } from '../../hooks/useMood';
import { useSteps } from '../../hooks/useSteps';
import { useMilestones } from '../../hooks/useMilestones';
import { useReducedMotion } from '../../hooks/useReducedMotion';
import { daysUntilNext, occursOn, elapsedAt, formatElapsed } from '../../utils/milestoneMath';
import type { Profile } from '../../types';
import { C, F, R, MOODS, moodAdvice, moodLight, skyAt } from '../theme';
import { saveWidgetState } from '../widgets/state';

interface Props {
  profile: Profile;
  partner: Profile | null;
  coupleId: string;
  bottomInset: number;
  streak: Streak;
}

const KIND_WORD: Record<Star['kind'], string> = {
  milestone: 'Milestone',
  bucket: 'Bucket list, done',
  repair: 'Talked through',
  walk: 'Walk-off',
  journey: 'Walked together',
  note: 'Note',
  todo: 'Done together',
};

const HEARTBEAT = [0, 45, 150, 70, 605];

function greeting(h: number) {
  if (h < 5) return 'Still up';
  if (h < 12) return 'Good morning';
  if (h < 17) return 'Good afternoon';
  if (h < 21) return 'Good evening';
  return 'Good night';
}

/** The streak, said plainly: how long, and what today still needs. */
function streakLine(s: Streak, partnerName: string): string {
  if (s.days === 0) {
    if (s.meToday && !s.partnerToday) return `Streak starts when ${partnerName} opens NOVIA today`;
    return 'Open NOVIA every day, both of you, to grow a comet';
  }
  const run = `Together ${s.days} ${s.days === 1 ? 'day' : 'days'} in a row`;
  if (s.meToday && s.partnerToday) return run;
  if (s.meToday) return `${run} · waiting for ${partnerName} today`;
  return run;
}

function fmtDate(d: Date) {
  return d.toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' });
}

export function SkyScreen({ profile, partner, coupleId, bottomInset, streak }: Props) {
  const { width, height } = useWindowDimensions();
  const insets = useSafeAreaInsets();
  const reduced = useReducedMotion();
  const userId = profile.id;
  const myName = profile.display_name || 'You';
  const partnerName = partner?.display_name || 'Your partner';

  const { stars, first } = useConstellation(coupleId, userId);
  const together = useTogether();
  const { currentMood, partnerMood, updateMood } = useMood(coupleId, userId, partner?.current_mood ?? 'Neutral');
  const steps = useSteps(coupleId, userId, partner?.id);
  const { milestones } = useMilestones(coupleId, userId);

  const [now, setNow] = useState(() => new Date());
  useEffect(() => {
    const id = setInterval(() => setNow(new Date()), 60_000);
    return () => clearInterval(id);
  }, []);
  const sky = useMemo(() => skyAt(now), [now]);

  const cx = width / 2;
  const cy = height * 0.36;
  const orbR = width * ORB_SCALE;

  const clock = useClock();
  const tilt = useTilt(!reduced);
  const sep = useSharedValue(1);
  const merge = useSharedValue(0);
  const meHold = useSharedValue(0);
  const partnerHold = useSharedValue(0);
  const ripple = useSharedValue(0);
  const rippleFromMe = useSharedValue(0);
  const motion = { clock, tiltX: tilt.x, tiltY: tilt.y, sep, merge, meHold, partnerHold, ripple, rippleFromMe };

  const merged = together.holding && together.partnerHolding;
  const [mergedSince, setMergedSince] = useState<number | null>(null);
  const [heldFor, setHeldFor] = useState(0);
  const [toast, setToast] = useState<string | null>(null);
  const toastTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const showToast = (msg: string) => {
    setToast(msg);
    if (toastTimer.current) clearTimeout(toastTimer.current);
    toastTimer.current = setTimeout(() => setToast(null), 3600);
  };

  // Distance between the lights: close when you're both here, drifting apart
  // when your partner hasn't got the app open, one light when you both hold.
  useEffect(() => {
    const target = merged ? 0 : together.partnerHere ? 0.82 : 1.12;
    sep.value = reduced ? target : withSpring(target, { damping: 14, stiffness: 60 });
    merge.value = withTiming(merged ? 1 : 0, { duration: reduced ? 0 : 900 });
  }, [merged, together.partnerHere, reduced, sep, merge]);

  useEffect(() => {
    partnerHold.value = withTiming(together.partnerHolding ? 1 : 0, { duration: 500 });
  }, [together.partnerHolding, partnerHold]);

  // The heartbeat: both phones beat together for as long as you both hold.
  useEffect(() => {
    if (merged) {
      setMergedSince(Date.now());
      Vibration.vibrate(HEARTBEAT, true);
      return () => Vibration.cancel();
    }
    if (mergedSince) {
      const secs = Math.round((Date.now() - mergedSince) / 1000);
      if (secs >= 2) showToast(`You held each other for ${secs}s`);
      setMergedSince(null);
    }
    return undefined;
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [merged]);

  useEffect(() => {
    if (!mergedSince) return;
    const id = setInterval(() => setHeldFor(Math.round((Date.now() - mergedSince) / 1000)), 500);
    return () => clearInterval(id);
  }, [mergedSince]);

  // A nudge arriving: two soft taps and a ring from your partner's light.
  const lastNudge = useRef(together.nudgeCount);
  useEffect(() => {
    if (together.nudgeCount === lastNudge.current) return;
    lastNudge.current = together.nudgeCount;
    // The vibration and background notification come from TogetherProvider;
    // this screen adds the ring and the toast.
    rippleFromMe.value = 0;
    ripple.value = 0;
    ripple.value = withTiming(1, { duration: 1600 });
    showToast(`${partnerName} is thinking of you`);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [together.nudgeCount]);

  const nudge = () => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    together.sendNudge();
    rippleFromMe.value = 1;
    ripple.value = 0;
    ripple.value = withTiming(1, { duration: 1600 });
    showToast(
      together.partnerHere
        ? `Sent to ${partnerName}`
        : `Sent, but ${partnerName} isn't in NOVIA right now. Nudges only reach an open app.`
    );
  };

  const startHold = () => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
    together.setHolding(true);
    meHold.value = withTiming(1, { duration: 400 });
  };
  const endHold = () => {
    // Always release: setHolding ignores it if nothing is held, and a check
    // against `together.holding` here could read a stale value.
    together.setHolding(false);
    meHold.value = withTiming(0, { duration: 400 });
  };

  // Touch targets ride on the lights.
  const meStyle = useAnimatedStyle(() => {
    const p = lightPositions(clock.value, sep.value, width, cx, cy);
    return { transform: [{ translateX: p.ax - orbR * 1.4 }, { translateY: p.ay - orbR * 1.4 }] };
  });
  const paStyle = useAnimatedStyle(() => {
    const p = lightPositions(clock.value, sep.value, width, cx, cy);
    return { transform: [{ translateX: p.bx - orbR * 1.4 }, { translateY: p.by - orbR * 1.4 }] };
  });
  const labelsStyle = useAnimatedStyle(() => ({ opacity: 1 - merge.value }));

  // Tap a star to see what it was.
  const [tip, setTip] = useState<{ star: Star; x: number; y: number } | null>(null);
  const tapSky = (x: number, y: number) => {
    const head = cometHead(width, height);
    if (streak.days > 0 && Math.hypot(head.x - x, head.y - y) < 34) {
      Haptics.selectionAsync();
      showToast(
        `Together ${streak.days} ${streak.days === 1 ? 'day' : 'days'} in a row${streak.best > streak.days ? ` · best ${streak.best}` : ''}`
      );
      return;
    }
    const rot = clock.value * SPIN_PER_MS;
    const cos = Math.cos(rot);
    const sin = Math.sin(rot);
    let best: { star: Star; x: number; y: number; d: number } | null = null;
    for (const s of stars) {
      const p = starXY(s, width);
      const sx = cx + p.x * cos - p.y * sin;
      const sy = cy + p.x * sin + p.y * cos;
      const d = Math.hypot(sx - x, sy - y);
      if (d < 26 && (!best || d < best.d)) best = { star: s, x: sx, y: sy, d };
    }
    if (best) {
      Haptics.selectionAsync();
      setTip({ star: best.star, x: best.x, y: best.y });
    } else {
      setTip(null);
    }
  };

  const today = milestones.filter((m) => occursOn(m, now));
  const next = milestones
    .map((m) => ({ m, days: daysUntilNext(m, now) }))
    .filter((x): x is { m: (typeof milestones)[number]; days: number } => x.days !== null && x.days > 0)
    .sort((a, b) => a.days - b.days)[0];

  // Keep the home- and lock-screen widgets in step with what's on screen.
  // "Together since" is your earliest yearly milestone.
  const origin = useMemo(
    () => milestones.filter((m) => m.recurrence === 'yearly').sort((a, b) => a.milestone_date.localeCompare(b.milestone_date))[0],
    [milestones]
  );
  useEffect(() => {
    saveWidgetState({
      userId,
      coupleId,
      myName,
      partnerName,
      myMood: currentMood,
      partnerMood,
      togetherSince: origin?.milestone_date ?? null,
      togetherTitle: origin?.title ?? null,
    }).catch(() => undefined);
  }, [userId, coupleId, myName, partnerName, currentMood, partnerMood, origin]);

  const partnerLight = moodLight(partnerMood);
  const status = merged
    ? `Together · ${heldFor}s`
    : together.holding
      ? `Holding your light. Waiting for ${partnerName}…`
      : together.partnerHolding
        ? `${partnerName} is holding their light. Hold yours.`
        : together.partnerHere
          ? `${partnerName} is here with you`
          : `${partnerName}'s light is ${partnerLight.word}`;

  const sheetBottom = bottomInset + 12;

  return (
    <View style={styles.root}>
      <SkyCanvas
        width={width}
        height={height}
        cx={cx}
        cy={cy}
        sky={sky}
        stars={stars}
        motion={motion}
        me={moodLight(currentMood)}
        partner={partnerLight}
        partnerAway={!together.partnerHere}
        streakDays={streak.days}
      />

      <Pressable style={StyleSheet.absoluteFill} onPress={(e) => tapSky(e.nativeEvent.locationX, e.nativeEvent.locationY)} />

      {/* Header */}
      <View style={[styles.header, { paddingTop: insets.top + 14 }]} pointerEvents="box-none">
        <Text style={styles.kicker}>
          {now.toLocaleDateString('en-GB', { weekday: 'long', day: 'numeric', month: 'long' })}
        </Text>
        <Text style={styles.greeting} numberOfLines={1}>
          {greeting(now.getHours())}, {myName}
        </Text>
        {today.length > 0 ? (
          <View style={[styles.chip, styles.chipHot]}>
            <Text style={styles.chipText} numberOfLines={1}>
              Today · {today[0].emoji ? `${today[0].emoji} ` : ''}{today[0].title}
              {(() => {
                const e = formatElapsed(elapsedAt(today[0], now).count, elapsedAt(today[0], now).unit);
                return e ? ` · ${e}` : '';
              })()}
            </Text>
          </View>
        ) : next ? (
          <View style={styles.chip}>
            <Text style={styles.chipText} numberOfLines={1}>
              {next.m.emoji ? `${next.m.emoji} ` : ''}{next.m.title} in {next.days} {next.days === 1 ? 'day' : 'days'}
            </Text>
          </View>
        ) : null}
      </View>

      {/* Lights: hold yours, tap theirs */}
      <Animated.View style={[styles.orbHit, { width: orbR * 2.8, height: orbR * 2.8 }, meStyle]}>
        <Pressable
          style={styles.fill}
          delayLongPress={220}
          onLongPress={startHold}
          onPressOut={endHold}
          onPress={() => showToast(`Press and hold your light. If ${partnerName} holds theirs too, they meet.`)}
          accessibilityRole="button"
          accessibilityLabel="Your light. Press and hold to reach for your partner."
        />
      </Animated.View>
      <Animated.View style={[styles.orbHit, { width: orbR * 2.8, height: orbR * 2.8 }, paStyle]}>
        <Pressable
          style={styles.fill}
          onPress={nudge}
          accessibilityRole="button"
          accessibilityLabel={`${partnerName}'s light. Tap to let them know you're thinking of them.`}
        />
      </Animated.View>

      <Animated.View pointerEvents="none" style={[styles.status, { top: cy + width * 0.26 }, labelsStyle]}>
        <Text style={styles.statusText}>{status}</Text>
        <Text style={styles.statusHint}>
          {streakLine(streak, partnerName)}
          {stars.length > 0 ? ` · ${stars.length} stars` : ''}
        </Text>
      </Animated.View>
      {merged && (
        <Animated.Text entering={FadeIn.duration(600)} exiting={FadeOut} style={[styles.merged, { top: cy + width * 0.24 }]} pointerEvents="none">
          Together · {heldFor}s
        </Animated.Text>
      )}

      {tip && (
        <Animated.View
          entering={FadeIn.duration(180)}
          exiting={FadeOut.duration(150)}
          style={[styles.tip, { left: Math.min(Math.max(tip.x - 110, 16), width - 236), top: Math.max(tip.y - 92, insets.top + 8) }]}
          pointerEvents="none"
        >
          <Text style={[styles.tipKind, { color: tip.star.owner === 'me' ? C.me : tip.star.owner === 'partner' ? C.partner : C.star }]}>
            {KIND_WORD[tip.star.kind]} · {tip.star.owner === 'me' ? myName : tip.star.owner === 'partner' ? partnerName : 'Both of you'}
          </Text>
          <Text style={styles.tipText} numberOfLines={2}>{tip.star.label}</Text>
          <Text style={styles.tipDate}>{fmtDate(tip.star.at)}</Text>
        </Animated.View>
      )}

      {/* Sheet: their weather, your light, the duel */}
      <View style={[styles.sheet, { bottom: sheetBottom }]}>
        <View style={styles.row}>
          <View style={[styles.dot, { backgroundColor: C.partner }]} />
          <Text style={styles.sheetTitle} numberOfLines={1}>
            {partnerName} · {partnerMood === 'Neutral' ? 'Steady' : partnerMood}
          </Text>
        </View>
        <Text style={styles.advice}>{moodAdvice(partnerMood, partnerName)}</Text>

        <Text style={styles.label}>Your light</Text>
        <View style={styles.moods}>
          {MOODS.map((m) => {
            const on = currentMood === m;
            return (
              <Pressable
                key={m}
                onPress={() => {
                  Haptics.selectionAsync();
                  updateMood(on ? 'Neutral' : m);
                }}
                style={[styles.mood, on && styles.moodOn]}
                accessibilityRole="button"
                accessibilityState={{ selected: on }}
              >
                <Text style={[styles.moodText, on && styles.moodTextOn]}>{m}</Text>
              </Pressable>
            );
          })}
        </View>

        <Pressable
          style={styles.steps}
          onPress={() => (steps.status === 'ready' ? steps.refresh() : steps.requestAccess())}
          accessibilityRole="button"
        >
          <Footprints size={16} color={C.inkSoft} />
          {steps.status === 'ready' ? (
            <View style={styles.duel}>
              <StepBar value={steps.mySteps} other={steps.partnerSteps} colour={C.me} name={myName} />
              <StepBar value={steps.partnerSteps} other={steps.mySteps} colour={C.partner} name={partnerName} />
            </View>
          ) : (
            <Text style={styles.stepsCta}>
              {steps.status === 'unavailable' ? 'Steps need Health Connect' : 'Connect steps to start today’s walk-off'}
            </Text>
          )}
        </Pressable>
      </View>

      {toast && (
        <Animated.View entering={FadeIn.duration(200)} exiting={FadeOut.duration(200)} style={[styles.toast, { top: insets.top + 8 }]} pointerEvents="none">
          <Text style={styles.toastText}>{toast}</Text>
        </Animated.View>
      )}
    </View>
  );
}

function StepBar({ value, other, colour, name }: { value: number; other: number; colour: string; name: string }) {
  const max = Math.max(value, other, 1);
  return (
    <View style={styles.bar}>
      <Text style={styles.barName} numberOfLines={1}>{name}</Text>
      <View style={styles.barTrack}>
        <View style={[styles.barFill, { width: `${Math.max(4, (value / max) * 100)}%`, backgroundColor: colour }]} />
      </View>
      <Text style={styles.barNum}>{value.toLocaleString('en-IN')}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: C.night },
  fill: { flex: 1 },
  header: { position: 'absolute', left: 0, right: 0, paddingHorizontal: 22, gap: 4 },
  kicker: { fontFamily: F.semibold, fontSize: 12, letterSpacing: 1.4, textTransform: 'uppercase', color: C.inkSoft },
  greeting: { fontFamily: F.display, fontSize: 30, lineHeight: 34, color: C.ink, letterSpacing: -0.6 },
  chip: {
    alignSelf: 'flex-start',
    marginTop: 8,
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: R.pill,
    backgroundColor: 'rgba(255,255,255,0.07)',
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: C.lineStrong,
  },
  chipHot: { backgroundColor: 'rgba(255,243,224,0.14)', borderColor: 'rgba(255,243,224,0.4)' },
  chipText: { fontFamily: F.medium, fontSize: 13, color: C.ink },
  orbHit: { position: 'absolute', left: 0, top: 0, borderRadius: 999 },
  status: { position: 'absolute', left: 24, right: 24, alignItems: 'center', gap: 4 },
  statusText: { fontFamily: F.displayMed, fontSize: 17, color: C.ink, textAlign: 'center' },
  statusHint: { fontFamily: F.body, fontSize: 12.5, color: C.inkSoft, textAlign: 'center' },
  merged: {
    position: 'absolute',
    alignSelf: 'center',
    fontFamily: F.display,
    fontSize: 22,
    color: C.star,
    letterSpacing: -0.3,
  },
  tip: {
    position: 'absolute',
    width: 220,
    padding: 12,
    borderRadius: R.md,
    backgroundColor: C.glassHi,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: C.lineStrong,
    gap: 3,
  },
  tipKind: { fontFamily: F.bold, fontSize: 11, letterSpacing: 0.8, textTransform: 'uppercase' },
  tipText: { fontFamily: F.medium, fontSize: 14, color: C.ink },
  tipDate: { fontFamily: F.body, fontSize: 12, color: C.inkSoft },
  sheet: {
    position: 'absolute',
    left: 12,
    right: 12,
    padding: 18,
    borderRadius: R.lg,
    backgroundColor: C.glass,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: C.lineStrong,
    gap: 8,
  },
  row: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  dot: { width: 8, height: 8, borderRadius: 4 },
  sheetTitle: { flex: 1, fontFamily: F.display, fontSize: 19, color: C.ink, letterSpacing: -0.3 },
  advice: { fontFamily: F.body, fontSize: 14, lineHeight: 20, color: C.inkSoft },
  label: { marginTop: 6, fontFamily: F.semibold, fontSize: 11, letterSpacing: 1.2, textTransform: 'uppercase', color: C.inkFaint },
  moods: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  mood: {
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: R.pill,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: C.lineStrong,
    backgroundColor: 'rgba(255,255,255,0.04)',
  },
  moodOn: { backgroundColor: C.meSoft, borderColor: C.me },
  moodText: { fontFamily: F.medium, fontSize: 13, color: C.inkSoft },
  moodTextOn: { color: C.ink },
  steps: {
    marginTop: 6,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    paddingTop: 12,
    borderTopWidth: StyleSheet.hairlineWidth,
    borderTopColor: C.line,
  },
  stepsCta: { flex: 1, fontFamily: F.medium, fontSize: 13.5, color: C.inkSoft },
  duel: { flex: 1, gap: 6 },
  bar: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  barName: { width: 64, fontFamily: F.medium, fontSize: 12.5, color: C.inkSoft },
  barTrack: { flex: 1, height: 6, borderRadius: 3, backgroundColor: 'rgba(255,255,255,0.07)', overflow: 'hidden' },
  barFill: { height: 6, borderRadius: 3 },
  barNum: { width: 56, textAlign: 'right', fontFamily: F.semibold, fontSize: 12.5, color: C.ink, fontVariant: ['tabular-nums'] },
  toast: {
    position: 'absolute',
    alignSelf: 'center',
    maxWidth: '86%',
    paddingHorizontal: 16,
    paddingVertical: 10,
    borderRadius: R.pill,
    backgroundColor: C.glassHi,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: C.lineStrong,
  },
  toastText: { fontFamily: F.medium, fontSize: 13.5, color: C.ink, textAlign: 'center' },
});
