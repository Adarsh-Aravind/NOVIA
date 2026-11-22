/**
 * Places for Walk Together: searched by name to set a route, and drawn as the
 * city lights on the globe. Coordinates are rounded to 0.01°, which is plenty
 * for a route measured in thousands of kilometres. Anything not listed is
 * looked up on OpenStreetMap's Nominatim when you search for it.
 */
export interface Place {
  name: string;
  country: string;
  lat: number;
  lng: number;
}

export const PLACES: Place[] = [
  // India
  { name: 'Kochi', country: 'India', lat: 9.93, lng: 76.27 },
  { name: 'Thiruvananthapuram', country: 'India', lat: 8.52, lng: 76.94 },
  { name: 'Kozhikode', country: 'India', lat: 11.26, lng: 75.78 },
  { name: 'Thrissur', country: 'India', lat: 10.53, lng: 76.21 },
  { name: 'Munnar', country: 'India', lat: 10.09, lng: 77.06 },
  { name: 'Alappuzha', country: 'India', lat: 9.5, lng: 76.34 },
  { name: 'Bengaluru', country: 'India', lat: 12.97, lng: 77.59 },
  { name: 'Mysuru', country: 'India', lat: 12.3, lng: 76.64 },
  { name: 'Chennai', country: 'India', lat: 13.08, lng: 80.27 },
  { name: 'Coimbatore', country: 'India', lat: 11.02, lng: 76.96 },
  { name: 'Madurai', country: 'India', lat: 9.93, lng: 78.12 },
  { name: 'Ooty', country: 'India', lat: 11.41, lng: 76.7 },
  { name: 'Puducherry', country: 'India', lat: 11.94, lng: 79.81 },
  { name: 'Hyderabad', country: 'India', lat: 17.39, lng: 78.49 },
  { name: 'Goa', country: 'India', lat: 15.5, lng: 73.83 },
  { name: 'Mumbai', country: 'India', lat: 19.08, lng: 72.88 },
  { name: 'Pune', country: 'India', lat: 18.52, lng: 73.86 },
  { name: 'Ahmedabad', country: 'India', lat: 23.02, lng: 72.57 },
  { name: 'Jaipur', country: 'India', lat: 26.91, lng: 75.79 },
  { name: 'Udaipur', country: 'India', lat: 24.58, lng: 73.71 },
  { name: 'Delhi', country: 'India', lat: 28.61, lng: 77.21 },
  { name: 'Agra', country: 'India', lat: 27.18, lng: 78.01 },
  { name: 'Varanasi', country: 'India', lat: 25.32, lng: 82.97 },
  { name: 'Kolkata', country: 'India', lat: 22.57, lng: 88.36 },
  { name: 'Darjeeling', country: 'India', lat: 27.04, lng: 88.26 },
  { name: 'Shimla', country: 'India', lat: 31.1, lng: 77.17 },
  { name: 'Manali', country: 'India', lat: 32.24, lng: 77.19 },
  { name: 'Leh', country: 'India', lat: 34.15, lng: 77.58 },
  { name: 'Srinagar', country: 'India', lat: 34.08, lng: 74.8 },
  { name: 'Rishikesh', country: 'India', lat: 30.09, lng: 78.27 },
  { name: 'Guwahati', country: 'India', lat: 26.14, lng: 91.74 },
  { name: 'Lucknow', country: 'India', lat: 26.85, lng: 80.95 },
  { name: 'Bhubaneswar', country: 'India', lat: 20.3, lng: 85.82 },
  { name: 'Visakhapatnam', country: 'India', lat: 17.69, lng: 83.22 },
  { name: 'Port Blair', country: 'India', lat: 11.62, lng: 92.73 },
  // Asia
  { name: 'Colombo', country: 'Sri Lanka', lat: 6.93, lng: 79.86 },
  { name: 'Malé', country: 'Maldives', lat: 4.18, lng: 73.51 },
  { name: 'Kathmandu', country: 'Nepal', lat: 27.72, lng: 85.32 },
  { name: 'Dhaka', country: 'Bangladesh', lat: 23.81, lng: 90.41 },
  { name: 'Thimphu', country: 'Bhutan', lat: 27.47, lng: 89.64 },
  { name: 'Dubai', country: 'UAE', lat: 25.2, lng: 55.27 },
  { name: 'Abu Dhabi', country: 'UAE', lat: 24.45, lng: 54.38 },
  { name: 'Doha', country: 'Qatar', lat: 25.29, lng: 51.53 },
  { name: 'Muscat', country: 'Oman', lat: 23.59, lng: 58.41 },
  { name: 'Riyadh', country: 'Saudi Arabia', lat: 24.71, lng: 46.68 },
  { name: 'Istanbul', country: 'Türkiye', lat: 41.01, lng: 28.98 },
  { name: 'Bangkok', country: 'Thailand', lat: 13.76, lng: 100.5 },
  { name: 'Phuket', country: 'Thailand', lat: 7.88, lng: 98.39 },
  { name: 'Kuala Lumpur', country: 'Malaysia', lat: 3.14, lng: 101.69 },
  { name: 'Singapore', country: 'Singapore', lat: 1.35, lng: 103.82 },
  { name: 'Bali', country: 'Indonesia', lat: -8.34, lng: 115.09 },
  { name: 'Jakarta', country: 'Indonesia', lat: -6.21, lng: 106.85 },
  { name: 'Hanoi', country: 'Vietnam', lat: 21.03, lng: 105.85 },
  { name: 'Ho Chi Minh City', country: 'Vietnam', lat: 10.82, lng: 106.63 },
  { name: 'Manila', country: 'Philippines', lat: 14.6, lng: 120.98 },
  { name: 'Hong Kong', country: 'China', lat: 22.32, lng: 114.17 },
  { name: 'Shanghai', country: 'China', lat: 31.23, lng: 121.47 },
  { name: 'Beijing', country: 'China', lat: 39.9, lng: 116.41 },
  { name: 'Seoul', country: 'South Korea', lat: 37.57, lng: 126.98 },
  { name: 'Tokyo', country: 'Japan', lat: 35.68, lng: 139.69 },
  { name: 'Kyoto', country: 'Japan', lat: 35.01, lng: 135.77 },
  { name: 'Osaka', country: 'Japan', lat: 34.69, lng: 135.5 },
  // Europe
  { name: 'London', country: 'UK', lat: 51.51, lng: -0.13 },
  { name: 'Edinburgh', country: 'UK', lat: 55.95, lng: -3.19 },
  { name: 'Dublin', country: 'Ireland', lat: 53.35, lng: -6.26 },
  { name: 'Paris', country: 'France', lat: 48.86, lng: 2.35 },
  { name: 'Nice', country: 'France', lat: 43.71, lng: 7.26 },
  { name: 'Amsterdam', country: 'Netherlands', lat: 52.37, lng: 4.9 },
  { name: 'Brussels', country: 'Belgium', lat: 50.85, lng: 4.35 },
  { name: 'Berlin', country: 'Germany', lat: 52.52, lng: 13.41 },
  { name: 'Munich', country: 'Germany', lat: 48.14, lng: 11.58 },
  { name: 'Zurich', country: 'Switzerland', lat: 47.38, lng: 8.54 },
  { name: 'Interlaken', country: 'Switzerland', lat: 46.69, lng: 7.86 },
  { name: 'Vienna', country: 'Austria', lat: 48.21, lng: 16.37 },
  { name: 'Prague', country: 'Czechia', lat: 50.08, lng: 14.44 },
  { name: 'Budapest', country: 'Hungary', lat: 47.5, lng: 19.04 },
  { name: 'Rome', country: 'Italy', lat: 41.9, lng: 12.5 },
  { name: 'Venice', country: 'Italy', lat: 45.44, lng: 12.32 },
  { name: 'Florence', country: 'Italy', lat: 43.77, lng: 11.26 },
  { name: 'Milan', country: 'Italy', lat: 45.46, lng: 9.19 },
  { name: 'Barcelona', country: 'Spain', lat: 41.39, lng: 2.17 },
  { name: 'Madrid', country: 'Spain', lat: 40.42, lng: -3.7 },
  { name: 'Lisbon', country: 'Portugal', lat: 38.72, lng: -9.14 },
  { name: 'Athens', country: 'Greece', lat: 37.98, lng: 23.73 },
  { name: 'Santorini', country: 'Greece', lat: 36.39, lng: 25.46 },
  { name: 'Copenhagen', country: 'Denmark', lat: 55.68, lng: 12.57 },
  { name: 'Stockholm', country: 'Sweden', lat: 59.33, lng: 18.07 },
  { name: 'Oslo', country: 'Norway', lat: 59.91, lng: 10.75 },
  { name: 'Tromsø', country: 'Norway', lat: 69.65, lng: 18.96 },
  { name: 'Reykjavík', country: 'Iceland', lat: 64.15, lng: -21.94 },
  { name: 'Helsinki', country: 'Finland', lat: 60.17, lng: 24.94 },
  { name: 'Moscow', country: 'Russia', lat: 55.76, lng: 37.62 },
  // Africa
  { name: 'Cairo', country: 'Egypt', lat: 30.04, lng: 31.24 },
  { name: 'Marrakesh', country: 'Morocco', lat: 31.63, lng: -7.98 },
  { name: 'Nairobi', country: 'Kenya', lat: -1.29, lng: 36.82 },
  { name: 'Zanzibar', country: 'Tanzania', lat: -6.17, lng: 39.2 },
  { name: 'Cape Town', country: 'South Africa', lat: -33.92, lng: 18.42 },
  { name: 'Lagos', country: 'Nigeria', lat: 6.52, lng: 3.38 },
  { name: 'Mauritius', country: 'Mauritius', lat: -20.35, lng: 57.55 },
  { name: 'Seychelles', country: 'Seychelles', lat: -4.62, lng: 55.45 },
  // Americas
  { name: 'New York', country: 'USA', lat: 40.71, lng: -74.01 },
  { name: 'Boston', country: 'USA', lat: 42.36, lng: -71.06 },
  { name: 'Washington', country: 'USA', lat: 38.91, lng: -77.04 },
  { name: 'Chicago', country: 'USA', lat: 41.88, lng: -87.63 },
  { name: 'Miami', country: 'USA', lat: 25.76, lng: -80.19 },
  { name: 'Los Angeles', country: 'USA', lat: 34.05, lng: -118.24 },
  { name: 'San Francisco', country: 'USA', lat: 37.77, lng: -122.42 },
  { name: 'Las Vegas', country: 'USA', lat: 36.17, lng: -115.14 },
  { name: 'Seattle', country: 'USA', lat: 47.61, lng: -122.33 },
  { name: 'Honolulu', country: 'USA', lat: 21.31, lng: -157.86 },
  { name: 'Toronto', country: 'Canada', lat: 43.65, lng: -79.38 },
  { name: 'Vancouver', country: 'Canada', lat: 49.28, lng: -123.12 },
  { name: 'Mexico City', country: 'Mexico', lat: 19.43, lng: -99.13 },
  { name: 'Cancún', country: 'Mexico', lat: 21.16, lng: -86.85 },
  { name: 'Rio de Janeiro', country: 'Brazil', lat: -22.91, lng: -43.17 },
  { name: 'São Paulo', country: 'Brazil', lat: -23.55, lng: -46.63 },
  { name: 'Buenos Aires', country: 'Argentina', lat: -34.6, lng: -58.38 },
  { name: 'Lima', country: 'Peru', lat: -12.05, lng: -77.04 },
  { name: 'Machu Picchu', country: 'Peru', lat: -13.16, lng: -72.55 },
  // Oceania
  { name: 'Sydney', country: 'Australia', lat: -33.87, lng: 151.21 },
  { name: 'Melbourne', country: 'Australia', lat: -37.81, lng: 144.96 },
  { name: 'Perth', country: 'Australia', lat: -31.95, lng: 115.86 },
  { name: 'Auckland', country: 'New Zealand', lat: -36.85, lng: 174.76 },
  { name: 'Queenstown', country: 'New Zealand', lat: -45.03, lng: 168.66 },
  { name: 'Fiji', country: 'Fiji', lat: -17.71, lng: 178.07 },
];

