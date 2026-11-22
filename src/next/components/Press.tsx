import React from 'react';
import { GestureResponderEvent, Pressable, PressableProps, StyleProp, ViewStyle } from 'react-native';
import Animated, { useAnimatedStyle, useSharedValue, withSpring } from 'react-native-reanimated';
import * as Haptics from 'expo-haptics';
import { SPRING } from '../motion';

const APressable = Animated.createAnimatedComponent(Pressable);

/**
 * A Pressable that answers on touch-down, the way Apple's controls do: it
 * sinks the instant a finger lands, with a light tick, and springs back on
 * release. Waiting for the finger to lift before reacting is what makes a tap
 * feel dead.
 *
 * The spring is critically damped (a press carries no momentum, so no
 * bounce), and re-targets from wherever it is, so tapping fast never stutters.
 */
export function Press({
  style,
  depth = 0.96,
  haptic = true,
  onPressIn,
  onPressOut,
  ...rest
}: Omit<PressableProps, 'style'> & { style?: StyleProp<ViewStyle>; depth?: number; haptic?: boolean }) {
  const scale = useSharedValue(1);
  const anim = useAnimatedStyle(() => ({ transform: [{ scale: scale.value }] }));
  return (
    <APressable
      {...rest}
      style={[style, anim]}
      onPressIn={(e: GestureResponderEvent) => {
        scale.value = withSpring(depth, SPRING.press);
        if (haptic && !rest.disabled) Haptics.selectionAsync().catch(() => undefined);
        onPressIn?.(e);
      }}
      onPressOut={(e: GestureResponderEvent) => {
        scale.value = withSpring(1, SPRING.press);
        onPressOut?.(e);
      }}
    />
  );
}
