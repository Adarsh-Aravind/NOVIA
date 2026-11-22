import React, { useMemo, useRef, useState } from 'react';
import { Modal, Pressable, StyleSheet, Text, useWindowDimensions, View } from 'react-native';
import Animated, { FadeIn, runOnJS, useAnimatedStyle, useSharedValue, withSpring, withTiming } from 'react-native-reanimated';
import { Gesture, GestureDetector, GestureHandlerRootView } from 'react-native-gesture-handler';
import { Press } from '../components/Press';
import { SPRING, project, rubberband } from '../motion';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Canvas, Circle, LinearGradient, Rect, vec } from '@shopify/react-native-skia';
import * as Haptics from 'expo-haptics';
import { X, Share2 } from 'lucide-react-native';
import { RecapData } from './useRecap';
import { C, F, R } from '../theme';

/**
 * The month as a short story: five cards you tap through, like a status. The
 * last one can be shared as an image.
 */

const GRADIENTS: [string, string][] = [
  ['#2A1A44', '#07060E'],
  ['#3A1E14', '#0E0B1F'],
  ['#1A2450', '#07060E'],
  ['#2B1838', '#120A26'],
  ['#3A2A18', '#0E0B1F'],
];

/** A fixed scatter of stars, so each card has a little sky behind it. */
function useStarfield(w: number, h: number, seed: number) {
  return useMemo(() => {
    let s = seed * 9301 + 49297;
    const rnd = () => {
      s = (s * 9301 + 49297) % 233280;
      return s / 233280;
    };
    return Array.from({ length: 60 }, () => ({ x: rnd() * w, y: rnd() * h * 0.7, r: 0.6 + rnd() * 1.6, o: 0.25 + rnd() * 0.6 }));
  }, [w, h, seed]);
}

