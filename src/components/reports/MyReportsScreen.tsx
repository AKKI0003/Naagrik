import { useEffect, useState } from 'react';
import {
  AGE_META,
  ageFromDays,
  CATEGORY_META,
  reportAgeInDays,
  STATUS_META,
  type ReportModel,
} from '../../types/report';
import type { ReportsRepository } from '../../services/reportsRepository';
import { ReportDetailViewer } from './ReportDetailViewer';
import { SmoothScrollArea } from '../ui/SmoothScrollProvider';
import { Reveal, SpotlightCard } from '../../lib/motionPrimitives';

interface Props {
  repository: ReportsRepository;
  uid: string;
}

/** Ported from the Flutter version's MyReportsScreen (itself adapted
 * from spidertrack's JournalScreen/ActivityPanel) — a timeline of your
 * own reports, newest first. Deliberately shows every status (open,
 * under review, resolved, removed) — a flagged/removed report stays
 * visible here to its reporter with a status badge even after it's
 * pulled from the public map, so the person who filed it always knows
 * what happened to it. */
export function MyReportsScreen({ repository, uid }: Props) {
  const [reports, setReports] = useState<ReportModel[] | null>(null);
  const [selected, setSelected] = useState<ReportModel | null>(null);

  useEffect(() => repository.watchMyReports(uid, setReports), [repository, uid]);

  const sorted = [...(reports ?? [])].sort((a, b) => (b.createdAt ?? 0) - (a.createdAt ?? 0));
  const openCount = sorted.filter((r) => r.status === 'open').length;
  const reviewCount = sorted.filter((r) => r.status === 'pending_review').length;
  const resolvedCount = sorted.filter((r) => r.status === 'resolved').length;

  return (
    <SmoothScrollArea className="h-full overflow-y-auto px-4 pb-24 pt-5 sm:px-6">
      <div className="mx-auto max-w-2xl">
        <h1 className="text-2xl font-extrabold text-white">My Reports</h1>
        <p className="mt-1 text-[13px] text-muted">Every issue you've reported, and what happened to it.</p>

        {reports !== null && sorted.length > 0 && (
          <div className="mt-4 grid grid-cols-3 gap-2.5">
            <SummaryPip label="Open" value={openCount} color="#4DD9E8" />
            <SummaryPip label="In Review" value={reviewCount} color="#D9AF52" />
            <SummaryPip label="Resolved" value={resolvedCount} color="#6FCF97" />
          </div>
        )}

        <div className="mt-5 flex flex-col gap-2.5">
          {reports === null ? (
            Array.from({ length: 3 }).map((_, i) => <SkeletonCard key={i} />)
          ) : sorted.length === 0 ? (
            <EmptyState />
          ) : (
            sorted.map((r, i) => (
              <Reveal key={r.id} delay={Math.min(i, 6) * 0.05}>
                <ReportCard report={r} onClick={() => setSelected(r)} />
              </Reveal>
            ))
          )}
        </div>
      </div>

      {selected && (
        <ReportDetailViewer report={selected} repository={repository} onClose={() => setSelected(null)} currentUid={uid} />
      )}
    </SmoothScrollArea>
  );
}

function SummaryPip({ label, value, color }: { label: string; value: number; color: string }) {
  return (
    <div className="rounded-xl border border-cyanDark/30 bg-panel px-3 py-2.5 text-center">
      <div className="text-lg font-extrabold" style={{ color }}>{value}</div>
      <div className="text-[10.5px] text-muted">{label}</div>
    </div>
  );
}

function SkeletonCard() {
  return <div className="nagrik-skeleton h-[76px] rounded-2xl" />;
}

function EmptyState() {
  return (
    <div className="flex flex-col items-center gap-3 rounded-2xl border border-dashed border-cyanDark/40 py-16 text-center">
      <svg width="46" height="46" viewBox="0 0 24 24" fill="none" stroke="#4DD9E8" strokeWidth="1.4">
        <path d="M9 20l-5.447-2.724A1 1 0 013 16.382V5.618a1 1 0 011.447-.894L9 7m0 13l6-3m-6 3V7m6 10l4.553 2.276A1 1 0 0021 18.382V7.618a1 1 0 00-.553-.894L15 4m0 13V4m0 0L9 7" />
      </svg>
      <p className="text-[16px] font-bold text-white">No reports yet</p>
      <p className="max-w-xs text-[13px] leading-relaxed text-muted">
        Tap <span className="font-semibold text-cyan">Report</span> on the map to log your first civic issue — it'll show up here.
      </p>
    </div>
  );
}

function ReportCard({ report, onClick }: { report: ReportModel; onClick: () => void }) {
  const meta = CATEGORY_META[report.category];
  const age = AGE_META[ageFromDays(reportAgeInDays(report.createdAt))];
  const status = STATUS_META[report.status];
  return (
    <SpotlightCard
      onClick={onClick}
      className="flex w-full cursor-pointer items-center gap-3 rounded-2xl border p-3.5 text-left shadow-panel"
      style={{ borderColor: `${status.hex}55`, backgroundColor: '#0D1B2A' }}
      spotlightColor={`${status.hex}22`}
    >
      <span
        className="flex h-12 w-12 shrink-0 items-center justify-center rounded-full text-[11px] font-bold text-bg"
        style={{ backgroundColor: meta.hex, boxShadow: `0 0 10px ${meta.hex}55` }}
      >
        {meta.icon}
      </span>
      <span className="min-w-0 flex-1">
        <span className="block text-[14px] font-bold text-white">{meta.label}</span>
        <span className="mt-0.5 flex items-center gap-1.5 text-[11.5px] text-muted">
          {report.createdAt ? new Date(report.createdAt).toLocaleDateString(undefined, { month: 'short', day: 'numeric' }) : ''}
          <span>·</span>
          <span>{report.upvotes} confirm{report.upvotes === 1 ? '' : 's'}</span>
          {report.flagCount > 0 && (
            <>
              <span>·</span>
              <span className="text-danger">{report.flagCount} flag{report.flagCount === 1 ? '' : 's'}</span>
            </>
          )}
        </span>
      </span>
      <div className="flex shrink-0 flex-col items-end gap-1">
        <span
          className="rounded-full border px-2.5 py-1 text-[10.5px] font-bold"
          style={{ borderColor: status.hex, backgroundColor: `${status.hex}26`, color: status.hex }}
        >
          {status.label}
        </span>
        {report.status === 'open' && (
          <span className="text-[10px] font-medium" style={{ color: age.hex }}>{age.label}</span>
        )}
      </div>
    </SpotlightCard>
  );
}