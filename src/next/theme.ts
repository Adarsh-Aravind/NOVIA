/**
 * NOVIA Next design tokens.
 *
 * The old system had one hue on black, so colour could never say anything.
 * Here colour carries the one fact a couples app most needs at a glance:
 * **who**. Each partner is a light. You are Ember (the orange the app always
 * had), your partner is Moonlight (a cool lavender), and anything you made
 * together is Starlight, the warm white the two mix into.
 *
 * Everything sits on a night sky whose colour follows the real time of day
 * (see skyAt), so the home screen is never quite the same twice.
 */

export const C = {
  night: '#07060E',
  deep: '#0E0B1F',
  dusk: '#1A1336',

  ink: '#F4F0FB',
  inkSoft: '#CDC7DF',
  inkFaint: '#A39CBC',
  line: 'rgba(244,240,251,0.10)',
  lineStrong: 'rgba(244,240,251,0.18)',

  me: '#FF8A3D',
  meSoft: 'rgba(255,138,61,0.16)',
  partner: '#B9A8FF',
  partnerSoft: 'rgba(185,168,255,0.16)',
  star: '#FFF3E0',

  // Panels are solid: text over translucent layers was hard to read.
  panel: '#16122B',
  glass: 'rgba(14,11,31,0.96)',
  glassHi: 'rgba(26,21,52,0.97)',
  danger: '#FF6B6B',
} as const;

export const F = {
  display: 'BricolageGrotesque_700Bold',
  displayMed: 'BricolageGrotesque_500Medium',
  body: 'Manrope_400Regular',
  medium: 'Manrope_500Medium',
  semibold: 'Manrope_600SemiBold',
  bold: 'Manrope_700Bold',
} as const;

export const R = { sm: 10, md: 16, lg: 24, pill: 999 } as const;

/** Linear RGB triple 0..1, the form the Skia shaders take. */
export function rgb(hex: string): [number, number, number] {
  const h = hex.replace('#', '');
  return [0, 2, 4].map((i) => parseInt(h.slice(i, i + 2), 16) / 255) as [number, number, number];
}

type Stop = { h: number; top: string; bottom: string; stars: number };

// The sky by hour. `stars` is how visible the background stars are, so the
// sky reads as daylight without ever going bright enough to drown the text.
const SKY: Stop[] = [
  { h: 0, top: '#04030A', bottom: '#150F2E', stars: 1 },
  { h: 5, top: '#0A0820', bottom: '#2A1A44', stars: 0.8 },
  { h: 7, top: '#1A1642', bottom: '#6A3A5C', stars: 0.35 },
  { h: 10, top: '#0F1B44', bottom: '#33467E', stars: 0.15 },
  { h: 16, top: '#13173E', bottom: '#4A3A72', stars: 0.2 },
  { h: 19, top: '#120A26', bottom: '#5A2440', stars: 0.55 },
  { h: 21, top: '#07061A', bottom: '#1E1438', stars: 0.9 },
  { h: 24, top: '#04030A', bottom: '#150F2E', stars: 1 },
];

function mix(a: string, b: string, t: number): [number, number, number] {
  const x = rgb(a);
  const y = rgb(b);
  return [0, 1, 2].map((i) => x[i] + (y[i] - x[i]) * t) as [number, number, number];
}

export interface SkyColours {
  top: [number, number, number];
  bottom: [number, number, number];
  stars: number;
  label: 'night' | 'dawn' | 'day' | 'dusk';
}

export function skyAt(date = new Date()): SkyColours {
  const h = date.getHours() + date.getMinutes() / 60;
  let i = 0;
  while (i < SKY.length - 2 && SKY[i + 1].h <= h) i++;
  const a = SKY[i];
  const b = SKY[i + 1];
  const t = (h - a.h) / (b.h - a.h);
  const label = h < 5 || h >= 21 ? 'night' : h < 8 ? 'dawn' : h < 17 ? 'day' : 'dusk';
  return {
    top: mix(a.top, b.top, t),
    bottom: mix(a.bottom, b.bottom, t),
    stars: a.stars + (b.stars - a.stars) * t,
    label,
  };
}

/**
 * How each mood changes a light. `energy` is brightness, `pace` how fast it
 * breathes, `flicker` how unsteady it is. Overwhelmed flickers, Exhausted
 * dims and slows, Happy runs bright and quick.
 */
export const MOOD_LIGHT: Record<string, { energy: number; pace: number; flicker: number; word: string }> = {
  Happy: { energy: 1.15, pace: 1.6, flicker: 0, word: 'glowing' },
  Overwhelmed: { energy: 0.95, pace: 2.4, flicker: 1, word: 'flickering' },
  Exhausted: { energy: 0.55, pace: 0.5, flicker: 0, word: 'dim' },
  'Low Energy': { energy: 0.7, pace: 0.7, flicker: 0.2, word: 'low' },
  Neutral: { energy: 0.85, pace: 1, flicker: 0, word: 'steady' },
};

export const MOODS = ['Happy', 'Overwhelmed', 'Exhausted', 'Low Energy'] as const;

export function moodLight(mood: string | null | undefined) {
  return MOOD_LIGHT[mood ?? 'Neutral'] ?? MOOD_LIGHT.Neutral;
}

/** What to do about the partner's mood. Same guidance the current app gives. */
export function moodAdvice(mood: string, name: string): string {
  switch (mood) {
    case 'Happy':
      return `Ride it. Plan something sweet tonight or do something high-energy together.`;
    case 'Overwhelmed':
      return `Take a chore off ${name}'s plate, keep things soft, and save serious talks for later.`;
    case 'Exhausted':
      return `Make home quiet and cosy. A warm drink and no demands.`;
    case 'Low Energy':
      return `Be close without asking for anything. A cuddle and a gentle check-in.`;
    default:
      return `Send something small: a meme, a thought, or tap their light.`;
  }
}
