/** Haversine distance in meters — used for the "is this within ~30m of
 * an existing report" duplicate check from the pitch. Same math as the
 * Flutter version's geo_utils.dart, just in TypeScript. */
export function distanceMeters(aLat: number, aLng: number, bLat: number, bLng: number): number {
  const R = 6371000;
  const dLat = deg2rad(bLat - aLat);
  const dLng = deg2rad(bLng - aLng);
  const h =
    Math.sin(dLat / 2) ** 2 +
    Math.cos(deg2rad(aLat)) * Math.cos(deg2rad(bLat)) * Math.sin(dLng / 2) ** 2;
  return R * 2 * Math.atan2(Math.sqrt(h), Math.sqrt(1 - h));
}

function deg2rad(deg: number): number {
  return deg * (Math.PI / 180);
}

/** A rough lat/lng bounding box, used to keep a Firestore/query cheap —
 * fetch a small local neighborhood first, then filter precisely with
 * distanceMeters(), instead of scanning every report in the database. */
export function boxAround(lat: number, lng: number, radiusMeters: number) {
  const latDelta = radiusMeters / 111320;
  const lngDelta = radiusMeters / (111320 * Math.max(0.01, Math.abs(Math.cos(deg2rad(lat)))));
  return {
    minLat: lat - latDelta,
    maxLat: lat + latDelta,
    minLng: lng - lngDelta,
    maxLng: lng + lngDelta,
  };
}
