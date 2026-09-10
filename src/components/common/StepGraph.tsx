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
 * have — is she always ahead, did I fall off on Wednesday, are we both slowing
 * down — in the same vertical space.
 *
 * Design decisions worth keeping:
 *
 * **One shared scale.** Every bar is measured against the same weekly maximum,
 * so height is comparable across the whole chart. Scaling each day to its own
 * max would make every day look like a near-tie, which is the one thing a duel
 * must never do.
 *
 * **Gaps stay gaps.** A day nobody synced renders as a flat marker, not a
 * missing column — `useSteps` builds the series by walking back from today for
 * exactly this reason. A chart that closes its own holes lies about the shape
 * of the week.
 *
 * **Today is dimmer, not brighter.** It is a partial day; drawn at full
 * strength it invites comparing an afternoon against six complete days.
 *
 * The whole plot is ONE `<Svg>`. The obvious implementation gives each bar its
 * own Svg with its own gradient def, which costs fourteen native surfaces on a
 * card that re-renders on every sync poll — and forces the gradient id to be
 * derived from the bar's colour, producing ids like `bar#FF6A00` where the `#`
 * is both invalid in an id and ambiguous inside `url(#…)`.
 */

const BAR_H = 74;
const BAR_W = 7;
const BAR_GAP = 3;
const PAIR_W = BAR_W * 2 + BAR_GAP;
const DAY_LETTER = ['S', 'M', 'T', 'W', 'T', 'F', 'S'];
/** Today's bars, being a partial day, draw at this much strength. */
const TODAY_ALPHA = 0.45;

export function StepGraph({ series, partnerName }: { series: StepDay[]; partnerName: string }) {
  const [width, setWidth] = React.useState(0);
  // Scope the gradient ids to this instance — two mounted graphs would
  // otherwise share def names inside the same document.
  const gid = React.useId().replace(/:/g, '');

  if (series.length === 0) return null;

  // One scale for the whole week. Floor of 1 so an all-zero week divides
  // safely instead of producing NaN heights.
  const peak = Math.max(1, ...series.flatMap((d) => [d.me ?? 0, d.partner ?? 0]));
  const colW = width / series.length;

  /** Bar height for a value, with a floor so "barely moved" still shows. */
  const barH = (v: number) => (v > 0 ? Math.max(3, (v / peak) * BAR_H) : 0);

  return (
    <View style={styles.wrap}>
      <View
        style={{ height: BAR_H }}
        onLayout={(e) => setWidth(e.nativeEvent.layout.width)}
      >
        {width > 0 && (
          <Svg width={width} height={BAR_H}>
            <Defs>
              <LinearGradient id={`mine${gid}`} x1="0" y1="0" x2="0" y2="1">
                <Stop offset="0" stopColor={THEME.colors.primary} stopOpacity="1" />
                <Stop offset="1" stopColor={THEME.colors.primary} stopOpacity="0.45" />
              </LinearGradient>
              <LinearGradient id={`theirs${gid}`} x1="0" y1="0" x2="0" y2="1">
                <Stop offset="0" stopColor={THEME.ink[55]} stopOpacity="1" />
                <Stop offset="1" stopColor={THEME.ink[55]} stopOpacity="0.45" />
              </LinearGradient>
            </Defs>

            {series.map((day, i) => {
              const left = i * colW + (colW - PAIR_W) / 2;
              const o = day.isToday ? TODAY_ALPHA : 1;

              if (day.me == null && day.partner == null) {
                return (
                  <Rect
                    key={day.date}
                    x={left}
                    y={BAR_H - 3}
                    width={PAIR_W}
                    height={3}
                    rx={1.5}
                    fill={alpha(THEME.ink[95], 0.12)}
                  />
                );
              }

              const hMine = barH(day.me ?? 0);
              const hTheirs = barH(day.partner ?? 0);

              return (
                <React.Fragment key={day.date}>
                  {hMine > 0 && (
                    <Rect
                      x={left}
                      y={BAR_H - hMine}
                      width={BAR_W}
                      height={hMine}
                      rx={3}
                      fill={`url(#mine${gid})`}
                      opacity={o}
                    />
                  )}
                  {hTheirs > 0 && (
                    <Rect
                      x={left + BAR_W + BAR_GAP}
                      y={BAR_H - hTheirs}
                      width={BAR_W}
                      height={hTheirs}
                      rx={3}
                      fill={`url(#theirs${gid})`}
                      opacity={o}
                    />
                  )}
                </React.Fragment>
              );
            })}
          </Svg>
        )}
      </View>

      <View style={styles.labels}>
        {series.map((day) => {
          // Parsed as local midnight — `new Date('YYYY-MM-DD')` is UTC and
          // would shift a label onto the wrong weekday west of the meridian.
          const [y, m, dd] = day.date.split('-').map(Number);
          const weekday = DAY_LETTER[new Date(y, m - 1, dd).getDay()];
          return (
            <Text
              key={day.date}
              style={[styles.dayLabel, day.isToday && styles.dayLabelToday]}
            >
              {weekday}
            </Text>
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
  labels: { flexDirection: 'row', marginTop: 7 },
  dayLabel: {
    flex: 1,
    textAlign: 'center',
    fontSize: 10,
    fontFamily: FONTS.semibold,
    color: THEME.colors.textFaint,
  },
  dayLabelToday: { color: THEME.colors.primary },
  legend: { flexDirection: 'row', gap: 16, marginTop: 12 },
  legendItem: { flexDirection: 'row', alignItems: 'center', gap: 6, flexShrink: 1 },
  legendDot: { width: 7, height: 7, borderRadius: 4 },
  legendText: {
    fontSize: 11,
    fontFamily: FONTS.medium,
    color: THEME.colors.textMuted,
  },
});
