import React from 'react';
import { StyleSheet, View } from 'react-native';
import { THEME } from '../../constants/theme';
import { Skeleton } from './Skeleton';

/**
 * HubSkeleton — the launch placeholder shown while auth resolves and the
 * typefaces load, in place of a bare spinner.
 *
 * It mirrors the shape of the real Hub (greeting, companion card, Step Duel
 * card, check-in card) with the shared Skeleton primitive, so the first paint
 * reads as "the app is arriving" rather than "the app is buffering". Staggered
 * `delay`s make the stack breathe as a soft wave. See [[novia-ui-design-language]].
 */
export function HubSkeleton() {
  return (
    <View style={styles.content}>
      {/* Greeting */}
      <View style={styles.welcome}>
        <Skeleton width={190} height={34} radius={THEME.borderRadius.sm} />
        <Skeleton width={130} height={22} radius={THEME.borderRadius.sm} style={styles.gapTop} delay={90} />
      </View>

      {/* Companion real-time tracking */}
      <View style={styles.card}>
        <Skeleton width={210} height={12} />
        <Skeleton width={160} height={24} style={styles.gapLg} delay={80} />
        <Skeleton height={12} style={styles.gapLg} delay={140} />
        <Skeleton width="82%" height={12} style={styles.gapSm} delay={200} />
      </View>

      {/* Step Duel */}
      <View style={styles.card}>
        <Skeleton width={120} height={16} />
        <View style={[styles.row, styles.gapLg]}>
          <Skeleton width={60} height={18} />
          <Skeleton width={40} height={22} />
        </View>
        <Skeleton height={10} radius={THEME.borderRadius.round} style={styles.gapSm} delay={120} />
        <View style={[styles.row, styles.gapLg]}>
          <Skeleton width={110} height={18} delay={80} />
          <Skeleton width={40} height={22} delay={80} />
        </View>
        <Skeleton height={10} radius={THEME.borderRadius.round} style={styles.gapSm} delay={160} />
      </View>

      {/* Daily check-in */}
      <View style={styles.card}>
        <Skeleton width={150} height={16} />
        <Skeleton width="70%" height={14} style={styles.gapLg} delay={80} />
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  content: {
    padding: THEME.spacing.md,
    paddingTop: 56,
  },
  welcome: {
    paddingHorizontal: THEME.spacing.xs,
    paddingVertical: THEME.spacing.md,
    marginBottom: THEME.spacing.sm,
  },
  card: {
    backgroundColor: THEME.glass.surface,
    padding: THEME.spacing.md,
    borderRadius: THEME.borderRadius.md,
    marginBottom: THEME.spacing.md,
    ...THEME.shadow.soft,
  },
  row: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  gapTop: { marginTop: 12 },
  gapSm: { marginTop: 10 },
  gapLg: { marginTop: 16 },
});
