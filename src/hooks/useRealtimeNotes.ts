import { useCallback, useEffect, useState, useRef } from 'react';
import { Alert } from 'react-native';
import { supabase } from '../services/supabase';
import { SharedNote } from '../types';

/** Don't re-broadcast "still typing" more often than this. */
const TYPING_PING_MS = 2000;
/**
 * Clear the partner's typing banner this long after their last ping.
 *
 * Broadcast is fire-and-forget: a "stopped typing" message can be dropped, and
 * a partner who backgrounds the app mid-word never sends one at all. Without an
 * expiry the banner latches on until the screen unmounts.
 */
const TYPING_TTL_MS = 5000;

export function useRealtimeNotes(coupleId: string | null, userId: string | null) {
  const [notes, setNotes] = useState<SharedNote[]>([]);
  const [isPartnerTyping, setIsPartnerTyping] = useState<boolean>(false);
  const channelRef = useRef<any>(null);
  const typingExpiry = useRef<ReturnType<typeof setTimeout> | null>(null);
  const lastTypingPing = useRef<number>(0);

  const fetchNotes = async () => {
    if (!coupleId) return;

    const { data, error } = await supabase
      .from('notes')
      .select('*')
      .eq('couple_id', coupleId)
      .order('updated_at', { ascending: false });

    if (error) {
      console.error('[Notes Sync] Fetch failed:', error);
      return;
    }

    setNotes((data || []) as SharedNote[]);
  };

  useEffect(() => {
    if (!coupleId || !userId) return;

    fetchNotes();

    // 2. Setup channel for broadcasts and Postgres change listeners
    channelRef.current = supabase
      .channel(`notes-sync:${coupleId}`)
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'notes',
          filter: `couple_id=eq.${coupleId}`,
        },
        () => fetchNotes()
      )
      .on('broadcast', { event: 'typing' }, ({ payload }) => {
        if (payload.userId === userId) return;
        setIsPartnerTyping(!!payload.isTyping);

        if (typingExpiry.current) clearTimeout(typingExpiry.current);
        if (payload.isTyping) {
          typingExpiry.current = setTimeout(() => setIsPartnerTyping(false), TYPING_TTL_MS);
        }
      })
      .on('broadcast', { event: 'notes_updated' }, () => {
        fetchNotes();
      })
      .subscribe();

    return () => {
      if (typingExpiry.current) clearTimeout(typingExpiry.current);
      setIsPartnerTyping(false);
      if (channelRef.current) supabase.removeChannel(channelRef.current);
    };
  }, [coupleId, userId]);

  /**
   * Tell the partner whether we're composing a note.
   *
   * The 'typing' listener above shipped with nothing anywhere in the app that
   * ever sent this event, so "Companion is active in shared notes..." could
   * never appear. Call it from the composer's onChangeText (true) and from
   * blur/send (false).
   */
  const setTyping = useCallback(
    (isTyping: boolean) => {
      const channel = channelRef.current;
      // send() otherwise falls back to a deprecated REST post — pointless for an
      // ephemeral keystroke ping.
      if (!channel || !userId || String(channel.state) !== 'joined') return;

      if (isTyping) {
        // Throttle the keystroke stream; the receiver's TTL keeps the banner up
        // between pings.
        const now = Date.now();
        if (now - lastTypingPing.current < TYPING_PING_MS) return;
        lastTypingPing.current = now;
      } else {
        // Always let a "stopped" through, and re-arm the throttle.
        lastTypingPing.current = 0;
      }

      channel.send({ type: 'broadcast', event: 'typing', payload: { userId, isTyping } });
    },
    [userId]
  );

  const addNote = async (content: string): Promise<boolean> => {
    if (!coupleId || !userId) return false;
    const trimmed = content.trim();
    if (!trimmed) return false;

    const payload = {
      couple_id: coupleId,
      content: trimmed,
      created_by: userId,
      updated_by: userId,
      updated_at: new Date().toISOString(),
    };

    const { error } = await supabase.from('notes').insert(payload);
    if (!error) {
      if (channelRef.current) {
        channelRef.current.send({
          type: 'broadcast',
          event: 'notes_updated',
          payload: {}
        });
      }
      await fetchNotes();
      return true;
    }

    const legacyPayload = {
      couple_id: coupleId,
      content: trimmed,
      updated_by: userId,
      updated_at: new Date().toISOString(),
    };

    // If table lacks created_by column, use legacy insert
    if (error.code === 'PGRST204' && error.message.includes('created_by')) {
      const { error: fallbackError } = await supabase.from('notes').insert(legacyPayload);
      if (fallbackError) {
        console.error('[Notes Sync] Legacy insert failed:', fallbackError);
        if (fallbackError.code === '23505') {
          Alert.alert(
            "Note Limit Exceeded",
            "Only one note is currently allowed per couple due to a duplicate constraint (notes_couple_id_key) in your database.\n\nTo enable a grid of multiple notes, run this command in your Supabase SQL Editor:\n\nALTER TABLE public.notes DROP CONSTRAINT IF EXISTS notes_couple_id_key;"
          );
        } else {
          Alert.alert("Failed to Add Note", fallbackError.message || "An unexpected database error occurred.");
        }
        return false;
      } else {
        if (channelRef.current) {
          channelRef.current.send({
            type: 'broadcast',
            event: 'notes_updated',
            payload: {}
          });
        }
        await fetchNotes();
        return true;
      }
    }

    console.error('[Notes Sync] Insert failed:', error);
    if (error.code === '23505') {
      Alert.alert(
        "Note Limit Exceeded",
        "Only one note is currently allowed per couple due to a duplicate constraint (notes_couple_id_key) in your database.\n\nTo enable a grid of multiple notes, run this command in your Supabase SQL Editor:\n\nALTER TABLE public.notes DROP CONSTRAINT IF EXISTS notes_couple_id_key;"
      );
    } else {
      Alert.alert("Failed to Add Note", error.message || "An unexpected database error occurred.");
    }
    return false;
  };

  // Toggle the current user's emoji reaction on a note. Reactions live in a
  // JSONB map (userId -> emoji) on the note row, so they ride the existing
  // notes realtime/refresh path — no extra table or subscription. Tapping the
  // emoji you already picked clears it; a different emoji replaces yours.
  // We never touch updated_at, so reacting doesn't reorder the note grid.
  const toggleReaction = async (note: SharedNote, emoji: string) => {
    if (!userId) return;

    const next = { ...(note.reactions || {}) };
    if (next[userId] === emoji) delete next[userId];
    else next[userId] = emoji;

    // Optimistic — reflect the tap instantly.
    setNotes((prev) => prev.map((n) => (n.id === note.id ? { ...n, reactions: next } : n)));

    // RLS on notes requires the updater to own updated_by; set it to us.
    const { error } = await supabase
      .from('notes')
      .update({ reactions: next, updated_by: userId })
      .eq('id', note.id);

    if (error) {
      // The reactions column is added by a one-time migration; guide the user
      // if it isn't there yet, then fall back to server truth.
      if (error.code === 'PGRST204' && error.message.includes('reactions')) {
        Alert.alert(
          'One-time setup needed',
          "To enable reactions on shared notes, run this in your Supabase SQL Editor:\n\nALTER TABLE public.notes ADD COLUMN IF NOT EXISTS reactions JSONB NOT NULL DEFAULT '{}'::jsonb;"
        );
      } else {
        console.error('[Notes Sync] Reaction failed:', error);
      }
      fetchNotes();
      return;
    }

    if (channelRef.current) {
      channelRef.current.send({ type: 'broadcast', event: 'notes_updated', payload: {} });
    }
  };

  const removeNote = async (noteId: string) => {
    // Optimistic UI state update
    setNotes(prev => prev.filter(note => note.id !== noteId));

    const { error } = await supabase.from('notes').delete().eq('id', noteId);
    if (error) {
      console.error('[Notes Sync] Delete failed:', error);
      // Re-fetch notes to restore actual database state in case of deletion failure
      fetchNotes();
    } else {
      if (channelRef.current) {
        channelRef.current.send({
          type: 'broadcast',
          event: 'notes_updated',
          payload: {}
        });
      }
    }
  };

  return {
    notes,
    isPartnerTyping,
    setTyping,
    addNote,
    removeNote,
    toggleReaction,
  };
}
