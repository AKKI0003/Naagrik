/** Same open-ended category set as the Flutter version — deliberately
 * not pothole-specific. `not_an_issue` is a first-class prediction
 * outcome (the "reject bucket" from the pitch), never a selectable
 * option — see ReportCategoryX.selectable below. */
export type ReportCategory =
  | 'road'
  | 'waste'
  | 'utility'
  | 'water'
  | 'vegetation'
  | 'other'
  | 'not_an_issue';

export interface CategoryMeta {
  label: string;
  color: string; // tailwind color token, matches tailwind.config.js
  hex: string; // same color as a literal hex, for use outside Tailwind (Leaflet markers, canvas)
  icon: string; // a short glyph/emoji-free label used in the pin — kept ASCII, see MapPin
}

export const CATEGORY_META: Record<ReportCategory, CategoryMeta> = {
  road: { label: 'Road & Potholes', color: 'catRoad', hex: '#E8A23D', icon: 'RD' },
  waste: { label: 'Waste & Garbage', color: 'catWaste', hex: '#6FCF97', icon: 'WS' },
  utility: { label: 'Streetlight & Electrical', color: 'catUtility', hex: '#F2C94C', icon: 'UT' },
  water: { label: 'Water & Drainage', color: 'catWater', hex: '#56CCF2', icon: 'H2O' },
  vegetation: { label: 'Vegetation / Signage', color: 'catOther', hex: '#BB6BD9', icon: 'VG' },
  other: { label: 'Other', color: 'muted', hex: '#8B96AC', icon: 'OT' },
  not_an_issue: { label: 'Not a civic issue', color: 'danger', hex: '#E85D5D', icon: 'X' },
};

/** The set a user can actually pick from when confirming a category —
 * mirrors ReportCategoryX.selectable in the Flutter version. */
export const SELECTABLE_CATEGORIES: ReportCategory[] = [
  'road',
  'waste',
  'utility',
  'water',
  'vegetation',
  'other',
];

/**
 * `pending_review` is the key addition for the moderation workflow:
 * a report never jumps straight from `open` to deleted. It only enters
 * `pending_review` once the net-score formula below crosses the
 * threshold, and only a moderator action moves it to `resolved` (kept)
 * or `removed` (deleted for good). `hidden` is kept as a legacy alias
 * for `removed` so old data/links don't break.
 */
export type ReportStatus = 'open' | 'pending_review' | 'resolved' | 'removed' | 'hidden';

export interface ReportModel {
  id: string;
  reporterId: string;
  lat: number;
  lng: number;
  photoUrl?: string | null;
  photoObjectKey?: string | null;
  category: ReportCategory;
  modelConfidence: number; // 0-1
  /** AI-generated (BLIP) or user-edited free-text description of the
   * issue — separate from `category`, which is just the label. Null
   * for reports filed before this existed, or when the caption model
   * had nothing usable to say. */
  description?: string | null;
  userConfirmed: boolean;
  createdAt: number | null; // epoch millis
  status: ReportStatus;
  upvotes: number;
  flagCount: number;
  mergedIntoId?: string | null;
  /** Whether the *currently logged-in* account has already confirmed /
   * flagged this specific report — drives the "1 confirm + 1 flag per
   * account" limit on the Confirm/Flag buttons. Populated by the HTTP
   * repository from the backend; the local (offline demo) repository
   * derives the same thing from its own per-user vote record. */
  hasConfirmed?: boolean;
  hasFlagged?: boolean;
  /** CLIP cosine similarity (0-1) against the photo just captured —
   * only present on results from findNearbyOpenReports once it's
   * given an embedding to compare against. Not persisted; it's a
   * property of the comparison, not of the report itself. */
  similarity?: number;
  /** CLIP embedding captured at submit time, sent once on create so
   * later reports can be compared against this one for duplicate
   * detection. Never re-fetched or displayed — write-only from the
   * frontend's perspective. */
  embedding?: number[] | null;
}