export function Recap({ data, myName, partnerName, onClose }: { data: RecapData; myName: string; partnerName: string; onClose: () => void }) {
  const { width, height } = useWindowDimensions();
  const insets = useSafeAreaInsets();
  const [i, setI] = useState(0);
  const cardRef = useRef<View>(null);
  const fmt = (n: number) => n.toLocaleString('en-IN');
  const km = (steps: number) => Math.round(steps * 0.00075);
  const winner = data.myWins === data.partnerWins ? null : data.myWins > data.partnerWins ? myName : partnerName;

  const cards = [
    {
      kicker: 'Your month in stars',
      big: data.monthLabel.split(' ')[0],
      lines: [`${data.newStars} new ${data.newStars === 1 ? 'star' : 'stars'} in your sky`, `${data.daysInMonth} days, two lights`],
    },
    {
      kicker: 'The walk-off',
      big: winner ? `${winner} wins` : 'Dead heat',
      lines: [
        `${myName} took ${data.myWins} ${data.myWins === 1 ? 'day' : 'days'}, ${partnerName} took ${data.partnerWins}${data.ties ? `, ${data.ties} tied` : ''}`,
        `${fmt(data.mySteps + data.partnerSteps)} steps between you, about ${fmt(km(data.mySteps + data.partnerSteps))} km`,
      ],
    },
    {
      kicker: 'Your best day',
      big: data.bestDay ? new Date(data.bestDay.date).toLocaleDateString('en-GB', { day: 'numeric', month: 'short' }) : 'Still to come',
      lines: data.bestDay ? [`${fmt(data.bestDay.steps)} steps together that day`, 'Whatever you did, do it again'] : ['No steps synced this month', 'Connect steps on the Sky page'],
    },
    {
      kicker: 'What you made',
      big: `${data.notes + data.someday + data.repairs}`,
      lines: [
        `${data.notes} ${data.notes === 1 ? 'note' : 'notes'} · ${data.someday} someday ${data.someday === 1 ? 'thing' : 'things'} done`,
        data.repairs ? `${data.repairs} ${data.repairs === 1 ? 'thing' : 'things'} talked through and repaired` : 'Nothing needed repairing',
      ],
    },
    {
      kicker: data.monthLabel,
      big: `Here's to ${data.nextMonthLabel}.`,
      lines: [`${myName} & ${partnerName}`, 'NOVIA'],
    },
  ];
  const card = cards[i];
  const stars = useStarfield(width, height, i + 1);
  const last = i === cards.length - 1;

  // Pull the story down to put it away. It follows the finger 1:1, shrinks a
  // touch and lets the app show through as it goes, and resists being pushed
  // up. Let go and it projects where the flick was heading: past a third of
  // the screen it leaves downwards at the finger's own speed (the way it'd
  // keep falling), otherwise it springs back into place.
  const pull = useSharedValue(0);
  const close = () => onClose();
  const swipe = Gesture.Pan()
    .activeOffsetY(12)
    .failOffsetX([-24, 24])
    .onUpdate((e) => {
      pull.value = e.translationY >= 0 ? e.translationY : rubberband(e.translationY, height);
    })
    .onEnd((e) => {
      if (pull.value + project(e.velocityY) > height / 3) {
        const remaining = Math.max(height - pull.value, 1);
        const ms = Math.min(320, Math.max(140, (remaining / Math.max(e.velocityY, 1)) * 1000));
        pull.value = withTiming(height, { duration: ms }, (done) => {
          if (done) runOnJS(close)();
        });
      } else {
        pull.value = withSpring(0, { ...SPRING.flick, velocity: e.velocityY });
      }
    });
  const sheet = useAnimatedStyle(() => {
    const p = Math.min(Math.max(pull.value / height, 0), 1);
    return {
      transform: [{ translateY: pull.value }, { scale: 1 - p * 0.08 }],
      borderRadius: p > 0 ? 28 : 0,
      opacity: 1 - p * 0.35,
    };
  });

  const go = (d: number) => {
    const n = i + d;
    if (n < 0) return;
    if (n >= cards.length) return onClose();
    Haptics.selectionAsync();
    setI(n);
  };

  const share = async () => {
    try {
      const { captureRef } = require('react-native-view-shot') as typeof import('react-native-view-shot');
      const Sharing = require('expo-sharing') as typeof import('expo-sharing');
      const uri = await captureRef(cardRef, { format: 'png', quality: 1 });
      await Sharing.shareAsync(uri, { mimeType: 'image/png', dialogTitle: 'Share your month' });
    } catch {
      // Sharing needs the native modules from the latest build.
    }
  };

  return (
    <Modal visible animationType="fade" transparent statusBarTranslucent onRequestClose={onClose}>
      <GestureHandlerRootView style={styles.flex}>
      <GestureDetector gesture={swipe}>
      <Animated.View style={[styles.flex, styles.clip, sheet]}>
      <View ref={cardRef} collapsable={false} style={styles.root}>
        <Canvas style={StyleSheet.absoluteFill}>
          <Rect x={0} y={0} width={width} height={height}>
            <LinearGradient start={vec(0, 0)} end={vec(0, height)} colors={GRADIENTS[i]} />
          </Rect>
          {stars.map((s, k) => (
            <Circle key={k} cx={s.x} cy={s.y} r={s.r} color={C.star} opacity={s.o} />
          ))}
          <Circle cx={width * 0.32} cy={height * 0.3} r={width * 0.11} color={C.me} opacity={0.9} />
          <Circle cx={width * 0.62} cy={height * 0.25} r={width * 0.09} color={C.partner} opacity={0.9} />
        </Canvas>

        <Animated.View key={i} entering={FadeIn.duration(350)} style={[styles.content, { paddingBottom: insets.bottom + 110 }]}>
          <Text style={styles.kicker}>{card.kicker}</Text>
          <Text style={styles.big}>{card.big}</Text>
          {card.lines.map((l) => (
            <Text key={l} style={styles.line}>
              {l}
            </Text>
          ))}
        </Animated.View>
      </View>

      <View style={[styles.bars, { top: insets.top + 10 }]} pointerEvents="none">
        {cards.map((_, k) => (
          <View key={k} style={[styles.bar, k <= i && styles.barOn]} />
        ))}
      </View>
      <Pressable onPress={onClose} style={[styles.close, { top: insets.top + 26 }]} accessibilityRole="button" accessibilityLabel="Close" hitSlop={10}>
        <X size={22} color={C.ink} />
      </Pressable>

      <Pressable style={[styles.half, { left: 0 }]} onPress={() => go(-1)} accessibilityLabel="Previous" />
      <Pressable style={[styles.half, { right: 0 }]} onPress={() => go(1)} accessibilityLabel="Next" />

      {last && (
        <Press onPress={share} style={[styles.share, { bottom: insets.bottom + 32 }]} accessibilityRole="button">
          <Share2 size={18} color={C.night} />
          <Text style={styles.shareText}>Share</Text>
        </Press>
      )}
      </Animated.View>
      </GestureDetector>
      </GestureHandlerRootView>
    </Modal>
  );
}

const styles = StyleSheet.create({
  flex: { flex: 1 },
  clip: { overflow: 'hidden', backgroundColor: C.night },
  root: { flex: 1, backgroundColor: C.night },
  content: { flex: 1, justifyContent: 'flex-end', paddingHorizontal: 28, gap: 8 },
  kicker: { fontFamily: F.semibold, fontSize: 13, letterSpacing: 1.6, textTransform: 'uppercase', color: C.inkSoft },
  big: { fontFamily: F.display, fontSize: 52, lineHeight: 56, color: C.ink, letterSpacing: -1.5, marginBottom: 8 },
  line: { fontFamily: F.medium, fontSize: 17, lineHeight: 24, color: C.ink },
  bars: { position: 'absolute', left: 14, right: 14, flexDirection: 'row', gap: 4 },
  bar: { flex: 1, height: 3, borderRadius: 2, backgroundColor: 'rgba(255,255,255,0.22)' },
  barOn: { backgroundColor: C.star },
  close: { position: 'absolute', right: 18 },
  half: { position: 'absolute', top: 90, bottom: 110, width: '50%' },
  share: {
    position: 'absolute',
    alignSelf: 'center',
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    paddingHorizontal: 22,
    height: 48,
    borderRadius: R.pill,
    backgroundColor: C.star,
  },
  shareText: { fontFamily: F.bold, fontSize: 15, color: C.night },
});
