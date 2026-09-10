/**
 * NOVIA motion tokens.
 *
 * Apple's fluid-interface model expressed in the two parameters a designer
 * actually reasons about, converted once here into the (mass, stiffness,
 * damping) triple React Native's `Animated.spring` wants:
 *
 *   dampingRatio ζ — overshoot. 1.0 settles without bounce; below 1 oscillates.
 *   response     τ — seconds to substantially reach the target. This is NOT a
 *                    duration: a spring has no fixed duration, its settle time
 *                    emerges from the parameters.
 *
 *   ω          = 2π / τ                     (natural frequency, rad/s)
 *   stiffness  = ω² · m
 *   damping    = 2 · ζ · √(stiffness · m)  = 2 · ζ · ω · m
 *
 * Why springs rather than `Animated.timing` for anything a finger can touch: a
 * spring animates from wherever the value currently *is*, so it can be
 * re-targeted mid-flight and the motion stays continuous. A fixed-duration
 * easing curve cannot — re-targeting restarts it from the head of the curve,
 * which is the visible snap you get when the user grabs something already in
 * motion. Timing is still right for one-shot entrances nobody can interrupt.
 *
 * Bounce is earned, not decorative. Give a spring ζ < 1 only when the gesture
 * that triggered it carried momentum (a flick, a drag release). Overshoot on a
 * panel that merely faded in reads as noise.
 */

export interface SpringConfig {
  mass: number;
  stiffness: number;
  damping: number;
}

function spring(dampingRatio: number, response: number, mass = 1): SpringConfig {
  const omega = (2 * Math.PI) / response;
  return {
    mass,
    stiffness: Math.round(omega * omega * mass),
    // Two decimals is well below the resolution of anything you can perceive,
    // and keeps the numbers readable when logged.
    damping: Math.round(2 * dampingRatio * omega * mass * 100) / 100,
  };
}

export const SPRING = {
  /** Button press in/out. Snappy and dead-flat — a press carries no momentum. */
  press: spring(1.0, 0.18),
  /** Tap-driven repositioning: the tab indicator, selection chips. */
  snap: spring(1.0, 0.3),
  /** Values the user watches rather than drives: progress bars, meters. */
  move: spring(1.0, 0.4),
  /** Sheets and drawers. Apple ships ζ 0.8 / τ 0.3 for exactly this. */
  sheet: spring(0.8, 0.3),
  /** Anything released from a gesture with real velocity behind it. */
  flick: spring(0.8, 0.4),
} as const;

/**
 * Where a flick would come to rest, given its release velocity.
 *
 * This is UIScrollView's deceleration model (Apple's *Designing Fluid
 * Interfaces* sample code), not the textbook v²/2a — the textbook form
 * undershoots badly at low velocity and makes a light flick feel sticky.
 *
 * Project first, *then* pick the snap target nearest the projection. Snapping
 * from the release point instead is what makes a drawer feel like it ignores
 * how hard you threw it.
 *
 * `velocity` is px/s. NOTE: React Native's PanResponder reports `vx`/`vy` in
 * px/ms, so multiply by 1000 before calling this.
 */
export function projectMomentum(velocity: number, decelerationRate = 0.998): number {
  return ((velocity / 1000) * decelerationRate) / (1 - decelerationRate);
}
