import { useEffect, useState } from 'react';
import { CATEGORY_META, netScore, reportAgeInDays, type ReportModel } from '../../types/report';
import { Button } from '../ui/Button';
import { useConfirmDialog, useToast } from '../ui/Dialog';
import type { ReportsRepository } from '../../services/reportsRepository';

interface Props {
  repository: ReportsRepository;
}

/**
 * The moderation queue: reports whose netScore (confirms − flags) has
 * crossed the -3 threshold land here, pulled from the public map, and
 * wait for a human moderator's final decision — remove for good, or
 * restore to the public map. Automation suggests, a person decides;
 * same principle as the classification pipeline, applied to moderation.
 */
export function ModerationScreen({ repository }: Props) {
  const [reports, setReports] = useState<ReportModel[] | null>(null);
  const confirmDialog = useConfirmDialog();
  const toast = useToast();

  useEffect(() => repository.watchPendingReview(setReports), [repository]);

  async function decide(report: ReportModel, action: 'remove' | 'restore') {
    if (action === 'remove') {
      const ok = await confirmDialog({
        title: 'Remove this report?',
        message: 'This permanently removes it from the map. This cannot be undone from here.',
        confirmLabel: 'Remove',
        confirmColor: '#E85D5D',
      });
      if (!ok) return;
    }
    await repository.moderatorDecide(report.id, action);
    toast.show(
      action === 'remove' ? 'Report removed.' : 'Report restored to the public map.',
      action === 'remove' ? '#E85D5D' : '#6FCF97',
    );
  }

  return (
    <div className="h-full overflow-y-auto px-4 pb-24 pt-5 sm:px-6">
      <div className="mx-auto max-w-2xl">
        <div className="flex items-center gap-2.5">
          <h1 className="text-2xl font-extrabold text-white">Moderation Queue</h1>
          {reports && reports.length > 0 && (
            <span className="flex h-6 min-w-6 items-center justify-center rounded-full bg-gold px-1.5 text-[12px] font-bold text-bg">
              {reports.length}
            </span>
          )}
        </div>
        <p className="mt-1 text-[13px] text-muted">
          Reports whose confirm/flag score dropped to −3 or below. They're off the public map until you decide.
        </p>

        <div className="mt-5 flex flex-col gap-3">
          {reports === null ? (
            Array.from({ length: 2 }).map((_, i) => <div key={i} className="nagrik-skeleton h-40 rounded-2xl" />)
          ) : reports.length === 0 ? (
            <div className="flex flex-col items-center gap-3 rounded-2xl border border-dashed border-cyanDark/40 py-16 text-center">
              <svg width="42" height="42" viewBox="0 0 24 24" fill="none" stroke="#6FCF97" strokeWidth="1.4">
                <path d="M9 12l2 2 4-4m5 2a9 9 0 11-18 0 9 9 0 0118 0z" />
              </svg>
              <p className="text-[16px] font-bold text-white">Queue is empty</p>
              <p className="max-w-xs text-[13px] text-muted">Nothing is currently awaiting review.</p>
            </div>
          ) : (
            reports.map((r) => <QueueCard key={r.id} report={r} onDecide={decide} />)
          )}
        </div>
      </div>
    </div>
  );
}

function QueueCard({ report, onDecide }: { report: ReportModel; onDecide: (r: ReportModel, a: 'remove' | 'restore') => void }) {
  const meta = CATEGORY_META[report.category];
  const score = netScore(report);
  const ageDays = reportAgeInDays(report.createdAt);

  return (
    <div className="nagrik-fade-in overflow-hidden rounded-2xl border border-gold/40 bg-panel shadow-panel">
      <div className="flex items-center gap-3 border-b border-cyanDark/25 px-4 py-3">
        <span className="flex h-10 w-10 items-center justify-center rounded-full text-[11px] font-bold text-bg" style={{ backgroundColor: meta.hex }}>
          {meta.icon}
        </span>
        <div className="min-w-0 flex-1">
          <p className="text-[14px] font-bold text-white">{meta.label}</p>
          <p className="text-[11.5px] text-muted">{ageDays}d old · reporter {report.reporterId.slice(0, 8)}</p>
        </div>
        <span className="rounded-full border border-danger/60 bg-danger/10 px-2.5 py-1 text-[11px] font-bold text-danger">
          score {score}
        </span>
      </div>

      {report.photoUrl && <img src={report.photoUrl} alt={meta.label} className="h-40 w-full object-cover" />}

      <div className="flex items-center gap-3 px-4 py-3 text-[12.5px]">
        <span className="text-catWaste">{report.upvotes} confirm{report.upvotes === 1 ? '' : 's'}</span>
        <span className="text-muted">·</span>
        <span className="text-danger">{report.flagCount} flag{report.flagCount === 1 ? '' : 's'}</span>
      </div>

      <div className="flex gap-2.5 px-4 pb-4">
        <Button label="Restore" outlined color="#6FCF97" fullWidth onClick={() => onDecide(report, 'restore')} />
        <Button label="Remove" outlined color="#E85D5D" fullWidth onClick={() => onDecide(report, 'remove')} />
      </div>
    </div>
  );
}
