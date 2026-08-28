import {
  crossesRemovalThreshold,
  type ActivityEvent,
  type ActivityEventType,
  type ReportCategory,
  type ReportModel,
} from '../types/report';
import { boxAround, distanceMeters } from './geoUtils';

export type ModeratorAction = 'remove' | 'restore';

export interface ReportsRepository {
  watchOpenReports(onChange: (reports: ReportModel[]) => void): () => void;
  watchMyReports(uid: string, onChange: (reports: ReportModel[]) => void): () => void;
  watchPendingReview(onChange: (reports: ReportModel[]) => void): () => void;
  watchActivity(onChange: (events: ActivityEvent[]) => void): () => void;
  findNearbyOpenReports(lat: number, lng: number, radiusMeters?: number, embedding?: number[] | null): Promise<ReportModel[]>;
  createReport(report: Omit<ReportModel, 'id'>): Promise<string>;
  confirmAsDuplicate(reportId: string): Promise<void>;
  flagReport(reportId: string): Promise<void>;
  deleteReport(reportId: string): Promise<void>;
  moderatorDecide(reportId: string, action: ModeratorAction): Promise<void>;
  markResolved(reportId: string): Promise<void>;
  confirmCategory(reportId: string, category: ReportCategory): Promise<void>;
}

const REPORTS_KEY = 'nagrik.reports.v2';
const ACTIVITY_KEY = 'nagrik.activity.v1';

function readReports(): ReportModel[] {
  try {
    const raw = localStorage.getItem(REPORTS_KEY);
    return raw ? (JSON.parse(raw) as ReportModel[]) : [];
  } catch {
    return [];
  }
}
function writeReports(reports: ReportModel[]) {
  localStorage.setItem(REPORTS_KEY, JSON.stringify(reports));
  window.dispatchEvent(new CustomEvent('nagrik:reports-changed'));
}
function readActivity(): ActivityEvent[] {
  try {
    const raw = localStorage.getItem(ACTIVITY_KEY);
    return raw ? (JSON.parse(raw) as ActivityEvent[]) : [];
  } catch {
    return [];
  }
}
function writeActivity(events: ActivityEvent[]) {
  localStorage.setItem(ACTIVITY_KEY, JSON.stringify(events));
  window.dispatchEvent(new CustomEvent('nagrik:activity-changed'));
}
function logActivity(type: ActivityEventType, report: Pick<ReportModel, 'id' | 'category'>, meta?: string) {
  const events = readActivity();
  events.unshift({ id: crypto.randomUUID(), type, reportId: report.id, category: report.category, at: Date.now(), meta });
  writeActivity(events.slice(0, 300));
}

/** Error thrown by the Local/Http repository when an account tries to
 * confirm or flag a report it has already confirmed/flagged — mirrors
 * the backend's 409 response so both repositories behave identically
 * and callers can show the same "already done" message either way. */
export class AlreadyVotedError extends Error {
  constructor() {
    super('You have already voted on this report (confirm or flag counts as one vote)');
  }
}

const VOTES_KEY = 'nagrik.myVotes.v1';
type VoteKind = 'confirm' | 'flag';
function voteKey(uid: string, reportId: string, kind: VoteKind) {
  return `${uid}:${reportId}:${kind}`;
}
function readVotes(): Set<string> {
  try {
    const raw = localStorage.getItem(VOTES_KEY);
    return new Set(raw ? (JSON.parse(raw) as string[]) : []);
  } catch {
    return new Set();
  }
}
function recordVote(uid: string, reportId: string, kind: VoteKind) {
  const votes = readVotes();
  votes.add(voteKey(uid, reportId, kind));
  localStorage.setItem(VOTES_KEY, JSON.stringify([...votes]));
}
function hasVoted(uid: string, reportId: string, kind: VoteKind): boolean {
  return readVotes().has(voteKey(uid, reportId, kind));
}
/** True if this account has used its one vote on this report at all —
 * confirm and flag are mutually exclusive, not separately limited. */
function hasVotedEither(uid: string, reportId: string): boolean {
  return hasVoted(uid, reportId, 'confirm') || hasVoted(uid, reportId, 'flag');
}

export class LocalReportsRepository implements ReportsRepository {
  constructor(private currentUid?: string) {}

  /** Stamps hasConfirmed/hasFlagged for whoever is currently signed
   * in, matching what the HTTP repository gets from the backend. */
  private annotate(reports: ReportModel[]): ReportModel[] {
    if (!this.currentUid) return reports;
    const uid = this.currentUid;
    return reports.map((r) => ({
      ...r,
      hasConfirmed: hasVoted(uid, r.id, 'confirm'),
      hasFlagged: hasVoted(uid, r.id, 'flag'),
    }));
  }

  watchOpenReports(onChange: (reports: ReportModel[]) => void): () => void {
    const push = () => onChange(this.annotate(readReports().filter((r) => r.status === 'open')));
    push();
    window.addEventListener('nagrik:reports-changed', push);
    return () => window.removeEventListener('nagrik:reports-changed', push);
  }

