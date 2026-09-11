import React from 'react';
import { StyleSheet, View } from 'react-native';
import { THEME } from '../../constants/theme';
import { Skeleton } from './Skeleton';

/**
 * HubSkeleton — the launch placeholder shown while auth resolves and the
 * typefaces load, in place of a bare spinner.
 *
 * It mirrors the shape of the real Hub so the first paint reads as "the app is
 * arriving" rather than "the app is buffering". Staggered `delay`s make the
 * stack breathe as a soft wave.
 *
 * THIS FILE IS A SHADOW COPY OF THE HUB LAYOUT and has to move in lockstep with
 * it. It went stale the moment the hub was compacted, and the mismatch is
 * visible: the placeholder drew the old two-progress-bar Step Duel and a
 * separate check-in card, then the real hub replaced it with a different
 * shape — the layout jumping under the user at the exact moment they are
 * forming a first impression of it.
 *
 * Matched to the hub as of the greeting rewrite: profile picture beside the
 * greeting and name, one card holding both moods, and the Step Duel with its
 * seven-day graph. The daily check-in card that used to sit below them is gone.
 */
export function HubSkeleton() {
  return (
    <View style={styles.content}>
      {/* Greeting — a profile picture beside the greeting and the name. */}
      <View style={styles.welcome}>
        <Skeleton width={56} height={56} radius={28} />
        <View style={styles.welcomeText}>
          <Skeleton width={190} height={34} radius={THEME.borderRadius.sm} delay={60} />
          <Skeleton width={120} height={22} radius={THEME.borderRadius.sm} style={styles.gapTop} delay={120} />
        </View>
      </View>

      {/* "Right now" — partner mood, advice, and your own mood row. */}
      <View style={styles.card}>
        <Skeleton width={96} height={12} />
        <View style={[styles.row, styles.gapLg]}>
          <Skeleton width={160} height={24} delay={80} />
          <Skeleton width={72} height={26} radius={THEME.borderRadius.round} delay={80} />
        </View>
        <Skeleton height={12} style={styles.gapLg} delay={140} />
        <Skeleton width="82%" height={12} style={styles.gapSm} delay={200} />
        <View style={[styles.row, styles.gapLg]}>
          <Skeleton width={78} height={30} radius={THEME.borderRadius.sm} delay={240} />
          <Skeleton width={78} height={30} radius={THEME.borderRadius.sm} delay={260} />
          <Skeleton width={78} height={30} radius={THEME.borderRadius.sm} delay={280} />
        </View>
      </View>

      {/* Step Duel — head-to-head totals, then the week's graph. */}
      <View style={styles.card}>
        <Skeleton width={120} height={16} />
        <View style={[styles.row, styles.gapLg]}>
          <Skeleton width={70} height={26} delay={80} />
          <Skeleton width={70} height={26} delay={80} />
        </View>
        {/* The graph: seven day-columns, not two progress bars. */}
        <View style={[styles.row, styles.graph]}>
          {[38, 60, 26, 72, 48, 66, 20].map((h, i) => (
            <Skeleton key={i} width={17} height={h} radius={4} delay={120 + i * 30} />
          ))}
        </View>
        <Skeleton width={140} height={11} style={styles.gapLg} delay={340} />
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  content: {
    padding: THEME.spacing.md,
    // Tracks the hub's ScrollView paddingTop, which dropped from 56 to 20 when
    // the hamburger moved into the dock.
    paddingTop: 20,
  },
  welcome: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 14,
    paddingHorizontal: THEME.spacing.xs,
    paddingVertical: THEME.spacing.md,
    marginBottom: THEME.spacing.sm,
  },
  welcomeText: {
    flex: 1,
  },
  card: {
    ...THEME.material.regular,
    padding: THEME.spacing.md,
    borderRadius: THEME.borderRadius.md,
    marginBottom: THEME.spacing.md,
  },
  row: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  graph: { marginTop: 18, alignItems: 'flex-end', height: 74 },
  gapTop: { marginTop: 12 },
  gapSm: { marginTop: 10 },
  gapLg: { marginTop: 16 },
});
