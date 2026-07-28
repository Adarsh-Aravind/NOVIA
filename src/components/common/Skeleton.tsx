import React, { useEffect, useRef } from 'react';
import { Animated, DimensionValue, Easing, ViewStyle } from 'react-native';
import { THEME } from '../../constants/theme';

/**
 * Skeleton — a soft pulsing placeholder for content that hasn't loaded yet.
 *
 * Deliberately a gentle opacity pulse rather than a sweeping shimmer bar: it's a
 * single native-driven (`useNativeDriver`) opacity loop, so it costs nothing on
 * the UI thread, and the calm breathing motion sits better with NOVIA's
 * neumorphic glass language than a hard highlight sweeping across. See
 * [[novia-ui-design-language]].
 *
 * Compose several of these to mirror the shape of the real content (a number
 * line, a label line, a bar) so the load reads as "content is arriving", not
 * "the app is stuck".
 */
export interface SkeletonProps {
  width?: DimensionValue;
  height?: number;
  radius?: number;
  style?: ViewStyle | ViewStyle[];
  /** Stagger the pulse so a stack of skeletons breathes as a soft wave. */
  delay?: number;
}

export function Skeleton({
  width = '100%',
  height = 14,
  radius = THEME.borderRadius.sm,
  style,
  delay = 0,
}: SkeletonProps) {
  const pulse = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    const loop = Animated.loop(
      Animated.sequence([
        Animated.timing(pulse, {
          toValue: 1,
          duration: 850,
          delay,
          easing: Easing.inOut(Easing.ease),
          useNativeDriver: true,
        }),
        Animated.timing(pulse, {
          toValue: 0,
          duration: 850,
          easing: Easing.inOut(Easing.ease),
          useNativeDriver: true,
        }),
      ])
    );
    loop.start();
    return () => loop.stop();
  }, [pulse, delay]);

  const opacity = pulse.interpolate({ inputRange: [0, 1], outputRange: [0.35, 0.8] });

  return (
    <Animated.View
      style={[
        {
          width,
          height,
          borderRadius: radius,
          backgroundColor: THEME.glass.surfaceStrong,
          opacity,
        },
        style,
      ]}
    />
  );
}
