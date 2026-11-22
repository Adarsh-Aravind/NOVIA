import React from 'react';
import { Pressable, StyleSheet, Text, TextInput, TextInputProps, View, ViewStyle } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import Animated, { useAnimatedScrollHandler, useSharedValue } from 'react-native-reanimated';
import { BlurView } from 'expo-blur';
import Svg, { Defs, LinearGradient as SvgGradient, Rect, Stop } from 'react-native-svg';
import { Backdrop } from './Backdrop';
import { C, F, R } from '../theme';

/** A scrolling page with a big title, clear of the status bar and the dock. */
export function Page({
  title,
  kicker,
  bottomInset,
  children,
  header,
}: {
  title: string;
  kicker?: string;
  bottomInset: number;
  children: React.ReactNode;
  header?: React.ReactNode;
}) {
  const insets = useSafeAreaInsets();
  const scrollY = useSharedValue(0);
  const onScroll = useAnimatedScrollHandler((e) => {
    scrollY.value = e.contentOffset.y;
  });
  return (
    <View style={styles.page}>
      <Backdrop scrollY={scrollY} />
      <Animated.ScrollView
        onScroll={onScroll}
        scrollEventThrottle={16}
        contentContainerStyle={{ paddingTop: insets.top + 18, paddingBottom: bottomInset + 24, paddingHorizontal: 18, gap: 14 }}
        keyboardShouldPersistTaps="handled"
      >
        <View style={{ gap: 4, paddingHorizontal: 4 }}>
          {kicker ? <Text style={styles.kicker}>{kicker}</Text> : null}
          <Text style={styles.title}>{title}</Text>
        </View>
        {header}
        {children}
      </Animated.ScrollView>
    </View>
  );
}

/**
 * Milky frosted glass. A real blur of whatever is behind the card (Android's
 * blur through expo-blur), a white frost over it, a bright top rim where the
 * light catches the edge, and a soft shadow underneath to lift it off the
 * page. The blur keeps refreshing as you scroll, so the backdrop smears past
 * behind the glass.
 */
export function Card({ children, style }: { children: React.ReactNode; style?: ViewStyle }) {
  // The outer view does the rounding and clipping (Android clips a plain
  // view to its radius reliably; the native blur view on its own doesn't).
  return (
    <View style={[styles.card, style]}>
      <BlurView
        pointerEvents="none"
        intensity={50}
        tint="default"
        blurReductionFactor={2.5}
        experimentalBlurMethod="dimezisBlurView"
        style={StyleSheet.absoluteFill}
      />
      <Svg pointerEvents="none" style={StyleSheet.absoluteFill} preserveAspectRatio="none" viewBox="0 0 100 100">
        <Defs>
          <SvgGradient id="sheen" x1="0" y1="0" x2="0.35" y2="1">
            <Stop offset="0" stopColor="#FFFFFF" stopOpacity="0.16" />
            <Stop offset="0.4" stopColor="#FFFFFF" stopOpacity="0.04" />
            <Stop offset="1" stopColor="#FFFFFF" stopOpacity="0" />
          </SvgGradient>
        </Defs>
        <Rect x="0" y="0" width="100" height="100" fill="url(#sheen)" />
      </Svg>
      {children}
    </View>
  );
}

export function Label({ children }: { children: React.ReactNode }) {
  return <Text style={styles.label}>{children}</Text>;
}

export function Field(props: TextInputProps) {
  return <TextInput placeholderTextColor={C.inkFaint} {...props} style={[styles.field, props.style]} />;
}

export function Button({
  title,
  onPress,
  kind = 'solid',
  disabled,
}: {
  title: string;
  onPress: () => void;
  kind?: 'solid' | 'ghost' | 'danger';
  disabled?: boolean;
}) {
  return (
    <Pressable
      onPress={onPress}
      disabled={disabled}
      accessibilityRole="button"
      style={({ pressed }) => [
        styles.btn,
        kind === 'ghost' && styles.btnGhost,
        kind === 'danger' && styles.btnDanger,
        (pressed || disabled) && { opacity: 0.6 },
      ]}
    >
      <Text style={[styles.btnText, kind !== 'solid' && { color: kind === 'danger' ? C.danger : C.ink }]}>{title}</Text>
    </Pressable>
  );
}

