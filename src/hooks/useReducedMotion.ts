import { useEffect, useState } from 'react';
import { AccessibilityInfo } from 'react-native';

/**
 * The OS "reduce motion" setting (iOS Settings → Accessibility → Motion,
 * Android → Accessibility → Remove animations).
 *
 * Reduced motion does not mean *no* feedback — it means feedback without the
 * vestibular triggers. Callers should keep opacity and colour changes, which
 * aid comprehension, and drop travel, parallax, overshoot, and looping ambient
 * movement. The app's `Breathing` backdrop is the clearest case: a ~10s opacity
 * oscillation across the whole viewport sits right in the range that provokes
 * motion sensitivity.
 *
 * One native subscription is shared by every caller. The naive per-component
 * version fires an `isReduceMotionEnabled()` bridge call for each of the ~20
 * FadeInUp instances on a single screen.
 */

let cached = false;
let subscribed = false;
const listeners = new Set<(value: boolean) => void>();

function publish(value: boolean) {
  cached = value;
  listeners.forEach((listener) => listener(value));
}

function ensureSubscription() {
  if (subscribed) return;
  subscribed = true;
  // A failure here just means we stay on the default (motion allowed), which is
  // the same behaviour the app had before this existed.
  AccessibilityInfo.isReduceMotionEnabled().then(publish).catch(() => undefined);
  AccessibilityInfo.addEventListener('reduceMotionChanged', publish);
}

export function useReducedMotion(): boolean {
  const [reduced, setReduced] = useState(cached);

  useEffect(() => {
    ensureSubscription();
    listeners.add(setReduced);
    // Adopt whatever the shared subscription already resolved to; a component
    // mounting after the first read would otherwise sit on the stale default.
    setReduced(cached);
    return () => {
      listeners.delete(setReduced);
    };
  }, []);

  return reduced;
}
