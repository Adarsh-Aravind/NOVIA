import AsyncStorage from '@react-native-async-storage/async-storage';
import React from 'react';

/**
 * What the home- and lock-screen widgets show, cached on the device.
 *
 * Widgets render in a headless JS task that can start while the app is closed,
 * so they read this cache rather than waiting on the network. The app writes
 * it whenever moods, names or the anniversary change, then asks Android to
 * redraw the widgets.
 */
export interface WidgetState {
  userId: string | null;
  coupleId: string | null;
  myName: string;
  partnerName: string;
  myMood: string;
  partnerMood: string;
  /** 'YYYY-MM-DD' of the day you got together, from your earliest yearly milestone. */
  togetherSince: string | null;
  togetherTitle: string | null;
  updatedAt: number;
}

const KEY = 'novia-next:widget-state';

export const EMPTY_WIDGET_STATE: WidgetState = {
  userId: null,
  coupleId: null,
  myName: 'You',
  partnerName: 'Your partner',
  myMood: 'Neutral',
  partnerMood: 'Neutral',
  togetherSince: null,
  togetherTitle: null,
  updatedAt: 0,
};

export async function readWidgetState(): Promise<WidgetState> {
  try {
    const raw = await AsyncStorage.getItem(KEY);
    return raw ? { ...EMPTY_WIDGET_STATE, ...JSON.parse(raw) } : EMPTY_WIDGET_STATE;
  } catch {
    return EMPTY_WIDGET_STATE;
  }
}

let last = '';

/** Merge into the cache and redraw every placed widget, if anything changed. */
export async function saveWidgetState(patch: Partial<WidgetState>): Promise<void> {
  const next = { ...(await readWidgetState()), ...patch };
  const { updatedAt: _u, ...comparable } = next;
  const sig = JSON.stringify(comparable);
  if (sig === last) return;
  last = sig;
  next.updatedAt = Date.now();
  await AsyncStorage.setItem(KEY, JSON.stringify(next));
  // Loaded lazily, and skipped if the native widget module isn't in this
  // build, so a missing module costs the widgets rather than the app.
  try {
    const { requestWidgetUpdate } = require('react-native-android-widget') as typeof import('react-native-android-widget');
    const { LightsWidget, DaysWidget } = require('./widgets') as typeof import('./widgets');
    await Promise.all([
      requestWidgetUpdate({ widgetName: 'NoviaLights', renderWidget: () => React.createElement(LightsWidget, { state: next }) }).catch(() => undefined),
      requestWidgetUpdate({ widgetName: 'NoviaDays', renderWidget: () => React.createElement(DaysWidget, { state: next }) }).catch(() => undefined),
    ]);
  } catch {
    // No widget module in this build.
  }
}