  watchMyReports(uid: string, onChange: (reports: ReportModel[]) => void): () => void {
    const push = () => onChange(this.annotate(readReports().filter((r) => r.reporterId === uid)));
    push();
    window.addEventListener('nagrik:reports-changed', push);
    return () => window.removeEventListener('nagrik:reports-changed', push);
  }

  watchPendingReview(onChange: (reports: ReportModel[]) => void): () => void {
    const push = () => onChange(this.annotate(readReports().filter((r) => r.status === 'pending_review')));
    push();
    window.addEventListener('nagrik:reports-changed', push);
    return () => window.removeEventListener('nagrik:reports-changed', push);
  }

  watchActivity(onChange: (events: ActivityEvent[]) => void): () => void {
    const push = () => onChange(readActivity());
    push();
    window.addEventListener('nagrik:activity-changed', push);
    return () => window.removeEventListener('nagrik:activity-changed', push);
  }

  // Offline/local mode has no server-side embedding comparison, so
  // `embedding` is accepted (to satisfy the shared interface) but
  // unused — matches this repository's existing GPS-only behavior.
  async findNearbyOpenReports(lat: number, lng: number, radiusMeters = 30, _embedding?: number[] | null): Promise<ReportModel[]> {
    const box = boxAround(lat, lng, radiusMeters);
    return this.annotate(
      readReports().filter(
        (r) =>
          r.status === 'open' &&
          r.lat >= box.minLat &&
          r.lat <= box.maxLat &&
          r.lng >= box.minLng &&
          r.lng <= box.maxLng &&
          distanceMeters(lat, lng, r.lat, r.lng) <= radiusMeters,
      ),
    );
  }

  async createReport(report: Omit<ReportModel, 'id'>): Promise<string> {
    const id = crypto.randomUUID();
    const full: ReportModel = { ...report, id };
    writeReports([...readReports(), full]);
    logActivity('created', full);
    return id;
  }

  async confirmAsDuplicate(reportId: string): Promise<void> {
    if (this.currentUid) {
      if (hasVotedEither(this.currentUid, reportId)) throw new AlreadyVotedError();
      recordVote(this.currentUid, reportId, 'confirm');
    }
    const all = readReports();
    const idx = all.findIndex((r) => r.id === reportId);
    if (idx >= 0) {
      all[idx] = { ...all[idx], upvotes: all[idx].upvotes + 1 };
      writeReports(all);
      logActivity('confirmed', all[idx]);
    }
  }

  async flagReport(reportId: string): Promise<void> {
    if (this.currentUid) {
      if (hasVotedEither(this.currentUid, reportId)) throw new AlreadyVotedError();
      recordVote(this.currentUid, reportId, 'flag');
    }
    const all = readReports();
    const idx = all.findIndex((r) => r.id === reportId);
    if (idx < 0) return;
    const updated = { ...all[idx], flagCount: all[idx].flagCount + 1 };
    logActivity('flagged', updated);

    if (updated.status === 'open' && crossesRemovalThreshold(updated)) {
      updated.status = 'pending_review';
      logActivity('pending_review', updated, `score ${updated.upvotes - updated.flagCount}`);
    }
    all[idx] = updated;
    writeReports(all);
  }

  async deleteReport(reportId: string): Promise<void> {
    const all = readReports();
    const target = all.find((r) => r.id === reportId);
    if (!target) return;
    if (this.currentUid && target.reporterId !== this.currentUid) {
      throw new Error('You can only delete your own reports');
    }
    writeReports(all.filter((r) => r.id !== reportId));
    const events = readActivity().filter((e) => e.reportId !== reportId);
    writeActivity(events);
  }

  async moderatorDecide(reportId: string, action: ModeratorAction): Promise<void> {
    const all = readReports();
    const idx = all.findIndex((r) => r.id === reportId);
    if (idx < 0) return;
    if (action === 'remove') {
      all[idx] = { ...all[idx], status: 'removed' };
      logActivity('removed', all[idx]);
    } else {
      all[idx] = { ...all[idx], status: 'open', flagCount: 0 };
      logActivity('restored', all[idx]);
    }
    writeReports(all);
  }

  async markResolved(reportId: string): Promise<void> {
    const all = readReports();
    const idx = all.findIndex((r) => r.id === reportId);
    if (idx >= 0) {
      all[idx] = { ...all[idx], status: 'resolved' };
      writeReports(all);
      logActivity('resolved', all[idx]);
    }
  }

  async confirmCategory(reportId: string, category: ReportCategory): Promise<void> {
    const all = readReports();
    const idx = all.findIndex((r) => r.id === reportId);
    if (idx >= 0) {
      all[idx] = { ...all[idx], category, userConfirmed: true };
      writeReports(all);
    }
  }
}

export class HttpReportsRepository implements ReportsRepository {
  constructor(
    private baseUrl: string,
    private authToken?: string
  ) {}

