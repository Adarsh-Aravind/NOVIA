import { useEffect } from 'react';
import { SensorType, SharedValue, useAnimatedSensor, useFrameCallback, useSharedValue } from 'react-native-reanimated';

/**
 * Phone tilt as two shared values in -1..1, for parallax.
 *
 * Everything happens on the UI thread, once per display frame. The rotation
 * sensor is read by Reanimated natively, and the smoothing runs in a frame
 * callback, so on a 120 Hz screen the sky moves at 120 Hz. The first version
 * set these values from a JS sensor listener at 30 Hz, and the parallax
 * visibly stepped between readings.
 *
 * Smoothing is frame-rate independent (an exponential approach with a 0.12 s
 * time constant), and the rest position re-centres over about 6 s, so the sky
 * sits still in the hand at whatever angle the phone is held and moves only
 * when the hand does. With reduced motion on, it stays at zero and the
 * callback doesn't run.
 */
export function useTilt(enabled: boolean): { x: SharedValue<number>; y: SharedValue<number> } {
  const x = useSharedValue(0);
  const y = useSharedValue(0);
  const restPitch = useSharedValue(NaN);
  const restRoll = useSharedValue(NaN);
  const sensor = useAnimatedSensor(SensorType.ROTATION, { interval: 'auto' });

  const frame = useFrameCallback((info) => {
    'worklet';
    const dt = Math.min((info.timeSincePreviousFrame ?? 16) / 1000, 0.1);
    const { pitch, roll } = sensor.sensor.value;
    if (Number.isNaN(restPitch.value)) {
      restPitch.value = pitch;
      restRoll.value = roll;
    }
    const recentre = 1 - Math.exp(-dt / 6);
    restPitch.value += (pitch - restPitch.value) * recentre;
    restRoll.value += (roll - restRoll.value) * recentre;
    const tx = Math.max(-1, Math.min(1, (roll - restRoll.value) / 0.5));
    const ty = Math.max(-1, Math.min(1, (pitch - restPitch.value) / 0.5));
    const k = 1 - Math.exp(-dt / 0.12);
    x.value += (tx - x.value) * k;
    y.value += (ty - y.value) * k;
  }, false);

  useEffect(() => {
    frame.setActive(enabled);
    if (!enabled) {
      x.value = 0;
      y.value = 0;
      restPitch.value = NaN;
      restRoll.value = NaN;
    }
    return () => frame.setActive(false);
  }, [enabled, frame, x, y, restPitch, restRoll]);

  return { x, y };
}
