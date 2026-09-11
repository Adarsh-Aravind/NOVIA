import React from 'react';
import { Image, StyleSheet, Text, View } from 'react-native';
import { THEME, FONTS } from '../../constants/theme';

/**
 * A profile picture, or the initial standing in for one.
 *
 * Two call sites at two sizes — the hub greeting and the side menu — which is
 * exactly why this is a component. The fallback has a real design (accent
 * letter on a glowing accent well) and duplicating it would guarantee the two
 * copies drift the first time either is touched.
 *
 * `uri` is whatever `profiles.avatar_url` holds. In practice that is a
 * `data:image/jpeg;base64,...` string rather than a remote URL — `<Image>`
 * takes either without caring, which is the whole reason storing the bytes in
 * the column works.
 */
export function Avatar({
  uri,
  name,
  size,
  ring = true,
}: {
  uri?: string | null;
  name?: string | null;
  size: number;
  /** The accent rim. Off for placements that already sit on an accent fill. */
  ring?: boolean;
}) {
  const letter = (name || '?').trim().charAt(0).toUpperCase() || '?';
  const radius = size / 2;

  const frame = [
    styles.frame,
    { width: size, height: size, borderRadius: radius },
    ring ? { borderWidth: 2, borderColor: THEME.rim.carved } : null,
  ];

  if (uri) {
    return (
      <View style={frame}>
        <Image
          source={{ uri }}
          style={{ width: '100%', height: '100%', borderRadius: radius }}
          // The source is a square by the time it is stored, but cover is the
          // honest choice for a circle: it fills rather than letterboxing if a
          // non-square ever slips through.
          resizeMode="cover"
        />
      </View>
    );
  }

  return (
    <View style={[frame, styles.placeholder]}>
      {/* Scaled off the frame so the letter fills the circle the same way at
          every size, instead of being tuned per call site. */}
      <Text style={[styles.letter, { fontSize: Math.round(size * 0.38) }]}>{letter}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  frame: {
    overflow: 'hidden',
    alignItems: 'center',
    justifyContent: 'center',
    // A chip shadow, not the accent glow. This sits in the hottest part of the
    // backdrop's corner burn, where an orange glow on orange is not a glow.
    ...THEME.shadow.chip,
  },
  /*
   * A dark scrim, not an accent tint.
   *
   * THEME.glass.accentStrong is accent at 0.24 — laid over a backdrop that is
   * *itself* accent, it composites to the same colour. Measured on the S23:
   * the disc came back at 1.02:1 against the burn and the letter at 1.48:1, so
   * neither the circle nor the initial was visible at all. Dimming instead of
   * tinting puts the disc at 4.03:1 and the accent letter on it at 6.24:1.
   */
  placeholder: {
    backgroundColor: THEME.material.chrome.backgroundColor,
  },
  letter: {
    fontFamily: FONTS.bold,
    color: THEME.colors.primary,
  },
});
