import { useEffect, useState } from 'react';
import { supabase } from '../services/supabase';
import { Complaint, ComplaintReply } from '../types';

export function useComplaints(coupleId: string | null, userId: string | null) {
  const [complaints, setComplaints] = useState<Complaint[]>([]);
  const [replies, setReplies] = useState<ComplaintReply[]>([]);
  const [loading, setLoading] = useState<boolean>(true);

  const fetchComplaints = async () => {
    if (!coupleId) return;
    const { data, error } = await supabase
      .from('complaints')
      .select('*')
      .eq('couple_id', coupleId)
      .order('created_at', { ascending: false });

    if (error) {
      console.error('[Complaints] Fetch error:', error);
    } else {
      setComplaints((data || []) as Complaint[]);
    }
  };

  const fetchReplies = async () => {
    if (!coupleId) return;
    const { data, error } = await supabase
      .from('complaint_replies')
      .select('*')
      .eq('couple_id', coupleId)
      .order('created_at', { ascending: true });

    if (error) {
      console.error('[Complaints] Reply fetch error:', error);
    } else {
      setReplies((data || []) as ComplaintReply[]);
    }
  };

  useEffect(() => {
    if (!coupleId) {
      setComplaints([]);
      setReplies([]);
      setLoading(false);
      return;
    }

    setLoading(true);
    Promise.all([fetchComplaints(), fetchReplies()]).finally(() => setLoading(false));

    const channel = supabase
      .channel(`complaints-sync:${coupleId}`)
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'complaints', filter: `couple_id=eq.${coupleId}` },
        () => fetchComplaints()
      )
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'complaint_replies', filter: `couple_id=eq.${coupleId}` },
        () => fetchReplies()
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [coupleId]);

  const addComplaint = async (title: string, body: string) => {
    if (!coupleId || !userId || !title.trim()) return null;

    const { data, error } = await supabase
      .from('complaints')
      .insert({
        couple_id: coupleId,
        created_by: userId,
        title: title.trim(),
        body: body.trim(),
        status: 'open',
      })
      .select('*')
      .single();

    if (error) {
      console.error('[Complaints] Add failed:', error);
      return null;
    }
    await fetchComplaints();
    return data as Complaint;
  };

  const addReply = async (complaintId: string, body: string) => {
    if (!coupleId || !userId || !body.trim()) return null;

    const { data, error } = await supabase
      .from('complaint_replies')
      .insert({
        complaint_id: complaintId,
        couple_id: coupleId,
        author_id: userId,
        body: body.trim(),
      })
      .select('*')
      .single();

    if (error) {
      console.error('[Complaints] Reply failed:', error);
      return null;
    }
    // Bump the parent so it re-sorts as recently active.
    await supabase.from('complaints').update({ updated_at: new Date().toISOString() }).eq('id', complaintId);
    await fetchReplies();
    return data as ComplaintReply;
  };

  const setStatus = async (complaintId: string, status: Complaint['status']) => {
    const { error } = await supabase
      .from('complaints')
      .update({ status, updated_at: new Date().toISOString() })
      .eq('id', complaintId);
    if (error) console.error('[Complaints] Status update failed:', error);
    else await fetchComplaints();
  };

  const deleteComplaint = async (complaintId: string) => {
    const { error } = await supabase.from('complaints').delete().eq('id', complaintId);
    if (error) console.error('[Complaints] Delete failed:', error);
    else await fetchComplaints();
  };

  const repliesFor = (complaintId: string) =>
    replies.filter((r) => r.complaint_id === complaintId);

  return {
    complaints,
    replies,
    loading,
    addComplaint,
    addReply,
    setStatus,
    deleteComplaint,
    repliesFor,
  };
}
