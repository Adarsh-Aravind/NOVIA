import React from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import * as Haptics from 'expo-haptics';
import { Sparkles, Layers, HeartPulse, CircleUser } from 'lucide-react-native';
import { C, F, R } from '../theme';

export type TabKey = 'sky' | 'us' | 'care' | 'you';

const TABS: { key: TabKey; label: string; Icon: typeof Sparkles }[] = [
  { key: 'sky', label: 'Sky', Icon: Sparkles },
  { key: 'us', label: 'Us', Icon: Layers },
  { key: 'care', label: 'Care', Icon: HeartPulse },
  { key: 'you', label: 'You', Icon: CircleUser },
];

/** A floating dock. The active place shows its name; the rest are icons. */
export function Dock({ tab, onChange, bottom }: { tab: TabKey; onChange: (t: TabKey) => void; bottom: number }) {
  return (
    <View style={[styles.wrap, { bottom: bottom + 10 }]} pointerEvents="box-none">
      <View style={styles.dock}>
        {TABS.map(({ key, label, Icon }) => {
          const on = tab === key;
          return (
            <Pressable
              key={key}
              onPress={() => {
                if (!on) Haptics.selectionAsync();
                onChange(key);
              }}
              style={[styles.item, on && styles.itemOn]}
              accessibilityRole="tab"
              accessibilityState={{ selected: on }}
              accessibilityLabel={label}
              hitSlop={6}
            >
              <Icon size={19} color={on ? C.night : C.inkSoft} strokeWidth={on ? 2.4 : 2} />
              {on && <Text style={styles.label}>{label}</Text>}
            </Pressable>
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
  itemOn: { backgroundColor: C.star },
  label: { fontFamily: F.bold, fontSize: 14, color: C.night },
});
