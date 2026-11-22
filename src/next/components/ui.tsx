import React from 'react';
import { Pressable, ScrollView, StyleSheet, Text, TextInput, TextInputProps, useWindowDimensions, View, ViewStyle } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Canvas, LinearGradient, Rect, vec } from '@shopify/react-native-skia';
import { C, F, R } from '../theme';

const GLOW_H = 520;

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
  const { width } = useWindowDimensions();
  return (
    <View style={styles.page}>
      <Canvas style={styles.glow} pointerEvents="none">
        <Rect x={0} y={0} width={width} height={GLOW_H}>
          <LinearGradient start={vec(0, 0)} end={vec(0, GLOW_H)} colors={[C.dusk, 'rgba(26,19,54,0.45)', 'rgba(7,6,14,0)']} />
        </Rect>
      </Canvas>
      <ScrollView
        contentContainerStyle={{ paddingTop: insets.top + 18, paddingBottom: bottomInset + 24, paddingHorizontal: 18, gap: 14 }}
        keyboardShouldPersistTaps="handled"
      >
        <View style={{ gap: 4, paddingHorizontal: 4 }}>
          {kicker ? <Text style={styles.kicker}>{kicker}</Text> : null}
          <Text style={styles.title}>{title}</Text>
        </View>
        {header}
        {children}
      </ScrollView>
    </View>
  );
}

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
  glow: { position: 'absolute', top: 0, left: 0, right: 0, height: GLOW_H },
  kicker: { fontFamily: F.semibold, fontSize: 12, letterSpacing: 1.4, textTransform: 'uppercase', color: C.inkSoft },
  title: { fontFamily: F.display, fontSize: 34, lineHeight: 38, color: C.ink, letterSpacing: -0.8 },
  card: {
    padding: 16,
    borderRadius: R.lg,
    backgroundColor: 'rgba(255,255,255,0.045)',
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: C.line,
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
