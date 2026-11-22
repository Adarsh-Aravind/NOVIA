import { Skia } from '@shopify/react-native-skia';

/**
 * The two shaders behind the home screen. Both are SkSL, compiled once at
 * import and run on the GPU every frame, so the sky costs the JS thread
 * nothing.
 */

// The sky itself: a time-of-day gradient, a faint nebula tinted by each
// partner's colour around their light, and two layers of procedural stars that
// shift at different rates as the phone tilts (the depth you feel).
const SKY = `
uniform float2 res;
uniform float time;
uniform float3 top;
uniform float3 bottom;
uniform float starVis;
uniform float2 tilt;
uniform float3 cMe;
uniform float3 cPa;
uniform float2 heart;

float hash(float2 p) {
  p = fract(p * float2(123.34, 456.21));
  p += dot(p, p + 45.32);
  return fract(p.x * p.y);
}

float starLayer(float2 uv, float scale, float t) {
  float2 g = uv * scale;
  float2 id = floor(g);
  float2 f = fract(g) - 0.5;
  float h = hash(id);
  float2 off = float2(hash(id + 1.7), hash(id + 3.1)) - 0.5;
  float d = length(f - off * 0.7);
  float tw = 0.55 + 0.45 * sin(t * (0.4 + h * 1.8) + h * 40.0);
  float s = (1.0 - smoothstep(0.0, 0.045 + 0.04 * h, d)) * step(0.8, h);
  return s * tw;
}

half4 main(float2 p) {
  float2 uv = p / res;
  float3 col = mix(top, bottom, smoothstep(0.0, 1.0, uv.y));
  float2 q = (p - heart) / res.x;
  float2 qa = q + float2(0.2, -0.04) + tilt * 0.01;
  float2 qb = q - float2(0.2, 0.04) + tilt * 0.01;
  col += cMe * exp(-dot(qa, qa) * 7.0) * 0.13;
  col += cPa * exp(-dot(qb, qb) * 7.0) * 0.13;
  float2 sp = p / res.x;
  float s = starLayer(sp + tilt * 0.006, 34.0, time);
  s += 0.8 * starLayer(sp + tilt * 0.016 + 3.1, 19.0, time * 1.3);
  col += float3(1.0, 0.96, 0.9) * s * starVis;
  return half4(col, 1.0);
}
`;

// The two lights. Each is a lit sphere with a slow swirl inside, a rim, a
// specular glint and a soft halo. Mood drives brightness, pace and flicker;
// holding adds a heartbeat. `merge` blooms the space between them when both
// partners hold at once. `ripple` is the ring a nudge sends out.
const ORBS = `
uniform float2 res;
uniform float time;
uniform float2 pA; uniform float rA; uniform float3 cA; uniform float eA; uniform float fA; uniform float hA; uniform float sA;
uniform float2 pB; uniform float rB; uniform float3 cB; uniform float eB; uniform float fB; uniform float hB; uniform float sB;
uniform float ripple;
uniform float2 pR;
uniform float3 cR;
uniform float merge;

float beat(float t) {
  float f = fract(t);
  return exp(-pow((f - 0.08) * 16.0, 2.0)) + 0.6 * exp(-pow((f - 0.3) * 16.0, 2.0));
}

float4 orb(float2 p, float2 c, float r, float3 col, float e, float fl, float h, float sp) {
  float t = time * sp;
  float pulse = 1.0 + 0.035 * sin(t * 2.0) + h * 0.12 * beat(time * 1.15);
  float flick = 1.0 - fl * 0.28 * step(0.72, fract(sin(floor(time * 11.0) * 91.7) * 437.0));
  float R = r * pulse;
  float2 d = (p - c) / R;
  float rr = length(d);
  float glow = exp(-rr * rr * 0.55) * 0.5 * e * flick * (1.0 + h * 0.6);
  float3 outc = col * glow;
  float a = glow * 0.85;
  if (rr < 1.0) {
    float z = sqrt(1.0 - rr * rr);
    float3 n = float3(d.x, d.y, z);
    float3 L = normalize(float3(-0.45, -0.6, 0.75));
    float diff = max(dot(n, L), 0.0);
    float spec = pow(max(dot(reflect(-L, n), float3(0.0, 0.0, 1.0)), 0.0), 28.0);
    // A slowly turning surface: rotate the normal about the vertical axis and
    // lay soft, warped bands across it, like weather on a small planet.
    float ca = cos(t * 0.35);
    float sa = sin(t * 0.35);
    float3 q = float3(n.x * ca + n.z * sa, n.y, -n.x * sa + n.z * ca);
    float warp = sin(q.x * 3.1 + t * 0.6) * 0.6 + sin(q.z * 2.3 - t * 0.4) * 0.4;
    float sw = 0.5 + 0.5 * sin(q.y * 7.0 + warp * 2.2);
    float3 core = mix(col, float3(1.0, 0.97, 0.92), pow(z, 4.0) * 0.28);
    float3 body = core * (0.42 + 0.75 * diff) * (0.8 + 0.3 * sw) * e * flick;
    body += col * 0.18 * e;
    float rim = pow(1.0 - z, 3.0);
    body += col * rim * 1.2 + float3(1.0) * spec * 0.55;
    float edge = 1.0 - smoothstep(0.96, 1.0, rr);
    outc = mix(outc, body, edge);
    a = max(a, edge);
  }
  return float4(outc, a);
}

half4 main(float2 p) {
  // Most of the screen is nowhere near either light. Past about 3.8 radii a
  // light's halo is under 0.1% and invisible, so unless a ripple or the merge
  // bloom is showing, those pixels skip the lighting maths entirely.
  if (ripple <= 0.0 && merge <= 0.001 &&
      length(p - pA) > rA * 3.8 * (1.0 + hA * 0.3) &&
      length(p - pB) > rB * 3.8 * (1.0 + hB * 0.3)) {
    return half4(0.0);
  }
  float4 A = orb(p, pA, rA, cA, eA, fA, hA, sA);
  float4 B = orb(p, pB, rB, cB, eB, fB, hB, sB);
  float3 col = A.rgb + B.rgb;
  float a = clamp(max(A.a, B.a) + min(A.a, B.a) * 0.3, 0.0, 1.0);
  if (ripple > 0.0 && ripple < 1.0) {
    float d = length(p - pR);
    float R = rB + ripple * res.x * 0.55;
    float ring = exp(-pow((d - R) / 5.0, 2.0)) * (1.0 - ripple) * 0.9;
    col += cR * ring;
    a = max(a, ring);
  }
  float2 mid = (pA + pB) * 0.5;
  float md = length(p - mid) / (res.x * 0.32);
  float bloom = merge * exp(-md * md * 2.5) * 0.65 * (0.75 + 0.25 * beat(time * 1.15));
  col += float3(1.0, 0.9, 0.78) * bloom;
  a = max(a, bloom);
  return half4(clamp(col, 0.0, 1.0), a);
}
`;

function compile(src: string, name: string) {
  const effect = Skia.RuntimeEffect.Make(src);
  if (!effect) throw new Error(`[NOVIA Next] ${name} shader failed to compile`);
  return effect;
}

export const skyEffect = compile(SKY, 'sky');
export const orbEffect = compile(ORBS, 'orbs');
