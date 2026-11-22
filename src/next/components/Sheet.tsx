import React, { useState } from 'react';
import { KeyboardAvoidingView, Modal, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Calendar } from 'react-native-calendars';
import { CalendarDays } from 'lucide-react-native';
import { Press } from './Press';
import { parseLocalDate, toLocalISODate } from '../../utils/dateUtils';
import { C, F, R } from '../theme';

/**
 * A bottom sheet for forms and choices. It slides up over a dimmed scrim;
 * tap the scrim or the system back gesture to close.
 */
export function Sheet({
  visible,
  title,
  onClose,
  children,
}: {
  visible: boolean;
  title: string;
  onClose: () => void;
  children: React.ReactNode;
}) {
  const insets = useSafeAreaInsets();
  return (
    <Modal visible={visible} transparent animationType="slide" statusBarTranslucent onRequestClose={onClose}>
      <Pressable style={styles.scrim} onPress={onClose} accessibilityLabel="Close" />
      <KeyboardAvoidingView behavior="padding" style={styles.dock} pointerEvents="box-none">
        <View style={[styles.sheet, { paddingBottom: insets.bottom + 18 }]}>
          <View style={styles.grabber} />
          <Text style={styles.title}>{title}</Text>
          <ScrollView keyboardShouldPersistTaps="handled" contentContainerStyle={{ gap: 12 }} style={{ maxHeight: 560 }}>
            {children}
          </ScrollView>
        </View>
      </KeyboardAvoidingView>
    </Modal>
  );
}

/** A row of single-choice chips. */
export function Choice<T extends string>({
  options,
  value,
  onChange,
  label = (v: T) => v,
  colour = C.star,
}: {
  options: readonly T[];
  value: T;
  onChange: (v: T) => void;
  label?: (v: T) => string;
  colour?: string;
}) {
  return (
    <View style={styles.chips}>
      {options.map((o) => {
        const on = o === value;
        return (
          <Press
            key={o}
            onPress={() => onChange(o)}
            style={[styles.chip, on && { borderColor: colour, backgroundColor: 'rgba(255,255,255,0.08)' }]}
            accessibilityRole="button"
            accessibilityState={{ selected: on }}
          >
            <Text style={[styles.chipText, on && { color: C.ink }]}>{label(o)}</Text>
          </Press>
        );
      })}
    </View>
  );
}

const CAL_THEME = {
  calendarBackground: 'transparent',
  dayTextColor: C.ink,
  textDisabledColor: C.inkFaint,
  monthTextColor: C.ink,
  arrowColor: C.star,
  todayTextColor: C.me,
  selectedDayBackgroundColor: C.me,
  selectedDayTextColor: C.night,
  textSectionTitleColor: C.inkSoft,
  textDayFontFamily: F.medium,
  textMonthFontFamily: F.display,
  textDayHeaderFontFamily: F.semibold,
};

/** A date field: shows the chosen day, and opens a calendar to change it. */
export function DateField({
  label,
  value,
  onChange,
  optional,
}: {
  label: string;
  value: string | null; // 'YYYY-MM-DD'
  onChange: (v: string | null) => void;
  optional?: boolean;
}) {
  const [open, setOpen] = useState(false);
  const shown = value
    ? parseLocalDate(value).toLocaleDateString('en-GB', { weekday: 'short', day: 'numeric', month: 'short', year: 'numeric' })
    : optional
      ? 'Not set'
      : 'Choose a date';
  return (
    <View style={{ gap: 6 }}>
      <Text style={styles.fieldLabel}>{label}</Text>
      <Press onPress={() => setOpen(!open)} style={styles.dateBtn} depth={0.98} accessibilityRole="button" accessibilityLabel={`${label}: ${shown}`}>
        <CalendarDays size={18} color={C.inkSoft} />
        <Text style={[styles.dateText, !value && { color: C.inkFaint }]}>{shown}</Text>
        {optional && value ? (
          <Text onPress={() => onChange(null)} style={styles.clear}>
            Clear
          </Text>
        ) : null}
      </Press>
      {open && (
        <Calendar
          current={value ?? toLocalISODate(new Date())}
          onDayPress={(d: { dateString: string }) => {
            onChange(d.dateString);
            setOpen(false);
          }}
          markedDates={value ? { [value]: { selected: true } } : undefined}
          theme={CAL_THEME as any}
          firstDay={1}
        />
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  scrim: { ...StyleSheet.absoluteFillObject, backgroundColor: 'rgba(0,0,0,0.6)' },
  dock: { flex: 1, justifyContent: 'flex-end' },
  sheet: {
    backgroundColor: C.panel,
    borderTopLeftRadius: 28,
    borderTopRightRadius: 28,
    borderWidth: 1,
    borderColor: C.lineStrong,
    paddingHorizontal: 20,
    paddingTop: 10,
    gap: 12,
  },
  grabber: { alignSelf: 'center', width: 38, height: 4, borderRadius: 2, backgroundColor: 'rgba(255,255,255,0.3)' },
  title: { fontFamily: F.display, fontSize: 22, color: C.ink, letterSpacing: -0.4 },
  chips: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  chip: { paddingHorizontal: 12, paddingVertical: 8, borderRadius: R.pill, borderWidth: 1, borderColor: C.line },
  chipText: { fontFamily: F.medium, fontSize: 13, color: C.inkSoft },
  fieldLabel: { fontFamily: F.semibold, fontSize: 11, letterSpacing: 1.2, textTransform: 'uppercase', color: C.inkFaint },
  dateBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    minHeight: 48,
    paddingHorizontal: 14,
    borderRadius: R.md,
    backgroundColor: 'rgba(255,255,255,0.06)',
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: C.lineStrong,
  },
  dateText: { flex: 1, fontFamily: F.medium, fontSize: 15, color: C.ink },
  clear: { fontFamily: F.semibold, fontSize: 13, color: C.star },
});
