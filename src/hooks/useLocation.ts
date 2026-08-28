import { useEffect, useState } from 'react';
import { useLiveLocation, type LocationStatus } from './useLiveLocation';

const FALLBACK_CENTER: [number, number] = [28.6139, 77.209]; // New Delhi — sensible default only while location is unavailable/denied

export interface LocationState {
  location: [number, number] | null;
  status: LocationStatus;
  accuracy: number | null;
  lowConfidence: boolean;
  isIpFallback: boolean;
  refresh: () => void;
  fetchIpFallback: () => Promise<void>;
}

const LOW_ACCURACY_THRESHOLD_METERS = 2000;

/**
 * Simplified location hook — single source of truth for the app.
 * Uses live GPS with IP-based fallback, no manual override.
 * This fixes "the app shows the wrong place and GPS won't correct it"
 * by automatically falling back to IP geolocation when GPS is unavailable
 * or returns stale/low-accuracy results (common on mobile hotspot).
 */
export function useLocation(): LocationState {
  const gps = useLiveLocation();
  const [hasCenteredOnce, setHasCenteredOnce] = useState(false);

  const lowConfidence = gps.accuracy !== null && gps.accuracy > LOW_ACCURACY_THRESHOLD_METERS;

  return {
    location: gps.location,
    status: gps.status,
    accuracy: gps.accuracy,
    lowConfidence,
    isIpFallback: gps.isIpFallback,
    refresh: gps.refresh,
    fetchIpFallback: gps.fetchIpFallback,
  };
}

export { FALLBACK_CENTER };