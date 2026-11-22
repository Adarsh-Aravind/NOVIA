import { useCallback, useEffect, useRef, useState } from 'react';
import { supabase } from '../../services/supabase';

/**
 * Live presence between the two phones: is my partner here right now, are they
 * holding their light, and did they just tap mine.
 *
 * Nothing here touches a table. It rides one Supabase Realtime channel per
 * couple: Presence carries the steady state (here, holding) and Broadcast the
 * one-off events (a nudge). If the partner is on the old app, or offline, the
 * channel is simply quiet and every screen reads that as "not here".
 */
export interface TogetherState {
  partnerHere: boolean;
  partnerHolding: boolean;
  /** Increments each time a nudge arrives, so a screen can react to it. */
  nudgeCount: number;
  /** Whether my own light is being held. */
  holding: boolean;
  setHolding: (on: boolean) => void;
  sendNudge: () => void;
  connected: boolean;
}

type Meta = { user: string; holding: boolean; at: number };

export function useTogether(coupleId: string | null, userId: string | null): TogetherState {
  const [partnerHere, setPartnerHere] = useState(false);
  const [partnerHolding, setPartnerHolding] = useState(false);
  const [nudgeCount, setNudgeCount] = useState(0);
  const [holding, setHoldingState] = useState(false);
  const [connected, setConnected] = useState(false);
  const channelRef = useRef<ReturnType<typeof supabase.channel> | null>(null);
  const holdingRef = useRef(false);

  useEffect(() => {
    if (!coupleId || !userId) return;

    const channel = supabase.channel(`together:${coupleId}`, {
      config: { presence: { key: userId }, broadcast: { self: false } },
    });
    channelRef.current = channel;

    const readPresence = () => {
      const state = channel.presenceState<Meta>();
      const others = Object.entries(state)
        .filter(([key]) => key !== userId)
        .flatMap(([, metas]) => metas);
      setPartnerHere(others.length > 0);
      setPartnerHolding(others.some((m) => m.holding));
    };

    channel
      .on('presence', { event: 'sync' }, readPresence)
      .on('presence', { event: 'join' }, readPresence)
      .on('presence', { event: 'leave' }, readPresence)
      .on('broadcast', { event: 'nudge' }, () => setNudgeCount((n) => n + 1))
      .subscribe(async (status) => {
        if (status === 'SUBSCRIBED') {
          setConnected(true);
          await channel.track({ user: userId, holding: holdingRef.current, at: Date.now() });
        } else if (status === 'CLOSED' || status === 'CHANNEL_ERROR' || status === 'TIMED_OUT') {
          setConnected(false);
        }
      });

    return () => {
      channelRef.current = null;
      setConnected(false);
      setPartnerHere(false);
      setPartnerHolding(false);
      supabase.removeChannel(channel);
    };
  }, [coupleId, userId]);

  const setHolding = useCallback(
    (on: boolean) => {
      if (holdingRef.current === on) return;
      holdingRef.current = on;
      setHoldingState(on);
      channelRef.current?.track({ user: userId, holding: on, at: Date.now() });
    },
    [userId]
  );

  const sendNudge = useCallback(() => {
    channelRef.current?.send({ type: 'broadcast', event: 'nudge', payload: { from: userId, at: Date.now() } });
  }, [userId]);

  return { partnerHere, partnerHolding, nudgeCount, holding, setHolding, sendNudge, connected };
}
