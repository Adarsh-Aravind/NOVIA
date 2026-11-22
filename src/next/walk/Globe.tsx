import React, { useMemo } from 'react';
import { Canvas, Circle, Fill, Group, Path, Shader, Skia, BlurMask, useClock } from '@shopify/react-native-skia';
import { cancelAnimation, useDerivedValue, useSharedValue, withDecay, withDelay, withSpring } from 'react-native-reanimated';
import { Gesture, GestureDetector } from 'react-native-gesture-handler';
import { SPRING, soften } from '../motion';
import { PLACES } from './places';
import { C, rgb } from '../theme';

/**
 * A night-side Earth for Walk Together: a lit sphere with a graticule and an
 * atmosphere (shader), the world's cities as lights, your route as a great
 * circle, the part you've walked in both your colours, and the two of you as a
 * single glowing point. It turns slowly to keep you facing the camera.
 *
 * Orthographic projection, computed per frame on the UI thread.
 */

const SPHERE = `
uniform float2 c;
uniform float r;
uniform float lat0;
uniform float lng0;
uniform float3 tint;

half4 main(float2 p) {
  float2 d = (p - c) / r;
  float rr = dot(d, d);
  if (rr > 1.0) {
    float k = sqrt(rr);
    float halo = exp(-(k - 1.0) * 9.0) * 0.55;
    return half4(tint * halo, halo);
  }
  float x = d.x;
  float y = -d.y;
  float z = sqrt(1.0 - rr);
  float lat = asin(clamp(y * cos(lat0) + z * sin(lat0), -1.0, 1.0));
  float lng = lng0 + atan(x, z * cos(lat0) - y * sin(lat0));
  float step = 0.2618;
  float gLat = abs(fract(lat / step + 0.5) - 0.5) * step;
  float gLng = abs(fract(lng / step + 0.5) - 0.5) * step * cos(lat);
  float line = 1.0 - smoothstep(0.0, 0.006 / max(z, 0.2), min(gLat, gLng));
  float3 L = normalize(float3(-0.5, 0.55, 0.65));
  float diff = max(dot(float3(x, y, z), L), 0.0);
  float3 ocean = float3(0.05, 0.06, 0.16) + float3(0.10, 0.12, 0.30) * diff;
  float rim = pow(1.0 - z, 2.5);
  float3 col = ocean + tint * line * 0.22 + tint * rim * 0.7;
  return half4(col, 1.0);
}
`;
const sphereEffect = Skia.RuntimeEffect.Make(SPHERE)!;

const RAD = Math.PI / 180;

interface Props {
  size: number;
  from: { lat: number; lng: number };
  to: { lat: number; lng: number };
  here: { lat: number; lng: number };
  progress: number;
}

/** Great-circle route as N+1 lat/lng pairs (radians), flattened. */
function routePoints(a: { lat: number; lng: number }, b: { lat: number; lng: number }, n = 96): number[] {
  const toV = (p: { lat: number; lng: number }) => [Math.cos(p.lat * RAD) * Math.cos(p.lng * RAD), Math.cos(p.lat * RAD) * Math.sin(p.lng * RAD), Math.sin(p.lat * RAD)];
  const va = toV(a);
  const vb = toV(b);
  const omega = Math.acos(Math.max(-1, Math.min(1, va[0] * vb[0] + va[1] * vb[1] + va[2] * vb[2])));
  const out: number[] = [];
  for (let i = 0; i <= n; i++) {
    const t = i / n;
    const s = Math.sin(omega) || 1;
    const ka = omega < 1e-6 ? 1 - t : Math.sin((1 - t) * omega) / s;
    const kb = omega < 1e-6 ? t : Math.sin(t * omega) / s;
    const v = [0, 1, 2].map((k) => va[k] * ka + vb[k] * kb);
    out.push(Math.asin(Math.max(-1, Math.min(1, v[2]))), Math.atan2(v[1], v[0]));
  }
  return out;
}

