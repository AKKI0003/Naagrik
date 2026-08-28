import pg from 'pg';

export const pool = new pg.Pool({
  connectionString: process.env.DATABASE_URL,
  // Most free-tier managed Postgres providers (Render, Railway, Supabase)
  // require SSL for external connections but use certs that Node's
  // default TLS trust store won't validate — this is the standard,
  // documented workaround for those free tiers specifically.
  ssl: process.env.DATABASE_URL?.includes('localhost') ? false : { rejectUnauthorized: false },
});

/** Maps a Postgres row (snake_case, PostGIS geography as lat/lng) onto
 * the same JSON shape the frontend's ReportModel expects. */
export function rowToReport(row) {
  return {
    id: row.id,
    reporterId: row.reporter_id,
    lat: row.lat,
    lng: row.lng,
    photoUrl: row.photo_url,
    photoObjectKey: row.photo_object_key,
    category: row.category,
    modelConfidence: row.model_confidence,
    description: row.description ?? null,
    userConfirmed: row.user_confirmed,
    createdAt: row.created_at ? new Date(row.created_at).getTime() : null,
    status: row.status,
    upvotes: row.upvotes,
    flagCount: row.flag_count,
    mergedIntoId: row.merged_into_id,
    // Only present when the query selected them (requires a caller id) —
    // lets the frontend disable Confirm/Flag once this account has
    // already used them on this report.
    hasConfirmed: row.has_confirmed ?? false,
    hasFlagged: row.has_flagged ?? false,
  };
}

/** Every SELECT pulls lat/lng back out of the PostGIS geography column
 * with these two expressions rather than storing them as separate plain
 * columns — one source of truth for location, used both for ST_DWithin
 * geo-queries and for plain display. */
export const LAT_LNG_SELECT = 'ST_Y(location::geometry) AS lat, ST_X(location::geometry) AS lng';

/** Builds the "did *this* caller already confirm/flag this report"
 * subquery pair, parameterized against whichever placeholder index the
 * caller id lands on in that query (reports.ts positions it after the
 * query's other params). Pass `null` for an unauthenticated caller —
 * both EXISTS checks then correctly evaluate to false for every row. */
export function myVoteSelect(callerIdParamIndex: number): string {
  return `
    EXISTS(SELECT 1 FROM report_confirms rc WHERE rc.report_id = reports.id AND rc.user_id = $${callerIdParamIndex}) AS has_confirmed,
    EXISTS(SELECT 1 FROM report_flags rf WHERE rf.report_id = reports.id AND rf.user_id = $${callerIdParamIndex}) AS has_flagged
  `;
}

/** Cosine similarity between two equal-length embedding vectors, both
 * assumed pre-normalized (ai-service's /embed already L2-normalizes
 * CLIP output) — so this is just a dot product. Returns 0 for
 * missing/mismatched vectors instead of throwing, since a report
 * created before the embedding column existed (or via the offline
 * stub) legitimately has none. */
export function cosineSimilarity(a: number[] | null | undefined, b: number[] | null | undefined): number {
  if (!a || !b || a.length !== b.length || a.length === 0) return 0;
  let dot = 0;
  for (let i = 0; i < a.length; i++) dot += a[i] * b[i];
  return dot;
}
