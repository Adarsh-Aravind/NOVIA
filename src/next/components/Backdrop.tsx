import React, { useMemo } from 'react';
import { StyleSheet, useWindowDimensions } from 'react-native';
import Animated, { SharedValue, useAnimatedStyle } from 'react-native-reanimated';
import Svg, { Circle, Defs, LinearGradient, RadialGradient, Rect, Stop } from 'react-native-svg';
import { C } from '../theme';

/**
 * The soft aurora behind every page: a dusk gradient, three glows in your
 * colour, your partner's and starlight, and a scatter of small stars.
 *
 * It's SVG on purpose. The frosted glass cards blur whatever is drawn behind
 * them, and Android's blur can only capture ordinary views. A Skia canvas
 * would come out blank through the glass. It drifts a little as you scroll so
 * the frost visibly moves.
 */
export function Backdrop({ scrollY }: { scrollY?: SharedValue<number> }) {
  const { width, height } = useWindowDimensions();
  const h = height * 1.4;

  const stars = useMemo(() => {
    let s = 7;
    const rnd = () => {
      s = (s * 9301 + 49297) % 233280;
      return s / 233280;
    };
    return Array.from({ length: 70 }, () => ({ x: rnd() * width, y: rnd() * h, r: 0.7 + rnd() * 1.5, o: 0.25 + rnd() * 0.6 }));
  }, [width, h]);

  const drift = useAnimatedStyle(() => ({
    transform: [{ translateY: scrollY ? -Math.min(scrollY.value * 0.25, height * 0.4) : 0 }],
  }));

  return (
    <Animated.View pointerEvents="none" style={[StyleSheet.absoluteFill, { height: h }, drift]}>
      <Svg width={width} height={h}>
        <Defs>
          <LinearGradient id="sky" x1="0" y1="0" x2="0" y2="1">
            <Stop offset="0" stopColor="#1E1640" />
            <Stop offset="0.45" stopColor="#0E0B1F" />
            <Stop offset="1" stopColor={C.night} />
          </LinearGradient>
          <RadialGradient id="me" cx="50%" cy="50%" r="50%">
            <Stop offset="0" stopColor={C.me} stopOpacity="0.75" />
            <Stop offset="1" stopColor={C.me} stopOpacity="0" />
          </RadialGradient>
          <RadialGradient id="pa" cx="50%" cy="50%" r="50%">
            <Stop offset="0" stopColor={C.partner} stopOpacity="0.7" />
            <Stop offset="1" stopColor={C.partner} stopOpacity="0" />
          </RadialGradient>
          <RadialGradient id="st" cx="50%" cy="50%" r="50%">
            <Stop offset="0" stopColor="#6C4BD8" stopOpacity="0.55" />
            <Stop offset="1" stopColor="#6C4BD8" stopOpacity="0" />
          </RadialGradient>
        </Defs>
        <Rect x={0} y={0} width={width} height={h} fill="url(#sky)" />
        <Circle cx={width * 0.12} cy={h * 0.2} r={width * 0.55} fill="url(#me)" />
        <Circle cx={width * 0.95} cy={h * 0.36} r={width * 0.6} fill="url(#pa)" />
        <Circle cx={width * 0.35} cy={h * 0.62} r={width * 0.65} fill="url(#st)" />
        <Circle cx={width * 0.85} cy={h * 0.85} r={width * 0.45} fill="url(#me)" opacity={0.6} />
        {stars.map((s, i) => (
          <Circle key={i} cx={s.x} cy={s.y} r={s.r} fill={C.star} opacity={s.o} />
        ))}
      </Svg>
    </Animated.View>
  );
}
