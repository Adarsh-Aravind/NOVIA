import React from 'react';
import type { WidgetTaskHandlerProps } from 'react-native-android-widget';
import { readWidgetState } from './state';
import { DaysWidget, LightsWidget } from './widgets';

/**
 * Runs headless whenever Android asks a widget to draw, or one is tapped.
 * Registered in index.ts. It may start with the app closed, so everything it
 * needs comes from the cached state.
 */
export async function widgetTaskHandler({ widgetInfo, widgetAction, clickAction, renderWidget }: WidgetTaskHandlerProps) {
  const state = await readWidgetState();
  const draw = () =>
    renderWidget(widgetInfo.widgetName === 'NoviaDays' ? <DaysWidget state={state} /> : <LightsWidget state={state} />);

  switch (widgetAction) {
    case 'WIDGET_ADDED':
    case 'WIDGET_UPDATE':
    case 'WIDGET_RESIZED':
      draw();
      break;
    case 'WIDGET_CLICK':
      if (clickAction === 'NUDGE') await sendNudge(state.coupleId, state.userId);
      draw();
      break;
    default:
      break;
  }
}

/**
 * The same broadcast the Sky screen sends. Your partner feels it if NOVIA Next
 * is open on their phone; reaching a closed app needs push, which isn't built.
 */
async function sendNudge(coupleId: string | null, userId: string | null) {
  if (!coupleId || !userId) return;
  const { supabase } = require('../../services/supabase') as typeof import('../../services/supabase');
  // If the app is running, its TogetherProvider already has this channel
  // open. Send on it and leave it alone: closing it would take the app's
  // presence down with it.
  // supabase.channel() would hand back that same object for this topic anyway.
  const open = supabase.getChannels().find((c) => c.topic === `realtime:together:${coupleId}`);
  if (open) {
    await open.send({ type: 'broadcast', event: 'nudge', payload: { from: userId, at: Date.now(), via: 'widget' } });
    return;
  }
  const channel = supabase.channel(`together:${coupleId}`, { config: { broadcast: { self: false } } });
  try {
    await new Promise<void>((resolve) => {
      const timer = setTimeout(resolve, 5000);
      channel.subscribe((status) => {
        if (status === 'SUBSCRIBED') {
          clearTimeout(timer);
          resolve();
        }
      });
    });
    await channel.send({ type: 'broadcast', event: 'nudge', payload: { from: userId, at: Date.now(), via: 'widget' } });
  } finally {
    supabase.removeChannel(channel);
  }
}
