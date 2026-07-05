import * as Location from 'expo-location';
import { Platform } from 'react-native';

export interface Coords {
  latitude: number;
  longitude: number;
  accuracy: number | null;
}

/**
 * Ask for foreground ("while in use") location permission.
 * Returns true only when the user granted access.
 */
export async function requestForegroundLocationPermission(): Promise<boolean> {
  const { status } = await Location.requestForegroundPermissionsAsync();
  return status === 'granted';
}

/**
 * Read the device's current position. Balanced accuracy (~100m) keeps the GPS
 * warm-up quick and is plenty for "where is my partner" — we don't need
 * navigation-grade precision and it saves battery on the aggressive OEM devices.
 */
export async function getCurrentCoords(): Promise<Coords> {
  const position = await Location.getCurrentPositionAsync({
    accuracy: Location.Accuracy.Balanced,
  });
  return {
    latitude: position.coords.latitude,
    longitude: position.coords.longitude,
    accuracy: position.coords.accuracy ?? null,
  };
}

/**
 * Best-effort reverse geocode to a short human label (e.g. "MG Road, Bengaluru").
 * Returns null if unavailable — never throws, so a callsite can treat the label
 * as purely optional garnish over the raw coordinates.
 */
export async function reverseGeocode(latitude: number, longitude: number): Promise<string | null> {
  try {
    const results = await Location.reverseGeocodeAsync({ latitude, longitude });
    const place = results[0];
    if (!place) return null;
    const parts = [place.name || place.street, place.city || place.subregion, place.region]
      .filter(Boolean);
    // De-dupe consecutive identical parts (name/street often collapse together).
    const label = parts.filter((part, i) => part !== parts[i - 1]).join(', ');
    return label || null;
  } catch {
    return null;
  }
}

const EARTH_RADIUS_M = 6371000;
const toRad = (deg: number) => (deg * Math.PI) / 180;

/** Great-circle distance between two coordinates, in metres (haversine). */
export function haversineMeters(a: Coords, b: Coords): number {
  const dLat = toRad(b.latitude - a.latitude);
  const dLon = toRad(b.longitude - a.longitude);
  const lat1 = toRad(a.latitude);
  const lat2 = toRad(b.latitude);
  const h =
    Math.sin(dLat / 2) ** 2 +
    Math.sin(dLon / 2) ** 2 * Math.cos(lat1) * Math.cos(lat2);
  return 2 * EARTH_RADIUS_M * Math.asin(Math.sqrt(h));
}

/** Human-friendly distance: "420 m apart" / "3.7 km apart". */
export function formatDistance(meters: number): string {
  if (meters < 1000) return `${Math.round(meters)} m apart`;
  return `${(meters / 1000).toFixed(meters < 10000 ? 1 : 0)} km apart`;
}

/** Relative "last updated" label, e.g. "just now", "4 min ago", "2 h ago". */
export function formatUpdatedAgo(isoTimestamp: string): string {
  const seconds = Math.max(0, Math.round((Date.now() - new Date(isoTimestamp).getTime()) / 1000));
  if (seconds < 45) return 'just now';
  const minutes = Math.round(seconds / 60);
  if (minutes < 60) return `${minutes} min ago`;
  const hours = Math.round(minutes / 60);
  if (hours < 24) return `${hours} h ago`;
  const days = Math.round(hours / 24);
  return `${days} d ago`;
}

/**
 * Deep link that opens a coordinate in the platform's default maps app
 * (Google Maps on Android, Apple Maps on iOS). Used with Linking.openURL.
 */
export function mapsUrl(latitude: number, longitude: number, label?: string | null): string {
  const coord = `${latitude},${longitude}`;
  if (Platform.OS === 'ios') {
    const q = label ? encodeURIComponent(label) : coord;
    return `http://maps.apple.com/?ll=${coord}&q=${q}`;
  }
  // geo: with a query lets Android offer any installed maps app.
  const query = label ? `${coord}(${encodeURIComponent(label)})` : coord;
  return `geo:${coord}?q=${query}`;
}
