import Constants from 'expo-constants';

export type WalkingRoute = {
  distance: number; // meters
  duration: number; // seconds
};

function getOpenRouteServiceApiKey(): string | undefined {
  // Try common places for Expo apps
  const envKey = (process?.env as any)?.OPENROUTESERVICE_API_KEY;
  const extra =
    (Constants?.expoConfig as any)?.extra ||
    (Constants as any)?.manifest?.extra ||
    {};
  const extraKey =
    extra.OPENROUTESERVICE_API_KEY ||
    extra.openRouteServiceApiKey ||
    extra.ORS_API_KEY;

  return envKey || extraKey;
}

/**
 * Fetch a walking route between two coordinates (lat/lon).
 * Throws if API key missing or response invalid.
 */
export async function getWalkingRoute(
  fromLat: number,
  fromLon: number,
  toLat: number,
  toLon: number
): Promise<WalkingRoute> {
  const apiKey = getOpenRouteServiceApiKey();
  if (!apiKey) {
    throw new Error(
      'OpenRouteService API key not found. Set OPENROUTESERVICE_API_KEY in env or Expo extra.'
    );
  }

  const url = 'https://api.openrouteservice.org/v2/directions/foot-walking';
  const body = {
    coordinates: [
      [fromLon, fromLat],
      [toLon, toLat],
    ],
  };

  const res = await fetch(url, {
    method: 'POST',
    headers: {
      Authorization: apiKey,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify(body),
  });

  if (!res.ok) {
    const txt = await res.text().catch(() => '');
    throw new Error(`OpenRouteService error: ${res.status} ${res.statusText} ${txt}`);
  }

  const data = await res.json();
  
  // OpenRouteService v2 API returns: { routes: [{ summary: { distance, duration } }] }
  const route = data?.routes?.[0];
  const summary = route?.summary;

  if (!summary || typeof summary.distance !== 'number' || typeof summary.duration !== 'number') {
    // Log the actual response for debugging
    console.error('OpenRouteService unexpected response:', JSON.stringify(data, null, 2));
    throw new Error('OpenRouteService: unexpected response format');
  }

  return { distance: summary.distance, duration: summary.duration };
}

export function metersToKm(meters: number): string {
  if (!isFinite(meters)) return '0.00';
  return (meters / 1000).toFixed(2);
}

export function secondsToMinutes(seconds: number): string {
  if (!isFinite(seconds)) return '0';
  return Math.round(seconds / 60).toString();
}
