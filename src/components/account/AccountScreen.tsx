import { useEffect, useState } from 'react';
import { useAuth } from '../../hooks/useAuth';
import { api, type AccountStats } from '../../services/api';
import { CATEGORY_META, STATUS_META, type ReportModel } from '../../types/report';
import { Button } from '../ui/Button';
import { SmoothScrollArea } from '../ui/SmoothScrollProvider';
import { Reveal, SpotlightCard, staggerContainer, staggerItem } from '../../lib/motionPrimitives';
import { motion } from 'framer-motion';

/**
 * Account tab: who you are, a sign-out control, and the numbers people
 * asked for — how many reports you've filed, how much confirm/flag
 * activity they've drawn, and which reports you personally flagged.
 * The flagged-reports list only exists against the real backend
 * (report_flags is per-user); the localStorage demo mode has no way
 * to know which reports you flagged, so it degrades to "unavailable".
 */
export function AccountScreen() {
  const { user, logout } = useAuth();
  const [stats, setStats] = useState<AccountStats | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loggingOut, setLoggingOut] = useState(false);
  const [selected, setSelected] = useState<ReportModel | null>(null);

  useEffect(() => {
    let cancelled = false;
    api
      .getMyStats()
      .then((s) => {
        if (!cancelled) setStats(s);
      })
      .catch(() => {
        if (!cancelled) setError('Account stats need the live backend (VITE_API_BASE_URL) — not available in local demo mode.');
      });
    return () => {
      cancelled = true;
    };
  }, []);

  async function handleLogout() {
    setLoggingOut(true);
    try {
      await logout();
    } finally {
      setLoggingOut(false);
    }
  }

  if (!user) return null;

  const initial = (user.displayName ?? user.email).trim().charAt(0).toUpperCase();

  return (
    <SmoothScrollArea className="h-full overflow-y-auto px-4 pb-24 pt-5 sm:px-6">
      <div className="mx-auto max-w-2xl">
        <h1 className="text-2xl font-extrabold text-white">Account</h1>
        <p className="mt-1 text-[13px] text-muted">Your profile, and how your reports have done.</p>

        {/* Profile card */}
        <Reveal className="mt-5 flex items-center gap-3.5 rounded-2xl border border-cyanDark/30 bg-panel p-4">
          <span className="flex h-12 w-12 shrink-0 items-center justify-center rounded-full bg-cyan/15 text-[18px] font-extrabold text-cyan">
            {initial}
          </span>
          <div className="min-w-0 flex-1">
            <p className="truncate text-[15px] font-bold text-white">{user.displayName ?? 'Unnamed reporter'}</p>
            <p className="truncate text-[12.5px] text-muted">{user.email}</p>
          </div>
          {user.isModerator && (
            <span className="shrink-0 rounded-full border border-gold/50 bg-gold/15 px-2.5 py-1 text-[10.5px] font-bold text-gold">
              Moderator
            </span>
          )}
        </Reveal>

        {/* Stats */}
        {error ? (
          <p className="mt-5 rounded-xl border border-gold/40 bg-gold/10 px-3.5 py-3 text-[12.5px] leading-relaxed text-gold">{error}</p>
        ) : !stats ? (
          <div className="mt-5 grid grid-cols-2 gap-2.5">
            {Array.from({ length: 4 }).map((_, i) => (
              <div key={i} className="nagrik-skeleton h-[72px] rounded-xl" />
            ))}
          </div>
        ) : (
          <>
            <motion.div
              variants={staggerContainer}
              initial="hidden"
              animate="show"
              className="mt-5 grid grid-cols-2 gap-2.5"
            >
              <motion.div variants={staggerItem}><StatTile label="Reports submitted" value={stats.reportsSubmitted} color="#4DD9E8" /></motion.div>
              <motion.div variants={staggerItem}><StatTile label="Confirms received" value={stats.upvotesReceived} color="#6FCF97" /></motion.div>
              <motion.div variants={staggerItem}><StatTile label="Flags received" value={stats.flagsReceived} color="#E85D5D" /></motion.div>
              <motion.div variants={staggerItem}><StatTile label="Reports you've flagged" value={stats.reportsFlaggedByMe} color="#D9AF52" /></motion.div>
            </motion.div>

            {(stats.reportsRemoved > 0 || stats.reportsPendingReview > 0) && (
              <p className="mt-2.5 text-[11.5px] text-muted">
                {stats.reportsPendingReview > 0 && <>{stats.reportsPendingReview} of your reports {stats.reportsPendingReview === 1 ? 'is' : 'are'} under moderator review. </>}
                {stats.reportsRemoved > 0 && <>{stats.reportsRemoved} {stats.reportsRemoved === 1 ? 'was' : 'were'} removed by a moderator.</>}
              </p>
            )}

            {/* Reports flagged by me */}
            <h2 className="mt-6 text-[14px] font-bold text-white">Reports you've flagged</h2>
            {stats.flaggedReports.length === 0 ? (
              <p className="mt-2 text-[12.5px] text-muted">You haven't flagged any reports.</p>
            ) : (
              <motion.div
                variants={staggerContainer}
                initial="hidden"
                whileInView="show"
                viewport={{ once: true }}
                className="mt-3 flex flex-col gap-2.5"
              >
                {stats.flaggedReports.map((r) => (
                  <motion.div key={r.id} variants={staggerItem}>
                    <FlaggedCard report={r} onClick={() => setSelected(r)} />
                  </motion.div>
                ))}
              </motion.div>
            )}
          </>
        )}

        {/* Sign out */}
        <div className="mt-8 border-t border-cyanDark/20 pt-5">
          <Button label="Sign out" outlined loading={loggingOut} onClick={handleLogout} />
        </div>
      </div>

      {selected && <FlaggedDetail report={selected} onClose={() => setSelected(null)} />}
    </SmoothScrollArea>
  );
}

