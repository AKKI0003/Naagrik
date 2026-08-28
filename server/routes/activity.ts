import { Router } from 'express';
import { pool } from '../db/pool.ts';

export const activityRouter = Router();

/** GET /api/activity — powers the Activity tab. Newest first, capped
 * at 300 so this stays a fast, cheap endpoint to poll (same 300-item
 * cap as the LocalReportsRepository, for consistent behavior between
 * the localStorage demo mode and the real backend). */
activityRouter.get('/', async (_req, res) => {
  const { rows } = await pool.query(
    `SELECT id, type, report_id AS "reportId", category, at, meta
     FROM activity_log
     ORDER BY at DESC
     LIMIT 300`,
  );
  res.json(rows.map((r) => ({ ...r, at: new Date(r.at).getTime() })));
});

/** Shared insert helper used by routes/reports.js on every state
 * change — accepts an optional `client` so it can participate in the
 * same transaction as the report update it's logging (see the flag
 * route, where the flag count update and the resulting pending_review
 * transition must commit or roll back together). */
export async function logActivity(type, reportId, category, meta, client) {
  const runner = client ?? pool;
  await runner.query(
    `INSERT INTO activity_log (type, report_id, category, meta) VALUES ($1, $2, $3, $4)`,
    [type, reportId, category, meta ?? null],
  );
}
