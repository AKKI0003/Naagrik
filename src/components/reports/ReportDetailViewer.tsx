import {
  AGE_META,
  ageFromDays,
  CATEGORY_META,
  crossesRemovalThreshold,
  netScore,
  reportAgeInDays,
  STATUS_META,
  type ReportModel,
} from '../../types/report';
import { Button } from '../ui/Button';
import { useConfirmDialog, useToast } from '../ui/Dialog';
import { AlreadyVotedError, type ReportsRepository } from '../../services/reportsRepository';

interface Props {
  report: ReportModel;
  repository: ReportsRepository;
  onClose: () => void;
  /** Current signed-in user's id, so the viewer can offer a Delete
   * action only to the person who actually filed the report. */
  currentUid?: string;
}

/** Ported from the Flutter version's ReportDetailViewer (itself adapted
 * from spidertrack's PhotoPinViewer) — now also surfaces the net-score
 * breakdown (confirms − flags) so the moderation math is visible, not
 * a black box, and reflects the fuller status set (open / under review
 * / resolved / removed) instead of just open/hidden. */
export function ReportDetailViewer({ report, repository, onClose, currentUid }: Props) {
  const meta = CATEGORY_META[report.category];
  const ageDays = reportAgeInDays(report.createdAt);
  const age = AGE_META[ageFromDays(ageDays)];
  const status = STATUS_META[report.status];
  const score = netScore(report);
  const confirmDialog = useConfirmDialog();
  const toast = useToast();

  const isActionable = report.status === 'open';
  const isOwner = !!currentUid && report.reporterId === currentUid;
  // Confirm and flag are mutually exclusive — one vote per account,
  // either kind — so both buttons disable as soon as either is set.
  const hasVoted = !!report.hasConfirmed || !!report.hasFlagged;

  async function flag() {
    if (hasVoted) {
      toast.show('You already voted on this report.', '#E85D5D');
      return;
    }
    const willCross = crossesRemovalThreshold({ upvotes: report.upvotes, flagCount: report.flagCount + 1 });
    const ok = await confirmDialog({
      title: 'Flag this report?',
      message: willCross
        ? "This will push the report's score to the moderation threshold. It will be pulled from the public map and sent to a moderator for a final decision — it won't be deleted automatically."
        : "Flag if this doesn't look like a real civic issue. A report only goes to moderator review once its confirm/flag balance drops low enough — one flag alone won't remove it.",
      confirmLabel: 'Flag',
      confirmColor: '#E85D5D',
    });
    if (!ok) return;
    try {
      await repository.flagReport(report.id);
      toast.show(
        willCross ? 'Flagged — sent to a moderator for review.' : 'Flagged.',
        willCross ? '#D9AF52' : '#E85D5D',
      );
      onClose();
    } catch (err) {
      if (err instanceof AlreadyVotedError) toast.show(err.message, '#E85D5D');
      else toast.show('Could not flag this report.', '#E85D5D');
    }
  }

  async function confirm() {
    if (hasVoted) {
      toast.show('You already voted on this report.', '#6FCF97');
      return;
    }
    try {
      await repository.confirmAsDuplicate(report.id);
      toast.success('Confirmed.');
    } catch (err) {
      if (err instanceof AlreadyVotedError) toast.show(err.message, '#6FCF97');
      else toast.show('Could not confirm this report.', '#E85D5D');
    }
  }

  async function remove() {
    const ok = await confirmDialog({
      title: 'Delete this report?',
      message: 'This permanently removes the report, its photo reference, and its activity history. This cannot be undone.',
      confirmLabel: 'Delete',
      confirmColor: '#E85D5D',
    });
    if (!ok) return;
    try {
      await repository.deleteReport(report.id);
      toast.show('Report deleted.', '#E85D5D');
      onClose();
    } catch (err) {
      toast.show(err instanceof Error ? err.message : 'Could not delete this report.', '#E85D5D');
    }
  }

  return (
    <div className="fixed inset-0 z-[1100] flex items-end justify-center bg-black/60 sm:items-center" onClick={onClose}>
      <div
        className="max-h-[85vh] w-full max-w-lg overflow-y-auto rounded-t-[24px] border-t border-cyanDark/40 bg-panel p-5 pb-8 shadow-panel sm:rounded-[24px] sm:border"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="mx-auto mb-4 h-1 w-10 rounded-full bg-mutedDark sm:hidden" />

        {report.photoUrl ? (
          <img src={report.photoUrl} alt={meta.label} className="h-52 w-full rounded-2xl object-cover" />
        ) : (
          <div className="flex h-36 items-center justify-center rounded-2xl" style={{ backgroundColor: '#0B1926' }}>
            <span className="text-3xl font-bold" style={{ color: meta.hex }}>
              {meta.icon}
            </span>
          </div>
        )}

        <div className="mt-4 flex items-center gap-2.5">
          <span className="flex h-9 w-9 items-center justify-center rounded-full text-[11px] font-bold text-bg shadow-glowCyan" style={{ backgroundColor: meta.hex, boxShadow: `0 0 12px ${meta.hex}66` }}>
            {meta.icon}
          </span>
          <h3 className="flex-1 text-[16px] font-bold text-white">{meta.label}</h3>
          <span
            className="rounded-full border px-2.5 py-1 text-[11px] font-bold"
            style={{ borderColor: status.hex, backgroundColor: `${status.hex}26`, color: status.hex }}
          >
            {status.label}
          </span>
        </div>

        {report.createdAt && (
          <p className="mt-2 text-[12.5px] text-muted">
            Reported {new Date(report.createdAt).toLocaleDateString(undefined, { year: 'numeric', month: 'short', day: 'numeric' })} · {ageDays}d ago
            <span className="mx-1.5">·</span>
            <span className="rounded px-1.5 py-0.5" style={{ backgroundColor: `${age.hex}22`, color: age.hex }}>{age.label}</span>
          </p>
        )}

        {report.description && (
          <p className="mt-3 text-[13.5px] leading-relaxed text-white/90">{report.description}</p>
        )}

        {/* Net-score breakdown — makes the confirm/flag math visible
            instead of a black box, directly showing the formula:
            netScore = confirms - flags, moderation kicks in at -3. */}
        <div className="mt-4 flex items-center gap-3 rounded-xl border border-cyanDark/30 bg-panelAlt px-3.5 py-2.5">
          <ScorePip label="Confirms" value={report.upvotes} color="#6FCF97" />
          <span className="text-muted">−</span>
          <ScorePip label="Flags" value={report.flagCount} color="#E85D5D" />
          <span className="text-muted">=</span>
          <ScorePip label="Score" value={score} color={score <= -3 ? '#E85D5D' : '#4DD9E8'} bold />
        </div>

        {report.status === 'pending_review' && (
          <div className="mt-3 rounded-lg border px-3 py-2.5" style={{ borderColor: '#D9AF5266', backgroundColor: '#D9AF5214' }}>
            <p className="text-xs leading-relaxed" style={{ color: '#D9AF52' }}>
              This report's score crossed the moderation threshold and is awaiting a moderator's final decision. It won't show on the public map until then.
            </p>
          </div>
        )}
        {report.status === 'removed' || report.status === 'hidden' ? (
          <div className="mt-3 rounded-lg border px-3 py-2.5" style={{ borderColor: '#E85D5D66', backgroundColor: '#E85D5D14' }}>
            <p className="text-xs leading-relaxed text-danger">A moderator reviewed this report and removed it.</p>
          </div>
        ) : null}

        {isActionable && (
          <div className="mt-5 flex gap-2.5">
            <Button
              label={report.hasConfirmed ? 'Confirmed' : `Confirm (${report.upvotes})`}
              outlined
              color="#6FCF97"
              fullWidth
              disabled={hasVoted}
              onClick={confirm}
            />
            <Button
              label={report.hasFlagged ? 'Flagged' : `Flag (${report.flagCount})`}
              outlined
              color="#E85D5D"
              fullWidth
              disabled={hasVoted}
              onClick={flag}
            />
          </div>
        )}

        {isOwner && (
          <div className="mt-2.5">
            <Button label="Delete my report" outlined color="#E85D5D" fullWidth onClick={remove} />
          </div>
        )}
      </div>
    </div>
  );
}

function ScorePip({ label, value, color, bold }: { label: string; value: number; color: string; bold?: boolean }) {
  return (
    <div className="flex flex-1 flex-col items-center">
      <span className={`text-[15px] ${bold ? 'font-extrabold' : 'font-bold'}`} style={{ color }}>
        {value > 0 && bold ? `+${value}` : value}
      </span>
      <span className="text-[10px] text-muted">{label}</span>
    </div>
  );
}
