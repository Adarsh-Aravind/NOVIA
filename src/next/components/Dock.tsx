import React, { useEffect, useRef } from 'react';
import { LayoutChangeEvent, StyleSheet, Text, View } from 'react-native';
import Animated, { useAnimatedStyle, useSharedValue, withSpring } from 'react-native-reanimated';
import { Sparkles, Layers, HeartPulse, CircleUser } from 'lucide-react-native';
import { Press } from './Press';
import { SPRING } from '../motion';
import { C, F, R } from '../theme';

export type TabKey = 'sky' | 'us' | 'care' | 'you';

const TABS: { key: TabKey; label: string; Icon: typeof Sparkles }[] = [
  { key: 'sky', label: 'Sky', Icon: Sparkles },
  { key: 'us', label: 'Us', Icon: Layers },
  { key: 'care', label: 'Care', Icon: HeartPulse },
  { key: 'you', label: 'You', Icon: CircleUser },
];

/**
 * A floating dock. The active place shows its name on a light pill, and the
 * pill is one object that slides and stretches to the next tab on a
 * critically damped spring, rather than vanishing from one tab and appearing
 * on another. Because it's a spring, a second tap mid-slide simply re-targets
 * it from wherever it is.
 */
export function Dock({ tab, onChange, bottom }: { tab: TabKey; onChange: (t: TabKey) => void; bottom: number }) {
  const frames = useRef<Partial<Record<TabKey, { x: number; w: number }>>>({});
  const x = useSharedValue(0);
  const w = useSharedValue(0);
  const placed = useRef(false);

  const moveTo = (key: TabKey) => {
    const f = frames.current[key];
    if (!f) return;
    if (!placed.current) {
      // First layout: put it there without animating in from the corner.
      x.value = f.x;
      w.value = f.w;
      placed.current = true;
      return;
    }
    x.value = withSpring(f.x, SPRING.snap);
    w.value = withSpring(f.w, SPRING.snap);
  };

  useEffect(() => {
    moveTo(tab);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [tab]);

  const pill = useAnimatedStyle(() => ({ width: w.value, transform: [{ translateX: x.value }], opacity: w.value > 0 ? 1 : 0 }));

  return (
    <View style={[styles.wrap, { bottom: bottom + 10 }]} pointerEvents="box-none">
      <View style={styles.dock}>
        <Animated.View pointerEvents="none" style={[styles.pill, pill]} />
        {TABS.map(({ key, label, Icon }) => {
          const on = tab === key;
          return (
            <Press
              key={key}
              depth={0.92}
              haptic={!on}
              onLayout={(e: LayoutChangeEvent) => {
                frames.current[key] = { x: e.nativeEvent.layout.x, w: e.nativeEvent.layout.width };
                if (key === tab) moveTo(key);
              }}
              onPress={() => onChange(key)}
              style={styles.item}
              accessibilityRole="tab"
              accessibilityState={{ selected: on }}
              accessibilityLabel={label}
              hitSlop={6}
            >
              <Icon size={19} color={on ? C.night : C.inkSoft} strokeWidth={on ? 2.4 : 2} />
              {on && <Text style={styles.label}>{label}</Text>}
            </Press>
          );
        })}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: { position: 'absolute', left: 0, right: 0, alignItems: 'center' },
  dock: {
    flexDirection: 'row',
    gap: 4,
    padding: 6,
    borderRadius: R.pill,
    backgroundColor: 'rgba(12,10,26,0.92)',
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: C.lineStrong,
    elevation: 12,
  },
  pill: { position: 'absolute', top: 6, left: 0, height: 46, borderRadius: R.pill, backgroundColor: C.star },
  item: {
    height: 46,
    minWidth: 52,
    paddingHorizontal: 14,
    borderRadius: R.pill,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
  },
  label: { fontFamily: F.bold, fontSize: 14, color: C.night },
});
