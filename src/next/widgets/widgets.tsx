import React from 'react';
import { FlexWidget, SvgWidget, TextWidget } from 'react-native-android-widget';
import type { WidgetState } from './state';

/**
 * The two widgets. They are built from the library's widget primitives (not
 * React Native views): Android draws them itself, in RemoteViews, so only flex
 * layout, text and SVG are available.
 */

const INK = '#F4F0FB';
const SOFT = '#B3ACC9';
const NIGHT = '#0E0B1F';
const ME = '#FF8A3D';
const PARTNER = '#B9A8FF';
const STAR = '#FFF3E0';
const DISPLAY = 'BricolageGrotesque_700Bold';

const MOOD_WORD: Record<string, string> = {
  Happy: 'glowing',
  Overwhelmed: 'flickering',
  Exhausted: 'dim',
  'Low Energy': 'low',
  Neutral: 'steady',
};

function orb(hex: string, size: number, dim = false) {
  const o = dim ? 0.55 : 1;
  return `<svg xmlns="http://www.w3.org/2000/svg" width="${size}" height="${size}" viewBox="0 0 100 100">
  <defs>
    <radialGradient id="g" cx="50%" cy="50%" r="50%">
      <stop offset="0%" stop-color="${hex}" stop-opacity="${0.55 * o}"/>
      <stop offset="100%" stop-color="${hex}" stop-opacity="0"/>
    </radialGradient>
    <radialGradient id="b" cx="38%" cy="34%" r="70%">
      <stop offset="0%" stop-color="#FFFFFF" stop-opacity="${0.95 * o}"/>
      <stop offset="22%" stop-color="${hex}" stop-opacity="${o}"/>
      <stop offset="100%" stop-color="${hex}" stop-opacity="${0.55 * o}"/>
    </radialGradient>
  </defs>
  <circle cx="50" cy="50" r="50" fill="url(#g)"/>
  <circle cx="50" cy="50" r="30" fill="url(#b)"/>
</svg>`;
}

/** Whole days from a local 'YYYY-MM-DD' to today. */
export function daysSince(iso: string, now = new Date()): number {
  const [y, m, d] = iso.split('-').map(Number);
  const start = new Date(y, m - 1, d).getTime();
  const today = new Date(now.getFullYear(), now.getMonth(), now.getDate()).getTime();
  return Math.round((today - start) / 86_400_000);
}

export function daysToNextAnniversary(iso: string, now = new Date()): number {
  const [, m, d] = iso.split('-').map(Number);
  const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());
  let next = new Date(now.getFullYear(), m - 1, d);
  if (next < today) next = new Date(now.getFullYear() + 1, m - 1, d);
  return Math.round((next.getTime() - today.getTime()) / 86_400_000);
}

/** Both lights. Tap your partner's to send a nudge. */
export function LightsWidget({ state }: { state: WidgetState }) {
  const word = MOOD_WORD[state.partnerMood] ?? 'steady';
  return (
    <FlexWidget
      clickAction="OPEN_APP"
      style={{
        height: 'match_parent',
        width: 'match_parent',
        backgroundGradient: { from: '#1A1336', to: NIGHT, orientation: 'TOP_BOTTOM' },
        borderRadius: 28,
        padding: 14,
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'space-between',
      }}
    >
      <FlexWidget style={{ flexDirection: 'column', alignItems: 'center' }}>
        <SvgWidget svg={orb(ME, 72)} style={{ height: 64, width: 64 }} />
        <TextWidget text={state.myName} style={{ fontSize: 12, color: SOFT }} maxLines={1} truncate="END" />
      </FlexWidget>
      <FlexWidget style={{ flex: 1, flexDirection: 'column', alignItems: 'center', paddingHorizontal: 6 }}>
        <TextWidget
          text={`${state.partnerName}'s light is ${word}`}
          style={{ fontSize: 14, color: INK, fontFamily: DISPLAY, textAlign: 'center' }}
          maxLines={2}
          truncate="END"
        />
        <TextWidget text="Tap their light to nudge" style={{ fontSize: 11, color: SOFT, marginTop: 4, textAlign: 'center' }} />
      </FlexWidget>
      <FlexWidget clickAction="NUDGE" style={{ flexDirection: 'column', alignItems: 'center' }}>
        <SvgWidget svg={orb(PARTNER, 72, state.partnerMood === 'Exhausted')} style={{ height: 64, width: 64 }} />
        <TextWidget text={state.partnerName} style={{ fontSize: 12, color: SOFT }} maxLines={1} truncate="END" />
      </FlexWidget>
    </FlexWidget>
  );
}

/** Days together, for the home or lock screen. */
export function DaysWidget({ state }: { state: WidgetState }) {
  if (!state.togetherSince) {
    return (
      <FlexWidget
        clickAction="OPEN_APP"
        style={{ height: 'match_parent', width: 'match_parent', backgroundColor: NIGHT, borderRadius: 28, padding: 14, justifyContent: 'center', alignItems: 'center' }}
      >
        <TextWidget text="Open NOVIA Next once to start the count" style={{ fontSize: 13, color: SOFT, textAlign: 'center' }} />
      </FlexWidget>
    );
  }
  const days = daysSince(state.togetherSince);
  const next = daysToNextAnniversary(state.togetherSince);
  const [y, m, d] = state.togetherSince.split('-').map(Number);
  const since = new Date(y, m - 1, d).toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' });
  return (
    <FlexWidget
      clickAction="OPEN_APP"
      style={{
        height: 'match_parent',
        width: 'match_parent',
        backgroundGradient: { from: '#2A1A44', to: NIGHT, orientation: 'TOP_BOTTOM' },
        borderRadius: 28,
        padding: 14,
        flexDirection: 'column',
        justifyContent: 'center',
        alignItems: 'center',
      }}
    >
      <FlexWidget style={{ flexDirection: 'row', alignItems: 'center' }}>
        <SvgWidget svg={orb(ME, 40)} style={{ height: 22, width: 22 }} />
        <SvgWidget svg={orb(PARTNER, 40)} style={{ height: 22, width: 22, marginLeft: -6 }} />
      </FlexWidget>
      <TextWidget text={days.toLocaleString('en-IN')} style={{ fontSize: 40, color: STAR, fontFamily: DISPLAY, marginTop: 2 }} />
      <TextWidget text={`days together since ${since}`} style={{ fontSize: 12, color: INK, textAlign: 'center' }} maxLines={2} />
      <TextWidget
        text={next === 0 ? 'Happy anniversary' : `Anniversary in ${next} ${next === 1 ? 'day' : 'days'}`}
        style={{ fontSize: 11, color: next === 0 ? ME : SOFT, marginTop: 4 }}
      />
    </FlexWidget>
  );
}
