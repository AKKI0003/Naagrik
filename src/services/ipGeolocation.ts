/**
 * IP-based geolocation fallback — used when browser GPS is unavailable,
 * denied, or returns low-accuracy results (common on desktop/mobile hotspot
 * where the browser falls back to the hotspot's registered location).
 * Uses free IP geolocation APIs (ipapi.co, ip-api.com) with graceful
 * degradation if one fails.
 */

export interface IpLocation {
  lat: number;
  lng: number;
  accuracy: number; // approximate accuracy in meters (IP-based is ~km level)
  source: 'ipapi' | 'ip-api' | 'ipinfo';
  city?: string;
  region?: string;
  country?: string;
}

const IP_API_URLS = [
  { name: 'ipapi' as const, url: 'https://ipapi.co/json/' },
  { name: 'ip-api' as const, url: 'http://ip-api.com/json/' },
  { name: 'ipinfo' as const, url: 'https://ipinfo.io/json' },
];

const IP_ACCURACY_METERS = 50000; // ~50km typical accuracy for IP geolocation

async function fetchFromIpapi(): Promise<IpLocation | null> {
  try {
    const res = await fetch('https://ipapi.co/json/', { signal: AbortSignal.timeout(5000) });
    if (!res.ok) return null;
    const data = await res.json();
    if (data.latitude && data.longitude) {
      return {
        lat: data.latitude,
        lng: data.longitude,
        accuracy: IP_ACCURACY_METERS,
        source: 'ipapi',
        city: data.city,
        region: data.region,
        country: data.country_name,
      };
    }
  } catch {
    // ignore, try next
  }
  return null;
}

async function fetchFromIpApi(): Promise<IpLocation | null> {
  try {
    const res = await fetch('http://ip-api.com/json/', { signal: AbortSignal.timeout(5000) });
    if (!res.ok) return null;
    const data = await res.json();
    if (data.status === 'success' && data.lat && data.lon) {
      return {
        lat: data.lat,
        lng: data.lon,
        accuracy: IP_ACCURACY_METERS,
        source: 'ip-api',
        city: data.city,
        region: data.regionName,
        country: data.country,
      };
    }
  } catch {
    // ignore, try next
  }
  return null;
}

async function fetchFromIpinfo(): Promise<IpLocation | null> {
  try {
    const res = await fetch('https://ipinfo.io/json', { signal: AbortSignal.timeout(5000) });
    if (!res.ok) return null;
    const data = await res.json();
    if (data.loc) {
      const [lat, lng] = data.loc.split(',').map(Number);
      return {
        lat,
        lng,
        accuracy: IP_ACCURACY_METERS,
        source: 'ipinfo',
        city: data.city,
        region: data.region,
        country: data.country,
      };
    }
  } catch {
    // ignore
  }
  return null;
}

/**
 * Fetches IP-based location, trying multiple providers until one succeeds.
 * Returns null if all fail.
 */
export async function getIpLocation(): Promise<IpLocation | null> {
  for (const provider of IP_API_URLS) {
    let result: IpLocation | null = null;
    switch (provider.name) {
      case 'ipapi':
        result = await fetchFromIpapi();
        break;
      case 'ip-api':
        result = await fetchFromIpApi();
        break;
      case 'ipinfo':
        result = await fetchFromIpinfo();
        break;
    }
    if (result) return result;
  }
  return null;
}

/**
 * Determines if a GPS location is likely stale/wrong (e.g., mobile hotspot
 * showing the hotspot's registered location instead of actual device location).
 * Heuristics:
 * - Accuracy > 2km suggests network/WiFi positioning, not GPS
 * - If we have a previous GPS fix and the new one hasn't moved significantly
 *   but accuracy is poor, it's likely cached
 */
export function isLikelyStaleGps(accuracy: number | null, previousLocation: [number, number] | null, newLocation: [number, number] | null): boolean {
  if (accuracy === null) return false;
  if (accuracy > 2000) return true; // >2km accuracy = network positioning
  if (!previousLocation || !newLocation) return false;
  // If location hasn't changed but accuracy is poor, likely stale
  const distance = Math.sqrt(
    Math.pow(newLocation[0] - previousLocation[0], 2) +
    Math.pow(newLocation[1] - previousLocation[1], 2)
  ) * 111000; // rough meters per degree
  return distance < 100 && accuracy > 1000; // hasn't moved much but accuracy is poor
}