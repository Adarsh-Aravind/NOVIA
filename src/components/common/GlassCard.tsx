import React from 'react';
import { StyleSheet, View, ViewStyle } from 'react-native';
import Svg, { Defs, LinearGradient, Rect, Stop } from 'react-native-svg';
import { THEME } from '../../constants/theme';

/**
 * Glossy glass.
 *
 * A real pane has four things going on at once, and leaving any of them out is
 * what makes a "glass" card read as a tinted box instead:
 *
 *   1. It blurs what is behind it        -> BlurView
 *   2. It carries a tint of its own      -> the material fill, over the blur
 *   3. Light grazes its face             -> the gloss gradient
 *   4. Light gathers along its top edge  -> the specular edge
 *
 * Why expo-blur is required at all: React Native has no backdrop-filter. Nothing
 * in the JS layer can sample what is behind a view, so (1) is only reachable
 * through a native module — which is why this needs a fresh `eas build` rather
 * than an OTA update.
 *
 * WHICH IS EXACTLY WHY THE REQUIRE IS LAZY. expo-blur is a native module, so on
 * a build that predates it (every install already in the wild) a static import
 * would tear down the JS bundle at startup. Requiring it inside a try/catch
 * means an OTA can ship this code to the current APK today: the blur simply
 * doesn't engage, the card falls back to the opaque material, and the app keeps
 * running. Once a new native build lands, the blur switches itself on with no
 * further change. Same pattern [[useSteps]] uses for react-native-health-connect,
 * and for the same reason.
 *
 * Android note: expo-blur defaults `experimentalBlurMethod` to 'none', which
 * renders a plain translucent view and no blur whatsoever. It has to be set to
 * 'dimezisBlurView' explicitly or Android users get none of this. That path is
 * flagged experimental and costs real frame time, which is why blur is reserved
 * for hero and chrome surfaces rather than every card on a scrolling screen.
 */

type BlurModule = typeof import('expo-blur');

let blurModule: BlurModule | null | undefined; // undefined = not tried, null = absent

function getBlur(): BlurModule | null {
  if (blurModule !== undefined) return blurModule;
  try {
    // eslint-disable-next-line @typescript-eslint/no-var-requires
    blurModule = require('expo-blur') as BlurModule;
  } catch {
    blurModule = null;
  }
  return blurModule;
}

/** Is real backdrop blur available in this binary? */
export const hasNativeBlur = (): boolean => getBlur() !== null;

export type GlassTier = 'regular' | 'thick' | 'chrome';

/**
 * Per-tier blur strength and the tint that sits on top of it.
 *
 * The tint is deliberately weaker than the non-blur material fill: once the
 * backdrop is blurred, the surface no longer needs opacity to separate itself
 * from what's behind, and keeping the old fill would just look muddy.
 */
const BLURRED: Record<GlassTier, { intensity: number; tint: string }> = {
  regular: { intensity: 42, tint: 'rgba(237, 237, 244, 0.055)' },
  thick: { intensity: 55, tint: 'rgba(237, 237, 244, 0.085)' },
  chrome: { intensity: 70, tint: 'rgba(24, 26, 40, 0.52)' },
};

/**
 * The material itself, as an absolutely-positioned backing layer.
 *
 * Split out from GlassCard so it can be dropped inside containers that must
 * stay something other than a plain View — the drawer is an Animated.View
 * carrying a pan responder, the tab dock positions itself absolutely. Both need
 * the glass without giving up what they already are.
 *
 * Render it as the FIRST child of its container, so everything else in that
 * container paints above it.
 */
export function GlassBacking({
  radius = THEME.borderRadius.md,
  tier = 'regular',
  gloss = true,
  blur = true,
}: {
  radius?: number;
  tier?: GlassTier;
  gloss?: boolean;
  blur?: boolean;
}) {
  const mod = blur ? getBlur() : null;
  const BlurView = mod?.BlurView;
  const spec = BLURRED[tier];

  // Two Svg elements can collide on a shared gradient id, so scope it.
  const gid = React.useId().replace(/:/g, '');

  return (
    <View
      pointerEvents="none"
      style={[StyleSheet.absoluteFillObject, { borderRadius: radius, overflow: 'hidden' }]}
    >
      {BlurView ? (
        <>
          <BlurView
            intensity={spec.intensity}
            tint="dark"
            experimentalBlurMethod="dimezisBlurView"
            // Android's perceived intensity runs hotter than iOS at the same
            // number; 3 lands the two platforms in roughly the same place.
            blurReductionFactor={3}
            style={StyleSheet.absoluteFill}
          />
          <View style={[StyleSheet.absoluteFill, { backgroundColor: spec.tint }]} />
        </>
      ) : null}

      {gloss && (
        <Svg width="100%" height="100%">
          <Defs>
            {/* The graze across the face. Steep and short: gloss is a
                highlight, and a highlight that runs the full height stops
                reading as light and starts reading as a colour wash. */}
            <LinearGradient id={`gloss${gid}`} x1="0" y1="0" x2="0.55" y2="1">
              <Stop offset="0" stopColor="#FFFFFF" stopOpacity="0.30" />
              <Stop offset="0.10" stopColor="#FFFFFF" stopOpacity="0.12" />
              <Stop offset="0.34" stopColor="#FFFFFF" stopOpacity="0.03" />
              <Stop offset="1" stopColor="#FFFFFF" stopOpacity="0" />
            </LinearGradient>
            {/* The lit top edge, brightest left of centre and falling off
                toward both corners — one light source, slightly off-axis, so
                the edge doesn't read as a drawn line. */}
            <LinearGradient id={`edge${gid}`} x1="0" y1="0" x2="1" y2="0">
              <Stop offset="0" stopColor="#FFFFFF" stopOpacity="0.05" />
              <Stop offset="0.32" stopColor="#FFFFFF" stopOpacity="0.55" />
              <Stop offset="0.68" stopColor="#FFFFFF" stopOpacity="0.22" />
              <Stop offset="1" stopColor="#FFFFFF" stopOpacity="0.04" />
            </LinearGradient>
          </Defs>
          <Rect x="0" y="0" width="100%" height="100%" fill={`url(#gloss${gid})`} />
          <Rect x="0" y="0" width="100%" height="1.5" fill={`url(#edge${gid})`} />
        </Svg>
      )}
    </View>
  );
}

export function GlassCard({
  children,
  style,
  radius = THEME.borderRadius.md,
  tier = 'regular',
  gloss = true,
  blur = true,
}: {
  children?: React.ReactNode;
  style?: ViewStyle | ViewStyle[];
  radius?: number;
  tier?: GlassTier;
  /** The specular graze + lit top edge. */
  gloss?: boolean;
  /** Opt out of the backdrop blur on surfaces where the frame cost isn't earned. */
  blur?: boolean;
}) {
  const blurring = blur && hasNativeBlur();

  return (
    <View
      style={[
        THEME.material[tier],
        { borderRadius: radius },
        style,
        // Last, so it beats any fill the caller's style carries: an opaque
        // parent background paints *behind* the BlurView, which would leave the
        // blur nothing of the real backdrop to sample.
        blurring ? { backgroundColor: 'transparent' } : null,
      ]}
    >
      <GlassBacking radius={radius} tier={tier} gloss={gloss} blur={blur} />
      {/* Content sits above the decoration, so the gloss never washes out the
          first line of text. */}
      {children}
    </View>
  );
}
