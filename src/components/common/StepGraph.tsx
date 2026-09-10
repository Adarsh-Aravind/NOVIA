import React from 'react';
import { StyleSheet, Text, View } from 'react-native';
import Svg, { Defs, LinearGradient, Rect, Stop } from 'react-native-svg';
import { StepDay } from '../../hooks/useSteps';
import { alpha, FONTS, THEME } from '../../constants/theme';

/**
 * Seven days of the step duel, as paired bars.
 *
 * Replaces two single-value progress bars that could only ever say "who is
 * ahead right now". A week of history answers the questions people actually
 * have — is she always ahead, did I fall off on Wednesday, are we both
 * slowing down — for the same vertical space.
 *
 * Design decisions worth keeping:
 *
 * **One shared scale.** Both people's bars are measured against the same
 * maximum across the whole week, so height is comparable everywhere in the
 * chart. Scaling each day to its own max would make every day look like a
 * near-tie, which is the one thing a duel must never do.
 *
 * **Gaps stay gaps.** A day nobody synced renders as an empty slot, not a
 * missing column. `useSteps` builds the series by walking back from today for
 * exactly this reason: a chart that closes its own holes is lying about the
 * shape of the week.
 *
 * **Today is dimmer, not brighter.** It is a partial day — comparing an
 * afternoon against six complete days is unfair, and drawing it at full
 * strength invites exactly that misreading. It gets a marked label instead.
 */

const BAR_H = 74;
const DAY_LETTER = ['S', 'M', 'T', 'W', 'T', 'F', 'S'];

export function StepGraph({ series, partnerName }: { series: StepDay[]; partnerName: string }) {
  if (series.length === 0) return null;

  // One scale for the whole week — see above. Floor of 1 so an all-zero week
  // divides safely rather than producing NaN heights.
  const peak = Math.max(
    1,
    ...series.flatMap((d) => [d.me ?? 0, d.partner ?? 0])
  );

  return (
    <View style={styles.wrap}>
      <View style={styles.plot}>
        {series.map((day) => {
          const mine = day.me ?? 0;
          const theirs = day.partner ?? 0;
          const empty = day.me == null && day.partner == null;
          // Weekday letter from the date string, parsed as local midnight so a
          // UTC shift can't move a bar to the wrong day.
          const [y, m, dd] = day.date.split('-').map(Number);
          const weekday = DAY_LETTER[new Date(y, m - 1, dd).getDay()];

          return (
            <View key={day.date} style={styles.column}>
              <View style={styles.bars}>
                {empty ? (
                  <View style={styles.emptyDay} />
                ) : (
                  <>
                    <Bar
                      value={mine}
                      peak={peak}
                      color={THEME.colors.primary}
                      dim={day.isToday}
                    />
                    <Bar
                      value={theirs}
                      peak={peak}
                      color={THEME.ink[55]}
                      dim={day.isToday}
                    />
                  </>
                )}
              </View>
              <Text style={[styles.dayLabel, day.isToday && styles.dayLabelToday]}>
                {weekday}
              </Text>
            </View>
          );
        })}
      </View>

      <View style={styles.legend}>
        <LegendKey color={THEME.colors.primary} label="You" />
        <LegendKey color={THEME.ink[55]} label={partnerName} />
      </View>
    </View>
  );
}

function Bar({
  value,
  peak,
  color,
  dim,
}: {
  value: number;
  peak: number;
  color: string;
  dim: boolean;
}) {
  // A synced-but-tiny day should still show something, so it reads as "barely
  // moved" rather than as an absent day. Zero stays zero.
  const h = value > 0 ? Math.max(3, Math.round((value / peak) * BAR_H)) : 0;

  return (
    <View style={styles.barSlot}>
      <View style={[styles.barTrack, { height: BAR_H }]}>
        {h > 0 && (
          <View style={[styles.barFill, { height: h, opacity: dim ? 0.45 : 1 }]}>
            <Svg width="100%" height="100%">
              <Defs>
                <LinearGradient id={`bar${color}${dim}`} x1="0" y1="0" x2="0" y2="1">
                  <Stop offset="0" stopColor={color} stopOpacity="1" />
                  <Stop offset="1" stopColor={color} stopOpacity="0.45" />
                </LinearGradient>
              </Defs>
              <Rect
                x="0"
                y="0"
                width="100%"
                height="100%"
                rx="3"
                fill={`url(#bar${color}${dim})`}
              />
            </Svg>
          </View>
        )}
      </View>
    </View>
  );
}

function LegendKey({ color, label }: { color: string; label: string }) {
  return (
    <View style={styles.legendItem}>
      <View style={[styles.legendDot, { backgroundColor: color }]} />
      <Text style={styles.legendText} numberOfLines={1}>
        {label}
      </Text>
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: { marginTop: 10 },
  plot: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-end',
  },
  column: { flex: 1, alignItems: 'center' },
  bars: { flexDirection: 'row', alignItems: 'flex-end', gap: 3, height: BAR_H },
  barSlot: { justifyContent: 'flex-end' },
  barTrack: { width: 7, justifyContent: 'flex-end' },
  barFill: { width: 7, borderRadius: 3, overflow: 'hidden' },
  emptyDay: {
    width: 17,
    height: 3,
    borderRadius: 2,
    backgroundColor: alpha(THEME.ink[95], 0.12),
    alignSelf: 'flex-end',
  },
  dayLabel: {
    marginTop: 7,
    fontSize: 10,
    fontFamily: FONTS.semibold,
    color: THEME.colors.textFaint,
  },
  dayLabelToday: { color: THEME.colors.primary },
  legend: {
    flexDirection: 'row',
    gap: 16,
    marginTop: 12,
  },
  legendItem: { flexDirection: 'row', alignItems: 'center', gap: 6, flexShrink: 1 },
  legendDot: { width: 7, height: 7, borderRadius: 4 },
  legendText: {
    fontSize: 11,
    fontFamily: FONTS.medium,
    color: THEME.colors.textMuted,
  },
});
