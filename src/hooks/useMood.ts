import { useEffect, useState, useRef } from 'react';
import { supabase } from '../services/supabase';

export function useMood(coupleId: string | null, userId: string | null, initialPartnerMood = 'Neutral') {
  const [currentMood, setCurrentMood] = useState<string>('Neutral');
  const [partnerMood, setPartnerMood] = useState<string>(initialPartnerMood);
  const [partnerName, setPartnerName] = useState<string>('Companion');
  const channelRef = useRef<any>(null);

  useEffect(() => {
    if (!coupleId || !userId) return;

    // Fetch initial profile states
    const fetchMoods = async () => {
      // 1. Fetch own mood
      const { data: myData } = await supabase
        .from('profiles')
        .select('current_mood')
        .eq('id', userId)
        .single();
      if (myData) setCurrentMood(myData.current_mood);

      // 2. Fetch partner mood & display name
      const { data: partnerData } = await supabase
        .from('profiles')
        .select('current_mood, display_name')
        .eq('couple_id', coupleId)
        .neq('id', userId)
        .maybeSingle();

      if (partnerData) {
        setPartnerMood(partnerData.current_mood);
        setPartnerName(partnerData.display_name);
      }
    };

    fetchMoods();

    // Setup broadcast event listener
    channelRef.current = supabase
      .channel(`mood-sync:${coupleId}`, {
        config: { broadcast: { self: false } },
      })
      .on('broadcast', { event: 'mood_update' }, ({ payload }) => {
        setPartnerMood(payload.mood);
      })
      .subscribe();

    return () => {
      if (channelRef.current) supabase.removeChannel(channelRef.current);
    };
  }, [coupleId, userId]);

  // Broadcast and persist local mood updates
  const updateMood = async (mood: string) => {
    setCurrentMood(mood);
    if (!coupleId || !userId) return;

    // A. Broadcast instant update to partner
    channelRef.current?.send({
      type: 'broadcast',
      event: 'mood_update',
      payload: { mood },
    });

    // B. Save to profiles database
    const { error } = await supabase
      .from('profiles')
      .update({ current_mood: mood, mood_updated_at: new Date().toISOString() })
      .eq('id', userId);
      
    if (error) console.error('[Mood Sync] DB save failed:', error);
  };

  return {
    currentMood,
    partnerMood,
    partnerName,
    updateMood,
  };
}
