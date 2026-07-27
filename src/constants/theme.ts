/**
 * NOVIA design tokens.
 *
 * Palette is built from five source colours:
 *   #0E9594 teal   #F24722 ember   #2D3047 slate   #E0E2DB mist   #EDEDF4 paper
 *
 * The app keeps its neumorphic + glassmorphic language — depth comes from
 * translucent fills and soft layered shadows, never from hard outlines — on a
 * cool slate ground with near-white type. Teal is the calm primary (CTAs,
 * active states); ember (orange-red) is reserved for destructive / alert
 * moments; a warm amber fills the "warning/gold" slot.
 *
 * NOTE: the PALETTE keys below keep their original names (forest, moss, lime …)
 * so the ~60 `PALETTE.*` references in App.tsx keep resolving — only the hex
 * values changed. Think of the keys as slots, not literal hues:
 *   forest → slate   moss → teal   lime → teal(primary)   brick → ember
 */

// Raw palette. Prefer the semantic tokens below in components; reach for these
// only when you need a specific hue (e.g. charts, phase indicators).
export const PALETTE = {
  forest: '#2D3047',   // slate — brand base (gradients, neutral tones)
  moss: '#0E9594',     // teal — secondary accent / success / info
  lime: '#0E9594',     // teal — PRIMARY accent, CTAs, active states
  cream: '#EDEDF4',    // paper — type / light ink
  brick: '#F24722',    // ember — destructive / alert

  // Derived shades that keep the ground dark enough for paper text to sit at a
  // comfortable contrast ratio.
  forestDeep: '#1E2030',   // app background
  forestNight: '#262A40',  // raised panels
  forestSoft: '#2D3047',   // pressed / inset wells
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
    surface: 'rgba(237, 237, 244, 0.06)',   // paper-tinted glass
    border: 'rgba(237, 237, 244, 0.14)',    // used sparingly; prefer shadow for depth
    text: PALETTE.cream,
    textMuted: 'rgba(237, 237, 244, 0.62)',
    textFaint: 'rgba(237, 237, 244, 0.38)',

    primary: PALETTE.lime,       // main accent, CTAs, active states (teal)
    accent: '#3FB8B0',           // secondary accent — brighter teal, distinct from primary
    rust: PALETTE.brick,         // destructive / alert (ember)
    charcoal: PALETTE.forestNight,
    forest: PALETTE.forest,
    cream: PALETTE.cream,

    // Mood states, pulled into the palette's range.
    mood: {
      Happy: PALETTE.moss,
      Overwhelmed: PALETTE.brick,
      Exhausted: '#5A6178',
      'Low Energy': '#E0A458',
      Neutral: '#8A90A4',
    },

    // Menstrual cycle phases. All entries must stay 6-digit hex — call sites
    // append a hex alpha suffix (e.g. `+ '26'`), which an rgba() string breaks.
    phase: {
      // Rose — distinct from the teal primary and the ember danger, still reads
      // as "period" and stays readable on the dark ground.
      Menstruation: '#E0576E',
      Follicular: PALETTE.moss,
      Ovulation: '#E0A458',
      Luteal: '#9C6B9E',
      Unknown: '#5A6178',
    },

    success: '#3FB8B0',          // positive / "owed to you" — brighter teal, not the primary teal
    warning: '#E0A458',
    danger: PALETTE.brick,
    info: PALETTE.moss,
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
    surface: 'rgba(237, 237, 244, 0.055)',       // resting frosted glass
    surfaceStrong: 'rgba(237, 237, 244, 0.095)', // raised / hovered glass
    inset: 'rgba(0, 0, 0, 0.26)',                // carved-in fields (inputs)
    accent: 'rgba(14, 149, 148, 0.14)',          // active / selected tint (teal)
    accentStrong: 'rgba(14, 149, 148, 0.22)',
    moss: 'rgba(14, 149, 148, 0.16)',            // teal tint
    danger: 'rgba(242, 71, 34, 0.16)',
    success: 'rgba(63, 184, 176, 0.13)',
  },

  // Soft-UI shadow presets. Large, diffuse shadows lift glass off the deep
  // slate backdrop like extruded neumorphic panels.
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
