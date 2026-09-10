import { useEffect, useState } from 'react';
import { supabase } from '../services/supabase';
import { PeriodRecord } from '../types';
import { calculateCyclePredictions, CyclePrediction } from '../utils/cycleMath';

export function usePeriods(coupleId: string | null) {
  const [records, setRecords] = useState<PeriodRecord[]>([]);
  const [predictions, setPredictions] = useState<CyclePrediction | null>(null);
  const [loading, setLoading] = useState<boolean>(true);

  const fetchPeriodLogs = async () => {
    if (!coupleId) {
      // Returning before the finally block left `loading` stuck true forever for
      // an unpaired user — a spinner that could never resolve.
      setRecords([]);
      setPredictions(null);
      setLoading(false);
      return;
    }
    setLoading(true);
    try {
      const { data, error } = await supabase
        .from('periods')
        .select('*')
        .eq('couple_id', coupleId)
        .order('start_date', { ascending: false });

      if (error) throw error;
      if (data) {
        setRecords(data);
        const preds = calculateCyclePredictions(data);
        setPredictions(preds);
      }
    } catch (e) {
      console.error('[Periods Hook] Fetch error:', e);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchPeriodLogs();

    if (!coupleId) return;

    // Listen for realtime cycles table updates
    const channel = supabase
      .channel(`periods-sync:${coupleId}`)
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'periods', filter: `couple_id=eq.${coupleId}` },
        () => fetchPeriodLogs()
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [coupleId]);

  /**
   * Log a cycle start. Returns whether it actually landed — the caller shows a
   * confirmation, and swallowing the error here made a failed insert look
   * saved: the alert said "logged and predicted instantly" while nothing had
   * been written and the predictions never moved.
   */
  const addPeriodLog = async (
    startDate: string,
    endDate: string | null,
    symptoms: string[],
    notes: string | null
  ): Promise<boolean> => {
    if (!coupleId) return false;

    const { error } = await supabase.from('periods').insert({
      couple_id: coupleId,
      start_date: startDate,
      end_date: endDate,
      symptoms,
      notes,
      created_at: new Date().toISOString(),
    });

    if (error) {
      console.error('[Periods Hook] Insert failed:', error);
      return false;
    }
    return true;
  };

  return {
    records,
    predictions,
    loading,
    addPeriodLog,
    refreshPeriods: fetchPeriodLogs,
  };
}
