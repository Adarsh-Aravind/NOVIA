/**
 * NOVIA design tokens.
 *
 * One hue, on black. Neon orange (#FF6A00) is the only chromatic colour in the
 * app; everything else is a warm neutral. The discipline is the point — with a
 * single accent, orange always means "this is the thing that matters", and the
 * eye never has to work out which of four colours is the important one.
 *
 * The consequence to design around: **hue is no longer available to carry
 * meaning.** Success, warning and danger cannot be green/amber/red. States are
 * distinguished by *intensity* instead — saturated accent for hot, warm greys
 * falling away for cold — backed by icons and explicit wording wherever the
 * distinction actually matters (delete, unpair, sign out). Intensity has the
 * side benefit of surviving greyscale and colour-vision deficiency, which the
 * old five-hue mood and phase scales did not.
 *
 * Depth comes from translucent fills, a lit rim and layered shadow — see
 * `material` at the bottom, and GlassCard for the specular treatment.
 */

// Raw palette. Prefer the semantic tokens below in components; reach for these
// only when you need a specific hue (e.g. gradients, phase indicators).
//
// One accent, on black. Everything that is not the accent is a neutral — there
// are no second and third hues competing for attention, so the orange always
// means "this is the thing". The keys are named for what they are; the previous
// set (forest / moss / lime) were slots whose names had stopped describing
// their values, which is how a palette rots.
export const PALETTE = {
  ground: '#050505',   // app background — near-black, not pure, so shadow still reads
  panel: '#121110',    // raised panels
  well: '#1A1815',     // pressed / inset wells

  accent: '#FF6A00',   // neon orange — PRIMARY: CTAs, active states, emphasis
  accentHot: '#FF3D00', // destructive / alert — hotter and redder than the accent
  accentWarm: '#FFA640', // warning / caution — softer, more amber

  ink: '#F6F2EE',      // type / light ink, warmed a touch to sit with the orange
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

/**
 * The ink ramp — every neutral in the app, named by weight.
 *
 * These eight values were previously scattered through App.tsx as ~120 raw hex
 * literals (`#8B90A4`, `#5A6078`, `#F4F5FA`…) with no names and no system, so
 * there was no way to restyle the app without a find-and-replace, and no way to
 * tell which greys were deliberate and which were drift.
 *
 * The number is roughly the perceived lightness against the app's ground, so
 * `ink[95]` is body copy and `ink[35]` is a placeholder. Pick by role, not by
 * eye: text you must read is 70 or above, text you may ignore is 50 or below.
 *
 * The ramp is warm, not neutral. A pure grey next to a saturated orange reads
 * as unrelated — as though the two came from different designs. Biasing every
 * step very slightly toward the accent (R > G > B by a few points) makes the
 * neutrals read as chosen rather than defaulted, without any step looking
 * tinted on its own.
 */
export const INK = {
  100: '#FFFFFF', // emphasis — brighter than body, used sparingly
  95: '#F6F2EE', // primary text
  70: '#C6BFB8', // secondary text
  55: '#968E87',
  50: '#807871', // muted / metadata
  35: '#56514C', // placeholder text
  22: '#36322E',
  16: '#24211F', // hairlines, barely-there fills
  0: '#000000',
} as const;

/**
 * `rgba()` from a 6-digit hex plus an alpha.
 *
 * Tints used to be written as raw `rgba(14, 149, 148, 0.18)`, which hard-codes
 * the *hue* at the call site — so a palette change silently leaves a trail of
 * the old accent behind in every tint. Deriving them from a token means the
 * palette stays the single source of truth.
 */
export function alpha(hex: string, a: number): string {
  const h = hex.replace('#', '');
  const r = parseInt(h.slice(0, 2), 16);
  const g = parseInt(h.slice(2, 4), 16);
  const b = parseInt(h.slice(4, 6), 16);
  return `rgba(${r}, ${g}, ${b}, ${a})`;
}

export const THEME = {
  fonts: FONTS,
  ink: INK,
  colors: {
    background: PALETTE.ground,
    surface: alpha(INK[95], 0.06),   // ink-tinted glass
    border: alpha(INK[95], 0.14),    // used sparingly; prefer shadow for depth
    text: INK[95],
    textMuted: alpha(INK[95], 0.62),
    textFaint: alpha(INK[95], 0.38),

    primary: PALETTE.accent,     // main accent, CTAs, active states
    accent: PALETTE.accentWarm,  // secondary emphasis — softer, more amber
    rust: PALETTE.accentHot,     // destructive / alert
    charcoal: PALETTE.panel,
    forest: PALETTE.well,
    cream: INK[95],

    /*
     * Mood and phase used to be five distinct hues each. On a single-accent
     * palette that is no longer available — and it was never the strongest
     * encoding anyway, since hue alone is the channel most people lose to
     * colour-vision deficiency.
     *
     * Both scales now run on *intensity* instead: saturated orange at the hot
     * end, falling through warm greys to almost nothing at the cold end. That
     * survives the palette, reads correctly in greyscale, and puts the brightest
     * value on the state that most wants attention.
     */
    mood: {
      Happy: PALETTE.accent,
      Overwhelmed: PALETTE.accentHot,
      Exhausted: INK[35],
      'Low Energy': INK[50],
      Neutral: INK[55],
    },

    // Menstrual cycle phases. All entries must stay 6-digit hex — call sites
    // append a hex alpha suffix (e.g. `+ '26'`), which an rgba() string breaks.
    phase: {
      Menstruation: PALETTE.accentHot,
      Follicular: PALETTE.accent,
      Ovulation: PALETTE.accentWarm,
      Luteal: INK[50],
      Unknown: INK[35],
    },

    success: PALETTE.accent,
    warning: PALETTE.accentWarm,
    danger: PALETTE.accentHot,
    info: PALETTE.accent,
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

  // Translucent fills.
  //
  // These stay as the raw fill colours the app already references in ~68
  // places. The composed materials below (fill + rim + shadow) are what new
  // surfaces should use — reach for a bare fill only when you need a tint on
  // something that isn't a pane of glass.
  glass: {
    surface: alpha(INK[95], 0.075),   // resting frosted glass
    surfaceStrong: alpha(INK[95], 0.115), // raised / interactive glass
    inset: alpha(INK[0], 0.28),     // carved-in wells (inputs, nested rows)
    accent: alpha(PALETTE.accent, 0.16),  // active / selected tint
    accentStrong: alpha(PALETTE.accent, 0.24),
    moss: alpha(PALETTE.accent, 0.16),            // legacy alias for the accent tint
    danger: alpha(PALETTE.accentHot, 0.16),
    success: alpha(PALETTE.accent, 0.13),
  },

  /**
   * Rim light.
   *
   * A pane of glass is legible because its *edge* catches light, not because
   * its face is tinted. The app previously had exactly two borders in ~6000
   * lines and leaned entirely on shadow, which is why the cards read as flat
   * tinted panels rather than panes with a thickness.
   *
   * One notional light source, high and slightly forward, so every rim in the
   * app agrees about where the light is. `edge` is the general hairline;
   * `edgeBright` is for surfaces that sit closest to the viewer; `carved` is a
   * dark rim that reads as cut *into* a surface rather than raised off it.
   */
  rim: {
    edge: alpha(INK[95], 0.13),
    edgeBright: alpha(INK[95], 0.17),
    edgeFaint: alpha(INK[95], 0.10),
    carved: alpha(INK[0], 0.34),
    accent: alpha(PALETTE.accent, 0.42),
  },

  // Soft-UI shadow presets. Large, diffuse shadows lift glass off the deep
  // slate backdrop like extruded neumorphic panels.
  //
  // IMPORTANT: `elevation` is 0 on every preset. Android's elevation shadow is
  // drawn from the view's rectangular bounds and, on our translucent glass
  // fills, rendered as a hard boxy rectangle showing through the card — the
  // "boxy shadow" artifact. iOS soft shadows (shadowColor/Opacity/Radius/Offset)
  // are unaffected by elevation, so keeping elevation at 0 removes the Android
  // artifact while leaving iOS depth intact. Opaque surfaces that genuinely
  // need Android lift (e.g. the tab bar) set their own elevation locally.
  shadow: {
    // Graded by surface size, because a bigger pane reads as a thicker one: a
    // chip casts a tight shadow, a modal casts a deep diffuse one.
    chip: {
      shadowColor: '#000000',
      shadowOpacity: 0.24,
      shadowRadius: 10,
      shadowOffset: { width: 0, height: 4 },
      elevation: 0,
    },
    soft: {
      shadowColor: '#000000',
      shadowOpacity: 0.36,
      shadowRadius: 22,
      shadowOffset: { width: 0, height: 12 },
      elevation: 0,
    },
    lifted: {
      shadowColor: '#000000',
      shadowOpacity: 0.46,
      shadowRadius: 34,
      shadowOffset: { width: 0, height: 20 },
      elevation: 0,
    },
    glowAccent: {
      shadowColor: PALETTE.accent,
      shadowOpacity: 0.42,
      shadowRadius: 22,
      shadowOffset: { width: 0, height: 10 },
      elevation: 0,
    },
    glowDanger: {
      shadowColor: PALETTE.accentHot,
      shadowOpacity: 0.40,
      shadowRadius: 20,
      shadowOffset: { width: 0, height: 10 },
      elevation: 0,
    },
  },

  /**
   * Materials — fill + rim + depth as one spread.
   *
   * Apple's material tiers, translated to a platform with no backdrop blur.
   * React Native cannot blur what is behind a view without a native module, so
   * "thickness" is carried by the three things that *are* available: how opaque
   * the fill is, how brightly the rim catches the light, and how deep the
   * shadow falls. A thicker material is more opaque, more lit at the edge, and
   * further off the background — which is what the blur would have signalled.
   *
   * Two rules from the material system that this encodes:
   *   - Weight is hierarchy. `chrome` is structural (nav, drawer, modals) and
   *     is *darker* than the content it floats over, so it separates regions
   *     without competing. `thick` is for things you touch.
   *   - Never stack a light translucent surface on another. A row nested inside
   *     a card uses `well`, which is carved (darker + a dark rim), not another
   *     light pane — two light panes stacked lose their edges and the
   *     legibility of both collapses.
   *
   * If expo-blur is ever added, each tier gains a BlurView backing layer and
   * these values become the tint on top of it; nothing else has to change.
   */
  material: {
    /** Faint grouping *inside* an already-glass card. */
    thin: {
      backgroundColor: alpha(INK[95], 0.045),
      borderWidth: 1,
      borderColor: alpha(INK[95], 0.10),
      shadowColor: '#000000',
      shadowOpacity: 0.24,
      shadowRadius: 10,
      shadowOffset: { width: 0, height: 4 },
      elevation: 0,
    },
    /** The standard content card. */
    regular: {
      backgroundColor: alpha(INK[95], 0.075),
      borderWidth: 1,
      borderColor: alpha(INK[95], 0.13),
      shadowColor: '#000000',
      shadowOpacity: 0.36,
      shadowRadius: 22,
      shadowOffset: { width: 0, height: 12 },
      elevation: 0,
    },
    /** Raised and interactive — sits closest to the viewer. */
    thick: {
      backgroundColor: alpha(INK[95], 0.115),
      borderWidth: 1,
      borderColor: alpha(INK[95], 0.17),
      shadowColor: '#000000',
      shadowOpacity: 0.42,
      shadowRadius: 26,
      shadowOffset: { width: 0, height: 14 },
      elevation: 0,
    },
    /** Structural chrome: tab dock, drawer, modal cards. Darker than content. */
    chrome: {
      backgroundColor: alpha(PALETTE.panel, 0.94),
      borderWidth: 1,
      borderColor: alpha(INK[95], 0.11),
      shadowColor: '#000000',
      shadowOpacity: 0.46,
      shadowRadius: 34,
      shadowOffset: { width: 0, height: 20 },
      elevation: 0,
    },
    /** Carved into the surface above it: inputs, nested rows, nav tiles. */
    well: {
      backgroundColor: alpha(INK[0], 0.28),
      borderWidth: 1,
      borderColor: alpha(INK[0], 0.34),
    },
  },
} as const;