/**
 * The removal formula you specified: netScore = confirms − flags.
 * A report is only ever *considered* for removal once netScore drops
 * to -3 or below — e.g. 4 confirms and 3 flags nets to +1, nowhere
 * near the threshold, so it correctly stays open. Crossing the
 * threshold does NOT delete the report — it moves it to
 * `pending_review`, where a human moderator makes the final call.
 * This is intentionally the same "AI/automation suggests, a human
 * decides" pattern used for the classification pipeline.
 */
export const REMOVAL_THRESHOLD = -3;

export function netScore(report: Pick<ReportModel, 'upvotes' | 'flagCount'>): number {
  return report.upvotes - report.flagCount;
}

export function crossesRemovalThreshold(report: Pick<ReportModel, 'upvotes' | 'flagCount'>): boolean {
  return netScore(report) <= REMOVAL_THRESHOLD;
}

export const STATUS_META: Record<ReportStatus, { label: string; hex: string }> = {
  open: { label: 'Open', hex: '#4DD9E8' },
  pending_review: { label: 'Under Review', hex: '#D9AF52' },
  resolved: { label: 'Resolved', hex: '#6FCF97' },
  removed: { label: 'Removed', hex: '#E85D5D' },
  hidden: { label: 'Removed', hex: '#E85D5D' },
};

export type ReportAge = 'fresh' | 'aging' | 'stale' | 'critical';

export function ageFromDays(days: number): ReportAge {
  if (days <= 3) return 'fresh';
  if (days <= 14) return 'aging';
  if (days <= 45) return 'stale';
  return 'critical';
}

export const AGE_META: Record<ReportAge, { label: string; hex: string }> = {
  fresh: { label: 'New', hex: '#6FCF97' },
  aging: { label: 'Aging', hex: '#F2C94C' },
  stale: { label: 'Stale', hex: '#E8A23D' },
  critical: { label: 'Critical', hex: '#E85D5D' },
};

export function reportAgeInDays(createdAt: number | null): number {
  if (!createdAt) return 0;
  return Math.floor((Date.now() - createdAt) / (1000 * 60 * 60 * 24));
}

/* ---------------- Activity log ---------------- */

export type ActivityEventType =
  | 'created'
  | 'confirmed'
  | 'flagged'
  | 'pending_review'
  | 'resolved'
  | 'removed'
  | 'restored';

export interface ActivityEvent {
  id: string;
  type: ActivityEventType;
  reportId: string;
  category: ReportCategory;
  at: number; // epoch millis
  meta?: string; // short human-readable extra context, e.g. "score -3"
}

export const ACTIVITY_META: Record<ActivityEventType, { label: string; hex: string; verb: string }> = {
  created: { label: 'New report', hex: '#4DD9E8', verb: 'reported' },
  confirmed: { label: 'Confirmed', hex: '#6FCF97', verb: 'confirmed' },
  flagged: { label: 'Flagged', hex: '#E8A23D', verb: 'flagged' },
  pending_review: { label: 'Sent to review', hex: '#D9AF52', verb: 'sent for moderator review' },
  resolved: { label: 'Resolved', hex: '#6FCF97', verb: 'marked resolved' },
  removed: { label: 'Removed', hex: '#E85D5D', verb: 'removed by a moderator' },
  restored: { label: 'Restored', hex: '#4DD9E8', verb: 'restored by a moderator' },
};

/* ---------------- Time filter (for the map) ---------------- */

export type TimeFilter = 'all' | '24h' | '7d' | '30d';

export const TIME_FILTER_META: Record<TimeFilter, { label: string; ms: number | null }> = {
  all: { label: 'All time', ms: null },
  '24h': { label: 'Last 24h', ms: 24 * 60 * 60 * 1000 },
  '7d': { label: 'Last 7 days', ms: 7 * 24 * 60 * 60 * 1000 },
  '30d': { label: 'Last 30 days', ms: 30 * 24 * 60 * 60 * 1000 },
};

export function withinTimeFilter(createdAt: number | null, filter: TimeFilter): boolean {
  if (filter === 'all') return true;
  if (!createdAt) return false;
  const window = TIME_FILTER_META[filter].ms!;
  return Date.now() - createdAt <= window;
}
