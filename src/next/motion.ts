/**
 * Gesture maths for NOVIA Next, as worklets so it runs on the UI thread in
 * the same frame as the finger. Spring presets come from the app's motion
 * tokens (Apple's damping-ratio and response model); see
 * src/constants/motion.ts for the reasoning.
 */
export { SPRING } from '../constants/motion';

/**
 * Where a flick would come to rest: UIScrollView's deceleration model, as in
 * Apple's *Designing Fluid Interfaces* sample code. `velocity` is in px/s,
 * which is what react-native-gesture-handler reports.
 */
export function project(velocity: number, decelerationRate = 0.998): number {
  'worklet';
  return ((velocity / 1000) * decelerationRate) / (1 - decelerationRate);
}

/**
 * Past a boundary, follow the finger less and less, like something real
 * slowing before it stops. A hard stop reads as frozen.
 */
export function rubberband(overshoot: number, dimension: number, constant = 0.55): number {
  'worklet';
  const sign = overshoot < 0 ? -1 : 1;
  const o = Math.abs(overshoot);
  return (sign * (o * dimension * constant)) / (dimension + constant * o);
}

/** Clamp to [min, max], rubber-banding anything beyond. */
export function soften(value: number, min: number, max: number, dimension: number): number {
  'worklet';
  if (value < min) return min + rubberband(value - min, dimension);
  if (value > max) return max + rubberband(value - max, dimension);
  return value;
}
