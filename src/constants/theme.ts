/**
 * NOVIA design tokens.
 *
 * Palette is built from five source colours:
 *   #386641 forest   #6A994E moss   #A7C957 lime   #F2E8CF cream   #BC4749 brick
 *
 * The app keeps its neumorphic + glassmorphic language — depth comes from
 * translucent fills and soft layered shadows, never from hard outlines — but the
 * base moved from black/orange to a deep forest ground with warm cream type and
 * lime accents, so it reads organic rather than neon.
 */

// Raw palette. Prefer the semantic tokens below in components; reach for these
// only when you need a specific hue (e.g. charts, phase indicators).
export const PALETTE = {
  forest: '#386641',
  moss: '#6A994E',
  lime: '#A7C957',
  cream: '#F2E8CF',
  brick: '#BC4749',

  // Derived shades that keep the ground dark enough for cream text to sit at a
  // comfortable contrast ratio.
  forestDeep: '#0E1A11',   // app background
  forestNight: '#132018',  // raised panels
  forestSoft: '#1B2E20',   // pressed / inset wells
} as const;

/**
 * Typography.
 *
 * Two families, deliberately not system defaults:
 *   Fraunces — a soft-serif with optical sizing, used only for display copy
 *              (greetings, section titles, hero numbers). Gives the app an
 *              editorial voice that Roboto/San Francisco cannot.
 *   Manrope  — a geometric sans for everything functional: labels, body,
 *              buttons, metadata.
 *
 * IMPORTANT: each entry names a single statically-weighted font file. When a
 * custom fontFamily is set you must NOT also set fontWeight — Android ignores it
 * and iOS synthesises a faux-bold on top of an already-bold file, so the same
 * text renders differently on the two platforms. Pick the family that carries
 * the weight you want instead.
 */
export const FONTS = {
  display: 'Fraunces_600SemiBold',
  displayBold: 'Fraunces_700Bold',

  body: 'Manrope_400Regular',
  medium: 'Manrope_500Medium',
  semibold: 'Manrope_600SemiBold',
  bold: 'Manrope_700Bold',
  heavy: 'Manrope_800ExtraBold',
} as const;

export const THEME = {
  fonts: FONTS,
  colors: {
    background: PALETTE.forestDeep,
    surface: 'rgba(242, 232, 207, 0.06)',   // cream-tinted glass
    border: 'rgba(242, 232, 207, 0.14)',    // used sparingly; prefer shadow for depth
    text: PALETTE.cream,
    textMuted: 'rgba(242, 232, 207, 0.62)',
    textFaint: 'rgba(242, 232, 207, 0.38)',

    primary: PALETTE.lime,       // main accent, CTAs, active states
    accent: PALETTE.moss,        // secondary accent
    rust: PALETTE.brick,         // destructive / alert
    charcoal: PALETTE.forestNight,
    forest: PALETTE.forest,
    cream: PALETTE.cream,

    // Mood states, pulled into the palette's range.
    mood: {
      Happy: PALETTE.lime,
      Overwhelmed: PALETTE.brick,
      Exhausted: '#7D8A6F',
      'Low Energy': '#D8B863',
      Neutral: PALETTE.forest,
    },

    // Menstrual cycle phases. All entries must stay 6-digit hex — call sites
    // append a hex alpha suffix (e.g. `+ '26'`), which an rgba() string breaks.
    phase: {
      Menstruation: PALETTE.brick,
      Follicular: PALETTE.moss,
      Ovulation: PALETTE.lime,
      Luteal: '#D8B863',
      Unknown: '#8A8B7C',
    },

    success: PALETTE.moss,
    warning: '#D8B863',
    danger: PALETTE.brick,
    info: '#5B8C7E',
  },
  spacing: {
    xs: 4,
    sm: 8,
    md: 16,
    lg: 24,
    xl: 32,
  },
  borderRadius: {
    sm: 12,
    md: 18,
    lg: 24,
    xl: 30,
    round: 9999,
  },

  // Translucent fills. No hard outlines — depth is carried by these plus shadow.
  glass: {
    surface: 'rgba(242, 232, 207, 0.055)',       // resting frosted glass
    surfaceStrong: 'rgba(242, 232, 207, 0.095)', // raised / hovered glass
    inset: 'rgba(0, 0, 0, 0.26)',                // carved-in fields (inputs)
    accent: 'rgba(167, 201, 87, 0.14)',          // active / selected tint
    accentStrong: 'rgba(167, 201, 87, 0.22)',
    moss: 'rgba(106, 153, 78, 0.16)',
    danger: 'rgba(188, 71, 73, 0.14)',
    success: 'rgba(106, 153, 78, 0.13)',
  },

  // Soft-UI shadow presets. Large, diffuse shadows lift glass off the deep
  // forest backdrop like extruded neumorphic panels.
  shadow: {
    soft: {
      shadowColor: '#000000',
      shadowOpacity: 0.34,
      shadowRadius: 20,
      shadowOffset: { width: 0, height: 12 },
      elevation: 6,
    },
    lifted: {
      shadowColor: '#000000',
      shadowOpacity: 0.42,
      shadowRadius: 30,
      shadowOffset: { width: 0, height: 20 },
      elevation: 10,
    },
    glowAccent: {
      shadowColor: PALETTE.lime,
      shadowOpacity: 0.42,
      shadowRadius: 22,
      shadowOffset: { width: 0, height: 10 },
      elevation: 9,
    },
    glowDanger: {
      shadowColor: PALETTE.brick,
      shadowOpacity: 0.40,
      shadowRadius: 20,
      shadowOffset: { width: 0, height: 10 },
      elevation: 9,
    },
  },
} as const;