/** Segmented control, used for the sections of a page. */
export function Segments<T extends string>({ value, options, onChange }: { value: T; options: { key: T; label: string }[]; onChange: (v: T) => void }) {
  return (
    <View style={styles.segments}>
      {options.map((o) => {
        const on = o.key === value;
        return (
          <Pressable key={o.key} onPress={() => onChange(o.key)} style={[styles.seg, on && styles.segOn]} accessibilityRole="tab" accessibilityState={{ selected: on }}>
            <Text style={[styles.segText, on && styles.segTextOn]}>{o.label}</Text>
          </Pressable>
        );
      })}
    </View>
  );
}

export function Empty({ title, body }: { title: string; body: string }) {
  return (
    <View style={styles.empty}>
      <Text style={styles.emptyTitle}>{title}</Text>
      <Text style={styles.emptyBody}>{body}</Text>
    </View>
  );
}

export const ui = StyleSheet.create({
  body: { fontFamily: F.body, fontSize: 14.5, lineHeight: 21, color: C.ink },
  soft: { fontFamily: F.body, fontSize: 13, lineHeight: 18, color: C.inkSoft },
  h2: { fontFamily: F.display, fontSize: 20, color: C.ink, letterSpacing: -0.3 },
  row: { flexDirection: 'row', alignItems: 'center', gap: 10 },
});

const styles = StyleSheet.create({
  page: { flex: 1, backgroundColor: C.night },
  kicker: { fontFamily: F.semibold, fontSize: 12, letterSpacing: 1.4, textTransform: 'uppercase', color: C.inkSoft },
  title: { fontFamily: F.display, fontSize: 34, lineHeight: 38, color: C.ink, letterSpacing: -0.8 },
  card: {
    padding: 16,
    borderRadius: R.lg,
    overflow: 'hidden',
    // A whisper of white even before the blur draws, so a phone without blur
    // still gets frosted panes rather than holes.
    backgroundColor: 'rgba(255,255,255,0.07)',
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.16)',
    borderTopColor: 'rgba(255,255,255,0.38)',
    gap: 10,
  },
  label: { fontFamily: F.semibold, fontSize: 11, letterSpacing: 1.2, textTransform: 'uppercase', color: C.inkFaint },
  field: {
    minHeight: 48,
    paddingHorizontal: 14,
    paddingVertical: 12,
    borderRadius: R.md,
    backgroundColor: 'rgba(255,255,255,0.06)',
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: C.lineStrong,
    color: C.ink,
    fontFamily: F.body,
    fontSize: 15,
  },
  btn: { height: 48, borderRadius: R.pill, backgroundColor: C.star, alignItems: 'center', justifyContent: 'center', paddingHorizontal: 20 },
  btnGhost: { backgroundColor: 'transparent', borderWidth: StyleSheet.hairlineWidth, borderColor: C.lineStrong },
  btnDanger: { backgroundColor: 'transparent', borderWidth: StyleSheet.hairlineWidth, borderColor: 'rgba(255,107,107,0.5)' },
  btnText: { fontFamily: F.bold, fontSize: 15, color: C.night },
  segments: { flexDirection: 'row', padding: 4, borderRadius: R.pill, backgroundColor: 'rgba(255,255,255,0.05)', gap: 4 },
  seg: { flex: 1, height: 38, borderRadius: R.pill, alignItems: 'center', justifyContent: 'center' },
  segOn: { backgroundColor: 'rgba(255,255,255,0.12)' },
  segText: { fontFamily: F.semibold, fontSize: 13.5, color: C.inkSoft },
  segTextOn: { color: C.ink },
  empty: { paddingVertical: 28, alignItems: 'center', gap: 6 },
  emptyTitle: { fontFamily: F.displayMed, fontSize: 17, color: C.ink },
  emptyBody: { fontFamily: F.body, fontSize: 13.5, color: C.inkSoft, textAlign: 'center', maxWidth: 280, lineHeight: 19 },
});
