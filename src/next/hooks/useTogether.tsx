import React, { createContext, useCallback, useContext, useEffect, useRef, useState } from 'react';
import { AppState, Vibration } from 'react-native';
import { supabase } from '../../services/supabase';
import { CH, notify } from '../notify/notify';

/**
 * Live presence between the two phones: is my partner here right now, are they
 * holding their light, and did they just tap mine.
 *
 * One Supabase Realtime channel per couple, opened once at the app's root, so
 * it lives as long as the app does rather than only while the Sky tab shows.
 * Nothing is stored in a table.
 *
 * Everything rides Broadcast. Presence was tried first and measured against
 * the live server with two simulated phones (see docs/NEXT.md, "Realtime"). It
 * failed three ways: it rate-limits per client, and a burst of three updates
 * closes the channel outright; it lags about 1.4 s; and after a few
 * re-announcements the other phone's copy keeps phantom entries that never
 * leave, so a partner could look "here" forever. Broadcast arrives in about
 * 60 ms and has none of those problems, so:
 *
 *  - Here and away. Opening the app says "hello" and the other phone, if
 *    open, answers "here". While open, each phone says "here" every 10 s.
 *    Leaving the foreground says "away" at once. A partner who goes quiet for
 *    25 s (dead phone, no signal) is shown as away.
 *  - Holding. A held light says so at once and repeats every 1.5 s. A hold
 *    not heard from for 4.5 s has ended, however it ended, so nobody is left
 *    looking at a stuck hold.
 *  - Nudges, capped at one every 0.8 s so a frantic tapper doesn't buzz their
 *    partner's phone non-stop.
 *  - If the server closes the channel, it's rebuilt after a short back-off.
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

export const HOLD_BEAT_MS = 1500;
export const HOLD_STALE_MS = 4500;
export const HERE_BEAT_MS = 10_000;
export const HERE_STALE_MS = 25_000;
const NUDGE_GAP_MS = 800;
const REJOIN_MS = 2000;

const Ctx = createContext<TogetherState | null>(null);

export function TogetherProvider({
  coupleId,
  userId,
  partnerName,
  children,
}: {
  coupleId: string;
  userId: string;
  partnerName: string;
  children: React.ReactNode;
}) {
  const [partnerHere, setPartnerHere] = useState(false);
  const [partnerHolding, setPartnerHolding] = useState(false);
  const [nudgeCount, setNudgeCount] = useState(0);
  const [holding, setHoldingState] = useState(false);
  const [connected, setConnected] = useState(false);
  const [generation, setGeneration] = useState(0);

  const channelRef = useRef<ReturnType<typeof supabase.channel> | null>(null);
  const joinedRef = useRef(false);
  const activeRef = useRef(AppState.currentState === 'active');
  const holdingRef = useRef(false);
  const beatRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const partnerHoldAt = useRef(0);
  const lastNudgeSent = useRef(0);
  const nameRef = useRef(partnerName);
  nameRef.current = partnerName;

  const partnerSeenAt = useRef(0);

  const say = useCallback(
    (event: 'hello' | 'here' | 'away') => {
      channelRef.current?.send({ type: 'broadcast', event, payload: { from: userId } }).catch(() => undefined);
    },
    [userId]
  );

  const sendHold = useCallback(
    (on: boolean) => {
      channelRef.current?.send({ type: 'broadcast', event: 'hold', payload: { from: userId, on } }).catch(() => undefined);
    },
    [userId]
  );

  const setHolding = useCallback(
    (on: boolean) => {
      // Compared against the ref, not state: a press released in the same
      // frame it started would otherwise read a stale "not holding" and never
      // let go.
      if (holdingRef.current === on) return;
      holdingRef.current = on;
      setHoldingState(on);
      if (beatRef.current) {
        clearInterval(beatRef.current);
        beatRef.current = null;
      }
      sendHold(on);
      if (on) beatRef.current = setInterval(() => sendHold(true), HOLD_BEAT_MS);
    },
    [sendHold]
  );

  useEffect(() => {
    let disposed = false;
    let channel: ReturnType<typeof supabase.channel> | null = null;
    let sweep: ReturnType<typeof setInterval> | null = null;

    // supabase.channel() hands back any existing channel with the same topic,
    // and removing one is asynchronous and drops every channel with that
    // topic. So a rebuild must wait for the old one to be fully gone, or the
    // new channel is torn down by the old one's cleanup.
    const topic = `realtime:together:${coupleId}`;
    const stale = supabase.getChannels().filter((c) => c.topic === topic);
    Promise.all(stale.map((c) => supabase.removeChannel(c).catch(() => undefined))).then(() => {
      if (disposed) return;
      channel = open();
    });

    function open() {
      const ch = supabase.channel(`together:${coupleId}`, {
        config: { broadcast: { self: false } },
      });
      channelRef.current = ch;

      // Staleness is judged by when a message arrived here, never by the
      // sender's clock, which needn't agree with this phone's.
      const seen = () => {
        partnerSeenAt.current = Date.now();
        setPartnerHere(true);
      };
      const gone = () => {
        partnerSeenAt.current = 0;
        partnerHoldAt.current = 0;
        setPartnerHere(false);
        setPartnerHolding(false);
      };

      ch
        .on('broadcast', { event: 'hello' }, () => {
          seen();
          if (activeRef.current) say('here');
        })
        .on('broadcast', { event: 'here' }, seen)
        .on('broadcast', { event: 'away' }, gone)
        .on('broadcast', { event: 'hold' }, ({ payload }) => {
          seen();
          partnerHoldAt.current = payload?.on ? Date.now() : 0;
          setPartnerHolding(!!payload?.on);
        })
        .on('broadcast', { event: 'nudge' }, () => {
          seen();
          setNudgeCount((n) => n + 1);
          Vibration.vibrate([0, 30, 110, 30]);
          if (!activeRef.current) {
            notify({
              channel: CH.partner,
              title: `${nameRef.current} is thinking of you`,
              body: 'Tap their light to send one back.',
              trigger: null,
              key: `nudge:${Date.now()}`,
            }).catch(() => undefined);
          }
        })
        .subscribe((status) => {
          if (disposed) return;
          if (status === 'SUBSCRIBED') {
            joinedRef.current = true;
            setConnected(true);
            if (activeRef.current) say('hello');
            if (holdingRef.current) sendHold(true);
          } else if (status === 'CLOSED' || status === 'CHANNEL_ERROR' || status === 'TIMED_OUT') {
            joinedRef.current = false;
            setConnected(false);
            // Rebuild rather than hoping the client rejoins on its own; a
            // server-side close (e.g. a rate limit) is not always retried.
            setTimeout(() => !disposed && setGeneration((g) => g + 1), REJOIN_MS);
          }
        });

      // A hold not heard from in a while has ended, and a partner not heard
      // from in a while has gone, however either happened.
      sweep = setInterval(() => {
        const now = Date.now();
        if (partnerHoldAt.current && now - partnerHoldAt.current > HOLD_STALE_MS) {
          partnerHoldAt.current = 0;
          setPartnerHolding(false);
        }
        if (partnerSeenAt.current && now - partnerSeenAt.current > HERE_STALE_MS) gone();
      }, 500);
      return ch;
    }

    return () => {
      disposed = true;
      if (sweep) clearInterval(sweep);
      joinedRef.current = false;
      channelRef.current = null;
      setConnected(false);
      setPartnerHere(false);
      setPartnerHolding(false);
      if (channel) supabase.removeChannel(channel).catch(() => undefined);
    };
  }, [coupleId, userId, generation, say, sendHold]);

  // Foreground means "here"; leaving the foreground lets go of any hold.
  useEffect(() => {
    const sub = AppState.addEventListener('change', (s) => {
      const active = s === 'active';
      if (active === activeRef.current) return;
      activeRef.current = active;
      if (active) {
        say('hello');
      } else {
        setHolding(false);
        say('away');
      }
    });
    // While in the foreground, a quiet "still here" every 10 s.
    const beat = setInterval(() => activeRef.current && joinedRef.current && say('here'), HERE_BEAT_MS);
    return () => {
      sub.remove();
      clearInterval(beat);
    };
  }, [setHolding, say]);

  useEffect(
    () => () => {
      if (beatRef.current) clearInterval(beatRef.current);
    },
    []
  );

  const sendNudge = useCallback(() => {
    if (Date.now() - lastNudgeSent.current < NUDGE_GAP_MS) return;
    lastNudgeSent.current = Date.now();
    channelRef.current?.send({ type: 'broadcast', event: 'nudge', payload: { from: userId, at: Date.now() } }).catch(() => undefined);
  }, [userId]);

  return (
    <Ctx.Provider value={{ partnerHere, partnerHolding, nudgeCount, holding, setHolding, sendNudge, connected }}>{children}</Ctx.Provider>
  );
}

export function useTogether(): TogetherState {
  const v = useContext(Ctx);
  if (!v) throw new Error('useTogether must be used inside <TogetherProvider>');
  return v;
}
