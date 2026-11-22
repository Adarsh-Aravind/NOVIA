import React, { useMemo } from 'react';
import { StyleSheet } from 'react-native';
import {
  Canvas,
  Circle,
  DashPathEffect,
  Fill,
  Group,
  BlurMask,
  Path,
  Shader,
  Skia,
} from '@shopify/react-native-skia';
import { SharedValue, useDerivedValue } from 'react-native-reanimated';
import { skyEffect, orbEffect } from './shaders';
import type { Star } from '../hooks/useConstellation';
import { C, rgb, SkyColours } from '../theme';

/** Where the two lights are at time `t`. Shared with the touch targets. */
export function lightPositions(t: number, sep: number, w: number, cx: number, cy: number) {
  'worklet';
  const ang = -0.38 + Math.sin(t / 9000) * 0.1;
  const d = w * 0.19 * sep;
  const bob = Math.sin(t / 1500) * 4;
  return {
    ax: cx - Math.cos(ang) * d,
    ay: cy - Math.sin(ang) * d + bob,
    bx: cx + Math.cos(ang) * d,
    by: cy + Math.sin(ang) * d - bob,
  };
}

export const ORB_SCALE = 0.095;
/** One full turn of the sky every 20 minutes. */
export const SPIN_PER_MS = (Math.PI * 2) / (20 * 60 * 1000);

export interface SkyMotion {
  clock: SharedValue<number>;
  tiltX: SharedValue<number>;
  tiltY: SharedValue<number>;
  sep: SharedValue<number>;
  merge: SharedValue<number>;
  meHold: SharedValue<number>;
  partnerHold: SharedValue<number>;
  ripple: SharedValue<number>;
  rippleFromMe: SharedValue<number>;
}

export interface LightStyle {
  energy: number;
  pace: number;
  flicker: number;
}

interface Props {
  width: number;
  height: number;
  cx: number;
  cy: number;
  sky: SkyColours;
  stars: Star[];
  motion: SkyMotion;
  me: LightStyle;
  partner: LightStyle;
  partnerAway: boolean;
}

/** Star position before the sky's slow spin, relative to the heart. */
export function starXY(s: Star, w: number) {
  const r0 = w * 0.24;
  const rMax = w * 0.62;
  const r = r0 + s.r * (rMax - r0);
  return { x: Math.cos(s.a) * r, y: Math.sin(s.a) * r * 0.9 };
}

const OWNER_COLOUR = { me: C.me, partner: C.partner, us: C.star } as const;
const PARALLAX = [3, 8, 15];

export function SkyCanvas({ width, height, cx, cy, sky, stars, motion, me, partner, partnerAway }: Props) {
  const meRGB = rgb(C.me);
  const paRGB = rgb(C.partner);

  const skyUniforms = useDerivedValue(() => ({
    res: [width, height],
    time: motion.clock.value / 1000,
    top: sky.top,
    bottom: sky.bottom,
    starVis: sky.stars,
    tilt: [motion.tiltX.value * 40, motion.tiltY.value * 40],
    cMe: meRGB,
    cPa: paRGB,
    heart: [cx, cy],
  }));

  const orbUniforms = useDerivedValue(() => {
    const t = motion.clock.value;
    const p = lightPositions(t, motion.sep.value, width, cx, cy);
    const tx = motion.tiltX.value * 10;
    const ty = motion.tiltY.value * 10;
    const r = width * ORB_SCALE;
    const fromMe = motion.rippleFromMe.value > 0.5;
    return {
      res: [width, height],
      time: t / 1000,
      pA: [p.ax + tx, p.ay + ty],
      rA: r * (1 + motion.meHold.value * 0.18),
      cA: meRGB,
      eA: me.energy,
      fA: me.flicker,
      hA: motion.meHold.value,
      sA: me.pace,
      pB: [p.bx + tx, p.by + ty],
      rB: r * (1 + motion.partnerHold.value * 0.18),
      cB: paRGB,
      eB: partnerAway ? partner.energy * 0.85 : partner.energy,
      fB: partner.flicker,
      hB: motion.partnerHold.value,
      sB: partner.pace,
      ripple: motion.ripple.value,
      pR: fromMe ? [p.ax + tx, p.ay + ty] : [p.bx + tx, p.by + ty],
      cR: fromMe ? meRGB : paRGB,
      merge: motion.merge.value,
    };
  });

  // Stars are grouped by depth so each layer can drift by its own amount.
  const layers = useMemo(() => {
    const out: { x: number; y: number; s: Star }[][] = [[], [], []];
    for (const s of stars) {
      const { x, y } = starXY(s, width);
      out[s.depth].push({ x, y, s });
    }
    return out;
  }, [stars, width]);

  // The milestones, joined in date order: the line of your story.
  const storyPath = useMemo(() => {
    const path = Skia.Path.Make();
    const ms = stars.filter((s) => s.kind === 'milestone');
    ms.forEach((s, i) => {
      const { x, y } = starXY(s, width);
      if (i === 0) path.moveTo(x, y);
      else path.lineTo(x, y);
    });
    return path;
  }, [stars, width]);

  const spin = useDerivedValue(() => [
    { translateX: cx },
    { translateY: cy },
    { rotate: motion.clock.value * SPIN_PER_MS },
  ]);
  const shift0 = useDerivedValue(() => [{ translateX: motion.tiltX.value * PARALLAX[0] }, { translateY: motion.tiltY.value * PARALLAX[0] }]);
  const shift1 = useDerivedValue(() => [{ translateX: motion.tiltX.value * PARALLAX[1] }, { translateY: motion.tiltY.value * PARALLAX[1] }]);
  const shift2 = useDerivedValue(() => [{ translateX: motion.tiltX.value * PARALLAX[2] }, { translateY: motion.tiltY.value * PARALLAX[2] }]);
  const tw0 = useDerivedValue(() => 0.78 + 0.22 * Math.sin(motion.clock.value / 1300));
  const tw1 = useDerivedValue(() => 0.78 + 0.22 * Math.sin(motion.clock.value / 2000 + 2));
  const tw2 = useDerivedValue(() => 0.8 + 0.2 * Math.sin(motion.clock.value / 2700 + 4));
  const layerShift = [shift0, shift1, shift2];
  const twinkle = [tw0, tw1, tw2];

  return (
    <Canvas style={[StyleSheet.absoluteFill, { width, height }]}>
      <Fill>
        <Shader source={skyEffect} uniforms={skyUniforms} />
      </Fill>

      <Group transform={layerShift[2]}>
        <Group transform={spin}>
          <Path path={storyPath} color={C.star} opacity={0.22} style="stroke" strokeWidth={1}>
            <DashPathEffect intervals={[3, 5]} />
          </Path>
        </Group>
      </Group>

      {layers.map((layer, d) => (
        <Group key={d} transform={layerShift[d]} opacity={twinkle[d]}>
          <Group transform={spin}>
            {layer.map(({ x, y, s }) => (
              <Group key={s.id}>
                {s.size > 2.2 && (
                  <Circle cx={x} cy={y} r={s.size * 2.6} color={OWNER_COLOUR[s.owner]} opacity={0.28}>
                    <BlurMask blur={s.size * 2} style="normal" />
                  </Circle>
                )}
                <Circle cx={x} cy={y} r={s.size * (0.7 + d * 0.15)} color={OWNER_COLOUR[s.owner]} />
              </Group>
            ))}
          </Group>
        </Group>
      ))}

      <Fill>
        <Shader source={orbEffect} uniforms={orbUniforms} />
      </Fill>
    </Canvas>
  );
}
