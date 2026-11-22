import { useRef } from 'react';
import type { RealtimeChannel } from '@supabase/supabase-js';
import { supabase } from './supabase';

/**
 * Realtime channel names, and why they matter.
 *
 * `supabase.channel(topic)` returns the *existing* channel when one with that
 * topic is already open, and adding a listener to an already-subscribed
 * channel throws ("cannot add `postgres_changes` callbacks ... after
 * `subscribe()`"). Removing a channel is asynchronous, and it drops every
 * channel with that topic when it finishes. So two hooks, or one hook
 * remounting quickly, can't share a fixed name. In a release build the throw
 * kills the app at startup: a blank screen.
 *
 * Two cases:
 *  - A channel that only listens to the database (postgres_changes) has no
 *    reason to share its name with anything, so give it a per-instance
 *    suffix (`useChannelSuffix`). It can then never collide.
 *  - A channel that carries broadcasts between the two phones must use the
 *    exact topic the partner uses. Open it with `openSharedChannel`, which
 *    first waits for any older channel on that topic to finish closing.
 */
export function useChannelSuffix(): string {
  const id = useRef<string | null>(null);
  if (!id.current) id.current = Math.random().toString(36).slice(2, 10);
  return id.current;
}

/**
 * Open a channel on a topic shared with the other phone. Any channel already
 * on that topic in this app is a leftover from a previous mount (only one
 * screen at a time uses each shared topic), so it is closed first, and the
 * new channel is created only once it has gone. `build` attaches listeners
 * and subscribes. Resolves to null if the caller was disposed meanwhile.
 */
export async function openSharedChannel(
  topic: string,
  build: (channel: RealtimeChannel) => void,
  isLive: () => boolean,
  config?: Parameters<typeof supabase.channel>[1]
): Promise<RealtimeChannel | null> {
  const full = `realtime:${topic}`;
  const leftovers = supabase.getChannels().filter((c) => c.topic === full);
  await Promise.all(leftovers.map((c) => supabase.removeChannel(c).catch(() => undefined)));
  if (!isLive()) return null;
  const channel = supabase.channel(topic, config);
  build(channel);
  return channel;
}