const norm = (s: string) =>
  s
    .toLowerCase()
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .trim();

/** Local matches first (instant, offline); OpenStreetMap only if none. */
export async function searchPlaces(query: string): Promise<Place[]> {
  const q = norm(query);
  if (q.length < 2) return [];
  const local = PLACES.filter((p) => norm(p.name).startsWith(q) || norm(p.country) === q || norm(p.name).includes(q)).slice(0, 6);
  if (local.length) return local;
  try {
    const res = await fetch(
      `https://nominatim.openstreetmap.org/search?format=json&limit=5&addressdetails=1&q=${encodeURIComponent(query.trim())}`,
      { headers: { 'User-Agent': 'NOVIA-Next/1.0 (couples app)', 'Accept-Language': 'en' } }
    );
    if (!res.ok) return [];
    const rows: any[] = await res.json();
    return rows.map((r) => ({
      name: r.address?.city || r.address?.town || r.address?.village || r.name || String(r.display_name).split(',')[0],
      country: r.address?.country ?? '',
      lat: Number(r.lat),
      lng: Number(r.lon),
    }));
  } catch {
    return [];
  }
}

const RAD = Math.PI / 180;

/** Great-circle distance in km. */
export function distanceKm(a: { lat: number; lng: number }, b: { lat: number; lng: number }): number {
  const dLat = (b.lat - a.lat) * RAD;
  const dLng = (b.lng - a.lng) * RAD;
  const h = Math.sin(dLat / 2) ** 2 + Math.cos(a.lat * RAD) * Math.cos(b.lat * RAD) * Math.sin(dLng / 2) ** 2;
  return 2 * 6371 * Math.asin(Math.min(1, Math.sqrt(h)));
}

/** The point a fraction `t` of the way along the great circle from a to b. */
export function along(a: { lat: number; lng: number }, b: { lat: number; lng: number }, t: number): { lat: number; lng: number } {
  const toV = (p: { lat: number; lng: number }) => [
    Math.cos(p.lat * RAD) * Math.cos(p.lng * RAD),
    Math.cos(p.lat * RAD) * Math.sin(p.lng * RAD),
    Math.sin(p.lat * RAD),
  ];
  const va = toV(a);
  const vb = toV(b);
  const dot = Math.max(-1, Math.min(1, va[0] * vb[0] + va[1] * vb[1] + va[2] * vb[2]));
  const omega = Math.acos(dot);
  if (omega < 1e-6) return a;
  const s = Math.sin(omega);
  const ka = Math.sin((1 - t) * omega) / s;
  const kb = Math.sin(t * omega) / s;
  const v = [0, 1, 2].map((i) => va[i] * ka + vb[i] * kb);
  return { lat: Math.asin(v[2]) / RAD, lng: Math.atan2(v[1], v[0]) / RAD };
}
