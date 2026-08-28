import { Router } from 'express';
import { pool, rowToReport, LAT_LNG_SELECT } from '../db/pool.ts';
import { requireAuth } from './auth.ts';

export const usersRouter = Router();

/**
 * GET /api/users/me/stats
 * Powers the Account screen: how many reports this user has filed,
 * how much upvote/flag activity those reports have received, and
 * which reports THEY have flagged (report_flags is per-user, so this
 * is the only place that list can come from).
 */
usersRouter.get('/me/stats', requireAuth, async (req, res) => {
  const userId = req.user.id;

  const { rows: ownedRows } = await pool.query(
    `SELECT
       COUNT(*)::int AS reports_submitted,
       COALESCE(SUM(upvotes), 0)::int AS upvotes_received,
       COALESCE(SUM(flag_count), 0)::int AS flags_received,
       COUNT(*) FILTER (WHERE status = 'removed')::int AS reports_removed,
       COUNT(*) FILTER (WHERE status = 'pending_review')::int AS reports_pending_review
     FROM reports
     WHERE reporter_id = $1`,
    [userId],
  );

  const { rows: flaggedRows } = await pool.query(
    `SELECT r.id, r.reporter_id, ${LAT_LNG_SELECT}, r.photo_url, r.photo_object_key, r.category,
            r.model_confidence, r.user_confirmed, r.created_at, r.status, r.upvotes, r.flag_count, r.merged_into_id,
            rf.created_at AS "flaggedAt"
     FROM report_flags rf
     JOIN reports r ON r.id = rf.report_id
     WHERE rf.user_id = $1
     ORDER BY rf.created_at DESC
     LIMIT 200`,
    [userId],
  );

  const stats = ownedRows[0];
  res.json({
    reportsSubmitted: stats.reports_submitted,
    upvotesReceived: stats.upvotes_received,
    flagsReceived: stats.flags_received,
    reportsRemoved: stats.reports_removed,
    reportsPendingReview: stats.reports_pending_review,
    reportsFlaggedByMe: flaggedRows.length,
    flaggedReports: flaggedRows.map((r) => ({ ...rowToReport(r), flaggedAt: new Date(r.flaggedAt).getTime() })),
  });
});
