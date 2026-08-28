import { useCallback, useEffect, useRef, useState } from 'react';
import { getIpLocation, type IpLocation } from '../services/ipGeolocation';

export type LocationStatus = 'idle' | 'locating' | 'active' | 'denied' | 'unavailable' | 'timeout' | 'ip-fallback';

export interface LiveLocationState {
  location: [number, number] | null;
  status: LocationStatus;
  accuracy: number | null;
  /** Forces a brand-new reading — clears any existing watch and starts
   * again, so a stale/cached fix can never linger after this is called. */
  refresh: () => void;
  /** True when the current location is from IP-based fallback (low accuracy) */
  isIpFallback: boolean;
  /** Triggers an immediate IP-based location lookup as fallback */
  fetchIpFallback: () => Promise<void>;
}

// Forcing a genuinely fresh GPS fix, not a cached network/IP-based
// position, is the actual fix for "my location doesn't update" —
// this is the root cause, not a UI issue. `maximumAge: 0` tells the
// browser a cached position is never acceptable, and
// `enableHighAccuracy: true` asks for GPS/fused-location rather than
// the much coarser, much more aggressively cached cell/wifi lookup
// most browsers default to.
const FRESH_POSITION_OPTIONS: PositionOptions = {
  enableHighAccuracy: true,
  maximumAge: 0,
  timeout: 15000,
};

const STALE_GPS_THRESHOLD_MS = 30000; // 30 seconds - if no GPS update, try IP fallback

/**
 * Continuously tracks the browser's geolocation using watchPosition
 * (not a single getCurrentPosition call) so the map keeps following
 * real movement instead of freezing on whatever the first fix happened
 * to be. Also proactively checks the Permissions API where available,
 * so a denied/blocked permission shows up as a clear status instead of
 * silently leaving the map stuck on the fallback center forever —
 * which is what "my location never updates" looks like from a user's
 * side when the real cause is a permission that was never granted.
 * 
 * Adds IP-based geolocation fallback for scenarios where GPS is unavailable
 * (denied, timeout, desktop without GPS) or returns low-accuracy results
 * (common on mobile hotspot where browser uses hotspot's registered location).
 */
export function useLiveLocation(): LiveLocationState {
  const [location, setLocation] = useState<[number, number] | null>(null);
  const [accuracy, setAccuracy] = useState<number | null>(null);
  const [status, setStatus] = useState<LocationStatus>('idle');
  const [isIpFallback, setIsIpFallback] = useState(false);
  const watchIdRef = useRef<number | null>(null);
  const lastGpsUpdateRef = useRef<number>(0);
  const ipFallbackTriggeredRef = useRef(false);
  const previousLocationRef = useRef<[number, number] | null>(null);

  const stopWatch = useCallback(() => {
    if (watchIdRef.current !== null) {
      navigator.geolocation.clearWatch(watchIdRef.current);
      watchIdRef.current = null;
    }
  }, []);

  const fetchIpFallback = useCallback(async () => {
    if (ipFallbackTriggeredRef.current) return;
    ipFallbackTriggeredRef.current = true;
    setStatus('ip-fallback');
    
    const ipLocation = await getIpLocation();
    if (ipLocation) {
      setLocation([ipLocation.lat, ipLocation.lng]);
      setAccuracy(ipLocation.accuracy);
      setIsIpFallback(true);
      setStatus('active');
    } else {
      setStatus('unavailable');
    }
  }, []);

  const startWatch = useCallback(() => {
    if (!navigator.geolocation) {
      setStatus('unavailable');
      return;
    }
    stopWatch();
    setStatus('locating');
    ipFallbackTriggeredRef.current = false;
    setIsIpFallback(false);

    watchIdRef.current = navigator.geolocation.watchPosition(
      (pos) => {
        const newLocation: [number, number] = [pos.coords.latitude, pos.coords.longitude];
        const newAccuracy = pos.coords.accuracy;
        
        // Detect if GPS is likely stale (e.g., mobile hotspot showing registered location)
        const isStale = previousLocationRef.current && 
          newAccuracy > 2000 && // network positioning accuracy
          Math.abs(newLocation[0] - previousLocationRef.current[0]) < 0.001 &&
          Math.abs(newLocation[1] - previousLocationRef.current[1]) < 0.001;
        
        if (isStale && !isIpFallback) {
          // GPS appears stale, trigger IP fallback
          fetchIpFallback();
          return;
        }
        
        previousLocationRef.current = newLocation;
        lastGpsUpdateRef.current = Date.now();
        setLocation(newLocation);
        setAccuracy(newAccuracy);
        setIsIpFallback(false);
        setStatus('active');
      },
      (err) => {
        if (err.code === err.PERMISSION_DENIED) {
          setStatus('denied');
          // Try IP fallback immediately on permission denied
          fetchIpFallback();
        } else if (err.code === err.TIMEOUT) {
          setStatus('timeout');
          // Try IP fallback on timeout
          fetchIpFallback();
        } else {
          setStatus('unavailable');
          fetchIpFallback();
        }
      },
      FRESH_POSITION_OPTIONS,
    );

    // Fallback timer: if no GPS update within threshold, try IP fallback
    setTimeout(() => {
      if (watchIdRef.current !== null && lastGpsUpdateRef.current === 0 && status === 'locating') {
        fetchIpFallback();
      }
    }, STALE_GPS_THRESHOLD_MS);
  }, [stopWatch, fetchIpFallback, status]);

  const refresh = useCallback(() => {
    previousLocationRef.current = null;
    lastGpsUpdateRef.current = 0;
    ipFallbackTriggeredRef.current = false;
    startWatch();
  }, [startWatch]);

  useEffect(() => {
    if (navigator.permissions?.query) {
      navigator.permissions
        .query({ name: 'geolocation' as PermissionName })
        .then((result) => {
          if (result.state === 'denied') {
            setStatus('denied');
            fetchIpFallback();
          } else {
            startWatch();
          }
          result.onchange = () => {
            if (result.state === 'denied') {
              stopWatch();
              setStatus('denied');
              fetchIpFallback();
            } else {
              startWatch();
            }
          };
        })
        .catch(() => startWatch());
    } else {
      startWatch();
    }

    return stopWatch;
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  return { location, status, accuracy, refresh, isIpFallback, fetchIpFallback };
}