  private getHeaders(): Record<string, string> {
    const headers: Record<string, string> = { 'Content-Type': 'application/json' };
    if (this.authToken) {
      headers.Authorization = `Bearer ${this.authToken}`;
    }
    return headers;
  }

  private poll<T>(url: string, onChange: (data: T) => void): () => void {
    let cancelled = false;
    const tick = async () => {
      try {
        const res = await fetch(url, { headers: this.getHeaders() });
        const data = (await res.json()) as T;
        if (!cancelled) onChange(data);
      } catch {
        /* network hiccup — next poll retries */
      }
    };
    tick();
    const interval = setInterval(tick, 8000);
    return () => {
      cancelled = true;
      clearInterval(interval);
    };
  }

  watchOpenReports(onChange: (reports: ReportModel[]) => void): () => void {
    return this.poll(`${this.baseUrl}/api/reports?status=open`, onChange);
  }
  watchMyReports(uid: string, onChange: (reports: ReportModel[]) => void): () => void {
    return this.poll(`${this.baseUrl}/api/reports?reporterId=${encodeURIComponent(uid)}`, onChange);
  }
  watchPendingReview(onChange: (reports: ReportModel[]) => void): () => void {
    return this.poll(`${this.baseUrl}/api/reports?status=pending_review`, onChange);
  }
  watchActivity(onChange: (events: ActivityEvent[]) => void): () => void {
    return this.poll(`${this.baseUrl}/api/activity`, onChange);
  }

  async findNearbyOpenReports(lat: number, lng: number, radiusMeters = 30, embedding?: number[] | null): Promise<ReportModel[]> {
    // With an embedding available, use /nearby-similar so results come
    // back ranked by actual visual similarity (not just distance) —
    // see reports.ts for why that matters (two different potholes a
    // few meters apart shouldn't be treated as the same report).
    // Falls back to plain GPS-only /nearby when no embedding was
    // produced (ai-service unreachable, or offline).
    const url = embedding
      ? `${this.baseUrl}/api/reports/nearby-similar?lat=${lat}&lng=${lng}&radius=${radiusMeters}&embedding=${encodeURIComponent(JSON.stringify(embedding))}`
      : `${this.baseUrl}/api/reports/nearby?lat=${lat}&lng=${lng}&radius=${radiusMeters}`;
    const res = await fetch(url, { headers: this.getHeaders() });
    if (!res.ok) throw new Error('Nearby lookup failed');
    return (await res.json()) as ReportModel[];
  }

  async createReport(report: Omit<ReportModel, 'id'>): Promise<string> {
    const res = await fetch(`${this.baseUrl}/api/reports`, {
      method: 'POST',
      headers: this.getHeaders(),
      body: JSON.stringify(report),
    });
    if (!res.ok) throw new Error('Create report failed');
    return ((await res.json()) as { id: string }).id;
  }

  async confirmAsDuplicate(reportId: string): Promise<void> {
    const res = await fetch(`${this.baseUrl}/api/reports/${reportId}/confirm`, { method: 'POST', headers: this.getHeaders() });
    if (res.status === 409) throw new AlreadyVotedError();
    if (!res.ok) throw new Error('Confirm failed');
  }
  async flagReport(reportId: string): Promise<void> {
    const res = await fetch(`${this.baseUrl}/api/reports/${reportId}/flag`, { method: 'POST', headers: this.getHeaders() });
    if (res.status === 409) throw new AlreadyVotedError();
    if (!res.ok) throw new Error('Flag failed');
  }
  async deleteReport(reportId: string): Promise<void> {
    const res = await fetch(`${this.baseUrl}/api/reports/${reportId}`, { method: 'DELETE', headers: this.getHeaders() });
    if (!res.ok) {
      const body = await res.json().catch(() => ({}));
      throw new Error(body.error ?? 'Delete failed');
    }
  }
  async moderatorDecide(reportId: string, action: ModeratorAction): Promise<void> {
    await fetch(`${this.baseUrl}/api/reports/${reportId}/moderate`, {
      method: 'POST',
      headers: this.getHeaders(),
      body: JSON.stringify({ action }),
    });
  }
  async markResolved(reportId: string): Promise<void> {
    await fetch(`${this.baseUrl}/api/reports/${reportId}/resolve`, { method: 'POST', headers: this.getHeaders() });
  }
  async confirmCategory(reportId: string, category: ReportCategory): Promise<void> {
    await fetch(`${this.baseUrl}/api/reports/${reportId}/category`, {
      method: 'PATCH',
      headers: this.getHeaders(),
      body: JSON.stringify({ category }),
    });
  }
}

export function createReportsRepository(authToken?: string, uid?: string): ReportsRepository {
  const apiBase = import.meta.env.VITE_API_BASE_URL as string | undefined;
  return apiBase ? new HttpReportsRepository(apiBase, authToken) : new LocalReportsRepository(uid);
}
