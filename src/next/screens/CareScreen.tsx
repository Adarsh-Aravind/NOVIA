import React from 'react';
import { StyleSheet, Text, View } from 'react-native';
import { Page, Card, Label, Empty, ui } from '../components/ui';
import { WalkTogether } from '../walk/WalkTogether';
import { WeatherOfUs } from '../weather/WeatherOfUs';
import { usePeriods } from '../../hooks/usePeriods';
import { parseLocalDate } from '../../utils/dateUtils';
import { useSteps } from '../../hooks/useSteps';
import type { Profile } from '../../types';
import { C, F } from '../theme';

interface Props {
  profile: Profile;
  partner: Profile | null;
  coupleId: string;
  bottomInset: number;
}

const PHASE_CARE: Record<string, string> = {
  Menstruation: 'Lowest energy of the month. Warmth, rest, and take on more of the chores.',
  Follicular: 'Energy is coming back. A good week for plans and trying something new.',
  Ovulation: 'Usually the most social, confident days. Plan the date night here.',
  Luteal: 'Patience goes further this week. Fewer surprises, more comfort.',
  Unknown: 'Log a period to see where you are in the cycle.',
};

/** Looking after each other: the cycle, read as care, and the week's walking. */
export function CareScreen({ profile, partner, coupleId, bottomInset }: Props) {
  const { predictions } = usePeriods(coupleId);
  const steps = useSteps(coupleId, profile.id, partner?.id);
  const fmt = (d: Date) => d.toLocaleDateString('en-GB', { day: 'numeric', month: 'short' });

  return (
    <Page kicker="Looking after each other" title="Care" bottomInset={bottomInset}>
      <WeatherOfUs coupleId={coupleId} me={profile.id} partnerName={partner?.display_name || 'Partner'} />
      <WalkTogether coupleId={coupleId} me={profile.id} />
      <Card>
        <Label>Cycle</Label>
        {predictions ? (
          <>
            <View style={ui.row}>
              <Text style={styles.big}>Day {predictions.cycleDay}</Text>
              <Text style={styles.phase}>{predictions.currentPhase}</Text>
            </View>
            <Track day={predictions.cycleDay} length={predictions.avgCycleLength} />
            <Text style={ui.body}>{PHASE_CARE[predictions.currentPhase] ?? PHASE_CARE.Unknown}</Text>
            <View style={styles.facts}>
              <Fact k="Next period" v={predictions.daysUntilNextPeriod >= 0 ? `${fmt(predictions.nextPeriodStart)} · ${predictions.daysUntilNextPeriod}d` : 'Due now'} />
              <Fact k="Fertile window" v={`${fmt(predictions.fertileWindowStart)} to ${fmt(predictions.fertileWindowEnd)}`} />
              <Fact k="Average cycle" v={`${predictions.avgCycleLength} days`} />
            </View>
          </>
        ) : (
          <Empty title="No cycle logged" body="Logging is in the current NOVIA app for now. It moves here in the next pass." />
        )}
      </Card>

      <Card>
        <Label>This week’s walking</Label>
        {steps.status === 'ready' && steps.series.length > 0 ? (
          <View style={styles.week}>
            {steps.series.map((d) => {
              const max = Math.max(...steps.series.flatMap((x) => [x.me ?? 0, x.partner ?? 0]), 1);
              return (
                <View key={d.date} style={styles.day}>
                  <View style={styles.bars}>
                    <View style={[styles.bar, { height: `${((d.me ?? 0) / max) * 100}%`, backgroundColor: C.me }]} />
                    <View style={[styles.bar, { height: `${((d.partner ?? 0) / max) * 100}%`, backgroundColor: C.partner }]} />
                  </View>
                  <Text style={[styles.dayLabel, d.isToday && { color: C.ink }]}>
                    {parseLocalDate(d.date).toLocaleDateString('en-GB', { weekday: 'narrow' })}
                  </Text>
                </View>
              );
            })}
          </View>
        ) : (
          <Text style={ui.soft}>Connect steps on the Sky page to see the week.</Text>
        )}
        {steps.status === 'ready' && (
          <Text style={ui.soft}>
            Season {steps.season.label}: you {steps.season.myWins}, {partner?.display_name || 'partner'} {steps.season.partnerWins}
            {steps.forfeit ? ` · Loser: ${steps.forfeit}` : ''}
          </Text>
        )}
      </Card>
    </Page>
  );
}

function Track({ day, length }: { day: number; length: number }) {
  const pct = Math.min(1, Math.max(0, day / Math.max(length, 1)));
  return (
    <View style={styles.track}>
      <View style={[styles.trackFill, { width: `${pct * 100}%` }]} />
    </View>
  );
}

function Fact({ k, v }: { k: string; v: string }) {
  return (
    <View style={styles.fact}>
      <Text style={styles.factK}>{k}</Text>
      <Text style={styles.factV}>{v}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  big: { fontFamily: F.display, fontSize: 30, color: C.ink, letterSpacing: -0.6 },
  phase: { fontFamily: F.semibold, fontSize: 14, color: C.partner, marginTop: 6 },
  track: { height: 8, borderRadius: 4, backgroundColor: 'rgba(255,255,255,0.07)', overflow: 'hidden' },
  trackFill: { height: 8, borderRadius: 4, backgroundColor: C.partner },
  facts: { gap: 8, marginTop: 4 },
  fact: { flexDirection: 'row', justifyContent: 'space-between', gap: 12 },
  factK: { fontFamily: F.medium, fontSize: 13.5, color: C.inkSoft },
  factV: { fontFamily: F.semibold, fontSize: 13.5, color: C.ink, fontVariant: ['tabular-nums'] },
  week: { flexDirection: 'row', gap: 8, height: 120, alignItems: 'flex-end' },
  day: { flex: 1, alignItems: 'center', gap: 6, height: '100%' },
  bars: { flex: 1, width: '100%', flexDirection: 'row', alignItems: 'flex-end', justifyContent: 'center', gap: 3 },
  bar: { width: 8, borderRadius: 4, minHeight: 3 },
  dayLabel: { fontFamily: F.semibold, fontSize: 11, color: C.inkFaint },
});