function StatTile({ label, value, color }: { label: string; value: number; color: string }) {
  return (
    <SpotlightCard className="rounded-xl border border-cyanDark/30 bg-panel px-3.5 py-3" spotlightColor={`${color}22`}>
      <div className="text-xl font-extrabold" style={{ color }}>{value}</div>
      <div className="mt-0.5 text-[11px] text-muted">{label}</div>
    </SpotlightCard>
  );
}

function FlaggedCard({ report, onClick }: { report: ReportModel & { flaggedAt: number }; onClick: () => void }) {
  const meta = CATEGORY_META[report.category];
  const status = STATUS_META[report.status];
  return (
    <SpotlightCard
      onClick={onClick}
      className="flex w-full cursor-pointer items-center gap-3 rounded-2xl border p-3 text-left shadow-panel"
      style={{ borderColor: `${status.hex}55`, backgroundColor: '#0D1B2A' }}
      spotlightColor={`${status.hex}22`}
    >
      {report.photoUrl ? (
        <img src={report.photoUrl} alt="" className="h-12 w-12 shrink-0 rounded-lg object-cover" />
      ) : (
        <span
          className="flex h-12 w-12 shrink-0 items-center justify-center rounded-full text-[11px] font-bold text-bg"
          style={{ backgroundColor: meta.hex }}
        >
          {meta.icon}
        </span>
      )}
      <span className="min-w-0 flex-1">
        <span className="block text-[13.5px] font-bold text-white">{meta.label}</span>
        <span className="mt-0.5 block text-[11.5px] text-muted">
          Flagged {new Date(report.flaggedAt).toLocaleDateString(undefined, { month: 'short', day: 'numeric' })}
        </span>
      </span>
      <span
        className="shrink-0 rounded-full border px-2.5 py-1 text-[10.5px] font-bold"
        style={{ borderColor: status.hex, backgroundColor: `${status.hex}26`, color: status.hex }}
      >
        {status.label}
      </span>
    </SpotlightCard>
  );
}

/** Minimal read-only detail popover — reuses no report actions since
 * this is someone else's report; just a bigger look at what you flagged. */
function FlaggedDetail({ report, onClose }: { report: ReportModel; onClose: () => void }) {
  const meta = CATEGORY_META[report.category];
  return (
    <div className="fixed inset-0 z-[1100] flex items-end justify-center bg-black/60 sm:items-center" onClick={onClose}>
      <div
        className="w-full max-w-md rounded-t-2xl border border-cyanDark/30 bg-panel p-5 sm:rounded-2xl"
        onClick={(e) => e.stopPropagation()}
      >
        {report.photoUrl && <img src={report.photoUrl} alt="" className="mb-3 h-48 w-full rounded-xl object-cover" />}
        <p className="text-[15px] font-bold text-white">{meta.label}</p>
        <p className="mt-1 text-[12.5px] text-muted">
          {report.upvotes} confirm{report.upvotes === 1 ? '' : 's'} · {report.flagCount} flag{report.flagCount === 1 ? '' : 's'}
        </p>
        <div className="mt-4">
          <Button label="Close" outlined onClick={onClose} />
        </div>
      </div>
    </div>
  );
}