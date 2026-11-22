import { useEffect } from 'react';
import { DeviceMotion } from 'expo-sensors';
import { SharedValue, useSharedValue } from 'react-native-reanimated';

/**
 * Phone tilt as two shared values in -1..1, smoothed, for parallax.
 *
 * The rest position is whatever angle the phone is held at, re-centred slowly,
 * so the sky sits still in the hand and only moves when the hand moves. With
 * reduced motion on, it stays at zero.
 */
export function useTilt(enabled: boolean): { x: SharedValue<number>; y: SharedValue<number> } {
  const x = useSharedValue(0);
  const y = useSharedValue(0);

  useEffect(() => {
    if (!enabled) {
      x.value = 0;
      y.value = 0;
      return;
    }
    let restB: number | null = null;
    let restG: number | null = null;
    DeviceMotion.setUpdateInterval(33);
    const sub = DeviceMotion.addListener(({ rotation }) => {
      if (!rotation) return;
      const b = rotation.beta ?? 0;
      const g = rotation.gamma ?? 0;
      restB = restB === null ? b : restB + (b - restB) * 0.01;
      restG = restG === null ? g : restG + (g - restG) * 0.01;
      const tx = Math.max(-1, Math.min(1, (g - restG) / 0.5));
      const ty = Math.max(-1, Math.min(1, (b - restB) / 0.5));
      x.value += (tx - x.value) * 0.18;
      y.value += (ty - y.value) * 0.18;
    });
    return () => sub.remove();
  }, [enabled, x, y]);

  return { x, y };
}
