import { useEffect, useState, useRef } from 'react';
import { Alert } from 'react-native';
import { supabase } from '../services/supabase';
import { SharedNote } from '../types';

export function useRealtimeNotes(coupleId: string | null, userId: string | null) {
  const [notes, setNotes] = useState<SharedNote[]>([]);
  const [isTyping, setIsTyping] = useState<boolean>(false);
  const [isPartnerTyping, setIsPartnerTyping] = useState<boolean>(false);
  const channelRef = useRef<any>(null);

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
        if (payload.userId !== userId) {
          setIsPartnerTyping(payload.isTyping);
        }
      })
      .on('broadcast', { event: 'notes_updated' }, () => {
        fetchNotes();
      })
      .subscribe();

    return () => {
      if (channelRef.current) supabase.removeChannel(channelRef.current);
    };
  }, [coupleId, userId]);

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
    isTyping,
    isPartnerTyping,
    addNote,
    removeNote,
  };
}
