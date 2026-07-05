import { useEffect, useRef, useState } from 'react';
import * as Location from 'expo-location';
import { supabase } from '../services/supabase';
import { PartnerLocation } from '../types';
import {
  Coords,
  getCurrentCoords,
  requestForegroundLocationPermission,
  reverseGeocode,
} from '../services/locationService';

/**
 * Couple location sharing.
 *
 * Publishing is foreground-only and opt-in: `shareOnce()` pushes a single
 * position, and `setLive(true)` keeps the row fresh via watchPositionAsync
 * while the screen is mounted. Both partners' latest rows are kept in sync
 * over Supabase Realtime. This deliberately avoids background tracking, which
 * is unreliable on the aggressively battery-managed target devices.
 */
export function useLocation(coupleId: string | null, userId: string | null) {
  const [myLocation, setMyLocation] = useState<PartnerLocation | null>(null);
  const [partnerLocation, setPartnerLocation] = useState<PartnerLocation | null>(null);
  const [busy, setBusy] = useState(false);
  const [isLive, setIsLive] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  const watchRef = useRef<Location.LocationSubscription | null>(null);

  const fetchLocations = async () => {
    if (!coupleId) return;
    const { data, error } = await supabase
      .from('locations')
      .select('*')
      .eq('couple_id', coupleId);

    if (error) {
      console.error('[Location] Fetch failed:', error);
      return;
    }
    const rows = (data || []) as PartnerLocation[];
    setMyLocation(rows.find((r) => r.user_id === userId) || null);
    setPartnerLocation(rows.find((r) => r.user_id !== userId) || null);
  };

  useEffect(() => {
    fetchLocations();
    if (!coupleId) return;

    const channel = supabase
      .channel(`location-sync:${coupleId}`)
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'locations', filter: `couple_id=eq.${coupleId}` },
        () => fetchLocations()
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [coupleId, userId]);

  // Tear down any active watch when the hook unmounts / couple changes.
  useEffect(() => {
    return () => {
      watchRef.current?.remove();
      watchRef.current = null;
    };
  }, [coupleId]);

  /** Upsert a fresh coordinate as this user's single location row. */
  const publish = async (coords: Coords) => {
    if (!coupleId || !userId) return;
    const place_label = await reverseGeocode(coords.latitude, coords.longitude);
    const payload = {
      user_id: userId,
      couple_id: coupleId,
      latitude: coords.latitude,
      longitude: coords.longitude,
      accuracy: coords.accuracy,
      place_label,
      updated_at: new Date().toISOString(),
    };
    const { error } = await supabase.from('locations').upsert(payload, { onConflict: 'user_id' });
    if (error) {
      console.error('[Location] Publish failed:', error);
      setErrorMessage('Could not save your location. Check your connection.');
      return;
    }
    setMyLocation(payload as PartnerLocation);
  };

  /** One-shot: request permission if needed, read GPS, and publish once. */
  const shareOnce = async (): Promise<boolean> => {
    if (busy) return false;
    setBusy(true);
    setErrorMessage(null);
    try {
      const granted = await requestForegroundLocationPermission();
      if (!granted) {
        setErrorMessage('Location permission is off. Enable it in Settings to share your spot.');
        return false;
      }
      const coords = await getCurrentCoords();
      await publish(coords);
      return true;
    } catch (e: any) {
      console.error('[Location] shareOnce failed:', e);
      setErrorMessage('Could not read your location. Make sure GPS is on and try again.');
      return false;
    } finally {
      setBusy(false);
    }
  };

  /** Toggle live sharing: keeps the row fresh while the screen is open. */
  const setLive = async (enabled: boolean): Promise<void> => {
    if (!enabled) {
      watchRef.current?.remove();
      watchRef.current = null;
      setIsLive(false);
      return;
    }

    setErrorMessage(null);
    const granted = await requestForegroundLocationPermission();
    if (!granted) {
      setErrorMessage('Location permission is off. Enable it in Settings to share your spot.');
      return;
    }

    // Publish immediately, then keep updating on meaningful movement.
    try {
      await publish(await getCurrentCoords());
    } catch (e) {
      console.error('[Location] live initial read failed:', e);
    }

    watchRef.current?.remove();
    watchRef.current = await Location.watchPositionAsync(
      {
        accuracy: Location.Accuracy.Balanced,
        timeInterval: 30000, // at most every 30s
        distanceInterval: 50, // ...or after moving 50m
      },
      (position) => {
        publish({
          latitude: position.coords.latitude,
          longitude: position.coords.longitude,
          accuracy: position.coords.accuracy ?? null,
        });
      }
    );
    setIsLive(true);
  };

  /** Stop live sharing and remove this user's row so the partner sees nothing. */
  const stopSharing = async (): Promise<void> => {
    watchRef.current?.remove();
    watchRef.current = null;
    setIsLive(false);
    if (!userId) return;
    const { error } = await supabase.from('locations').delete().eq('user_id', userId);
    if (error) {
      console.error('[Location] stopSharing failed:', error);
      return;
    }
    setMyLocation(null);
  };

  return {
    myLocation,
    partnerLocation,
    busy,
    isLive,
    errorMessage,
    shareOnce,
    setLive,
    stopSharing,
    refresh: fetchLocations,
  };
}