export function Globe({ size, from, to, here, progress }: Props) {
  const clock = useClock();
  const R = size * 0.42;
  const cx = size / 2;
  const cy = size / 2;
  const tint = rgb(C.partner);

  const cities = useMemo(() => PLACES.flatMap((p) => [p.lat * RAD, p.lng * RAD]), []);
  const route = useMemo(() => routePoints(from, to), [from, to]);
  const doneCount = Math.max(1, Math.round(progress * (route.length / 2 - 1)));
  const hereLat = here.lat * RAD;
  const hereLng = here.lng * RAD;
  const ends = [from.lat * RAD, from.lng * RAD, to.lat * RAD, to.lng * RAD];

  // Face the walkers, with a slow sway so the globe feels alive.
  // Grab it and spin it. The globe turns 1:1 under the finger (from wherever
  // it was when grabbed, so catching it mid-spin just stops it in your hand),
  // keeps spinning with the flick's momentum, then after a moment eases back
  // to face the two of you. Tilt is rubber-banded so you can't flip it over.
  const offLng = useSharedValue(0);
  const offLat = useSharedValue(0);
  const startLng = useSharedValue(0);
  const startLat = useSharedValue(0);
  const home = { mass: 1, stiffness: 44, damping: 13.3 }; // dampingRatio 1, response ~0.95 s: an unhurried return

  const spin = Gesture.Pan()
    .activeOffsetX([-10, 10])
    .failOffsetY([-14, 14])
    .onStart(() => {
      cancelAnimation(offLng);
      cancelAnimation(offLat);
      startLng.value = offLng.value;
      startLat.value = offLat.value;
    })
    .onUpdate((e) => {
      offLng.value = startLng.value - e.translationX / R;
      offLat.value = soften(startLat.value + e.translationY / R, -0.7, 0.7, 1.5);
    })
    .onEnd((e) => {
      // Spin on with the finger's own velocity (in radians/s). When it comes
      // to rest, drop whole turns (invisible, since a turn looks the same),
      // then ease home the short way round.
      offLng.value = withDecay({ velocity: -e.velocityX / R, deceleration: 0.997 }, (finished) => {
        if (!finished) return;
        const turn = Math.PI * 2;
        offLng.value = offLng.value - Math.round(offLng.value / turn) * turn;
        offLng.value = withDelay(1400, withSpring(0, home));
      });
      offLat.value = withSpring(0, { ...SPRING.flick, velocity: e.velocityY / R });
    });

  const view = useDerivedValue(() => {
    const t = clock.value / 1000;
    return {
      lat0: Math.max(-1.2, Math.min(1.2, hereLat * 0.7 + 0.25 + offLat.value)),
      lng0: hereLng + Math.sin(t / 7) * 0.35 + offLng.value,
    };
  });

  const uniforms = useDerivedValue(() => ({ c: [cx, cy], r: R, lat0: view.value.lat0, lng0: view.value.lng0, tint }));

  const geometry = useDerivedValue(() => {
    const { lat0, lng0 } = view.value;
    const sl0 = Math.sin(lat0);
    const cl0 = Math.cos(lat0);
    const proj = (lat: number, lng: number) => {
      const cl = Math.cos(lat);
      const dl = lng - lng0;
      const x = cl * Math.sin(dl);
      const y = cl0 * Math.sin(lat) - sl0 * cl * Math.cos(dl);
      const z = sl0 * Math.sin(lat) + cl0 * cl * Math.cos(dl);
      return [cx + x * R, cy - y * R, z];
    };
    const lights = Skia.Path.Make();
    for (let i = 0; i < cities.length; i += 2) {
      const p = proj(cities[i], cities[i + 1]);
      if (p[2] > 0.05) lights.addCircle(p[0], p[1], 1.2 + p[2] * 1.2);
    }
    const line = (startIdx: number, endIdx: number) => {
      const path = Skia.Path.Make();
      let pen = false;
      for (let i = startIdx; i <= endIdx; i++) {
        const p = proj(route[i * 2], route[i * 2 + 1]);
        if (p[2] < 0) {
          pen = false;
          continue;
        }
        if (pen) path.lineTo(p[0], p[1]);
        else path.moveTo(p[0], p[1]);
        pen = true;
      }
      return path;
    };
    const n = route.length / 2 - 1;
    const hp = proj(hereLat, hereLng);
    const a = proj(ends[0], ends[1]);
    const b = proj(ends[2], ends[3]);
    return {
      lights,
      full: line(0, n),
      done: line(0, doneCount),
      here: hp,
      a,
      b,
    };
  });

  const lights = useDerivedValue(() => geometry.value.lights);
  const full = useDerivedValue(() => geometry.value.full);
  const done = useDerivedValue(() => geometry.value.done);
  const hx = useDerivedValue(() => geometry.value.here[0]);
  const hy = useDerivedValue(() => geometry.value.here[1]);
  const hVis = useDerivedValue(() => (geometry.value.here[2] > 0 ? 1 : 0));
  const ax = useDerivedValue(() => geometry.value.a[0]);
  const ay = useDerivedValue(() => geometry.value.a[1]);
  const aVis = useDerivedValue(() => (geometry.value.a[2] > 0 ? 1 : 0));
  const bx = useDerivedValue(() => geometry.value.b[0]);
  const by = useDerivedValue(() => geometry.value.b[1]);
  const bVis = useDerivedValue(() => (geometry.value.b[2] > 0 ? 1 : 0));
  const pulse = useDerivedValue(() => 9 + 3 * Math.sin(clock.value / 300));

  return (
    <GestureDetector gesture={spin}>
    <Canvas style={{ width: size, height: size }}>
      <Fill>
        <Shader source={sphereEffect} uniforms={uniforms} />
      </Fill>
      <Path path={lights} color={C.star} opacity={0.55} />
      <Path path={full} color={C.star} opacity={0.28} style="stroke" strokeWidth={1.5} />
      <Path path={done} color={C.me} style="stroke" strokeWidth={3} strokeCap="round" />
      <Group opacity={aVis}>
        <Circle cx={ax} cy={ay} r={4} color={C.ink} />
      </Group>
      <Group opacity={bVis}>
        <Circle cx={bx} cy={by} r={5} color={C.partner} />
        <Circle cx={bx} cy={by} r={9} color={C.partner} opacity={0.3} />
      </Group>
      <Group opacity={hVis}>
        <Circle cx={hx} cy={hy} r={pulse} color={C.star} opacity={0.35}>
          <BlurMask blur={6} style="normal" />
        </Circle>
        <Circle cx={hx} cy={hy} r={5} color={C.star} />
      </Group>
    </Canvas>
    </GestureDetector>
  );
}
