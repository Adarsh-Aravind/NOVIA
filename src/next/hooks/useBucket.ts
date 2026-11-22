import { useCallback, useEffect, useState } from 'react';
import { supabase } from '../../services/supabase';
import { useChannelSuffix } from '../../services/realtime';

export interface BucketItem {
  id: string;
  title: string;
  description: string | null;
  is_completed: boolean;
  completed_at: string | null;
  completed_by: string | null;
  created_by: string | null;
  created_at: string;
}

/** The shared bucket list, live. Same table and writes as the current app. */
export function useBucket(coupleId: string | null, userId: string | null) {
  // Per-instance name: see services/realtime.ts.
  const channelSuffix = useChannelSuffix();
  const [items, setItems] = useState<BucketItem[]>([]);

  const load = useCallback(async () => {
    if (!coupleId) return;
    const { data, error } = await supabase
      .from('bucket_list')
      .select('*')
      .eq('couple_id', coupleId)
      .order('created_at', { ascending: false });
    if (!error) setItems((data as BucketItem[]) ?? []);
  }, [coupleId]);

  useEffect(() => {
    if (!coupleId) return;
    load();
    const ch = supabase
      .channel(`next-bucket:${coupleId}:${channelSuffix}`)
      .on('postgres_changes', { event: '*', schema: 'public', table: 'bucket_list', filter: `couple_id=eq.${coupleId}` }, load)
      .subscribe();
    return () => {
      supabase.removeChannel(ch);
    };
  }, [coupleId, load]);

  const add = async (title: string) => {
    if (!coupleId || !userId || !title.trim()) return;
    await supabase.from('bucket_list').insert({ couple_id: coupleId, category: 'learning', title: title.trim(), created_by: userId });
    load();
  };

  const toggle = async (item: BucketItem) => {
    const done = !item.is_completed;
    setItems((prev) => prev.map((i) => (i.id === item.id ? { ...i, is_completed: done } : i)));
    await supabase
      .from('bucket_list')
      .update({ is_completed: done, completed_at: done ? new Date().toISOString() : null, completed_by: done ? userId : null })
      .eq('id', item.id);
    load();
  };

  return { items, add, toggle };
}
