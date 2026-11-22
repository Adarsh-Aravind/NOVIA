import React from 'react';
import { ScrollView, StyleSheet, Text, TextInput, TextInputProps, View, ViewStyle } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import Animated, { useAnimatedScrollHandler, useSharedValue } from 'react-native-reanimated';
import { Backdrop } from './Backdrop';
import { Press } from './Press';
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
 * A card: a solid deep-indigo panel with a fine border and a slightly brighter
 * top edge. It was frosted glass for a while; that was hard to read over the
 * moving backdrop, and Android's live blur re-blurred the screen behind every
 * card on every frame (measured: about 40% slow frames while scrolling). Solid
 * panels read clearly and cost nothing.
 */
export function Card({ children, style }: { children: React.ReactNode; style?: ViewStyle }) {
  return <View style={[styles.card, style]}>{children}</View>;
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
    <Press
      onPress={onPress}
      disabled={disabled}
      accessibilityRole="button"
      accessibilityState={{ disabled: !!disabled }}
      style={[styles.btn, kind === 'ghost' && styles.btnGhost, kind === 'danger' && styles.btnDanger, disabled && { opacity: 0.5 }]}
    >
      <Text style={[styles.btnText, kind !== 'solid' && { color: kind === 'danger' ? C.danger : C.ink }]}>{title}</Text>
    </Press>
  );
}

/** Segmented control, used for the sections of a page. */
export function Segments<T extends string>({ value, options, onChange }: { value: T; options: { key: T; label: string }[]; onChange: (v: T) => void }) {
  const pills = options.map((o) => {
    const on = o.key === value;
    return (
      <Press
        key={o.key}
        depth={0.94}
        onPress={() => onChange(o.key)}
        style={[styles.seg, options.length > 4 && styles.segScroll, on && styles.segOn]}
        accessibilityRole="tab"
        accessibilityState={{ selected: on }}
      >
        <Text style={[styles.segText, on && styles.segTextOn]}>{o.label}</Text>
      </Press>
    );
  });
  // More than four don't fit across a phone, so they scroll sideways.
  if (options.length > 4) {
    return (
      <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.segments} style={styles.segmentsScroll}>
        {pills}
      </ScrollView>
    );
  }
  return <View style={styles.segments}>{pills}</View>;
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
    backgroundColor: C.panel,
    borderWidth: 1,
    borderColor: C.line,
    borderTopColor: C.lineStrong,
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
  segScroll: { flex: 0, paddingHorizontal: 16 },
  segmentsScroll: { flexGrow: 0, borderRadius: R.pill },
  segText: { fontFamily: F.semibold, fontSize: 13.5, color: C.inkSoft },
  segTextOn: { color: C.ink },
  empty: { paddingVertical: 28, alignItems: 'center', gap: 6 },
  emptyTitle: { fontFamily: F.displayMed, fontSize: 17, color: C.ink },
  emptyBody: { fontFamily: F.body, fontSize: 13.5, color: C.inkSoft, textAlign: 'center', maxWidth: 280, lineHeight: 19 },
});
