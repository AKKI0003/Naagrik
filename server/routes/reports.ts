import { Router } from 'express';
import { pool, rowToReport, LAT_LNG_SELECT, myVoteSelect, cosineSimilarity } from '../db/pool.ts';
import { logActivity } from './activity.ts';
import { requireAuth, requireModerator, optionalAuth } from './auth.ts';

export const reportsRouter = Router();

const REMOVAL_THRESHOLD = -3; // netScore = upvotes - flagCount; see types/report.ts on the frontend for the same constant

reportsRouter.get('/', optionalAuth, async (req, res) => {
  const { status, reporterId } = req.query;
  const conditions = [];
  const params = [];

  if (status) {
    params.push(status);
    conditions.push(`status = $${params.length}`);
  }
  if (reporterId) {
    params.push(reporterId);
    conditions.push(`reporter_id = $${params.length}`);
  }
  params.push(req.user?.id ?? null);
  const callerIdIdx = params.length;

  const where = conditions.length ? `WHERE ${conditions.join(' AND ')}` : '';
  const { rows } = await pool.query(
    `SELECT id, reporter_id, ${LAT_LNG_SELECT}, photo_url, photo_object_key, category,
            model_confidence, description, user_confirmed, created_at, status, upvotes, flag_count, merged_into_id,
            ${myVoteSelect(callerIdIdx)}
     FROM reports ${where}
     ORDER BY created_at DESC
     LIMIT 500`,
    params,
  );
  res.json(rows.map(rowToReport));
});

/**
 * GET /api/reports/nearby?lat=..&lng=..&radius=30
 * PostGIS ST_DWithin on a GEOGRAPHY column — a real great-circle
 * distance check backed by the GIST index from schema.sql.
 */
reportsRouter.get('/nearby', optionalAuth, async (req, res) => {
  const lat = parseFloat(req.query.lat);
  const lng = parseFloat(req.query.lng);
  const radius = parseFloat(req.query.radius ?? '30');
  if (Number.isNaN(lat) || Number.isNaN(lng)) {
    return res.status(400).json({ error: 'lat and lng are required' });
  }

  const { rows } = await pool.query(
    `SELECT id, reporter_id, ${LAT_LNG_SELECT}, photo_url, photo_object_key, category,
            model_confidence, description, user_confirmed, created_at, status, upvotes, flag_count, merged_into_id,
            ${myVoteSelect(4)}
     FROM reports
     WHERE status = 'open'
       AND ST_DWithin(location, ST_MakePoint($1, $2)::geography, $3)
     ORDER BY created_at DESC`,
    [lng, lat, radius, req.user?.id ?? null],
  );
  res.json(rows.map(rowToReport));
});

reportsRouter.post('/', requireAuth, async (req, res) => {
  const b = req.body;
  if (typeof b.lat !== 'number' || typeof b.lng !== 'number' || !b.category) {
    return res.status(400).json({ error: 'lat, lng, and category are required' });
  }
  const { rows } = await pool.query(
    `INSERT INTO reports (reporter_id, location, photo_url, photo_object_key, category, model_confidence, description, user_confirmed, status, embedding)
     VALUES ($1, ST_MakePoint($2, $3)::geography, $4, $5, $6, $7, $8, $9, 'open', $10)
     RETURNING id`,
    [
      req.user.id,
      b.lng,
      b.lat,
      b.photoUrl ?? null,
      b.photoObjectKey ?? null,
      b.category,
      b.modelConfidence ?? 0,
      b.description ?? null,
      b.userConfirmed ?? false,
      Array.isArray(b.embedding) ? b.embedding : null,
    ],
  );
  const id = rows[0].id;
  await logActivity('created', id, b.category);
  res.status(201).json({ id });
});

/**
 * GET /api/reports/nearby-similar?lat=..&lng=..&radius=30&embedding=<json array>
 *
 * The real duplicate check: GPS proximity (same ST_DWithin as
 * /nearby) narrows the candidate set first — cheap, indexed, cuts a
 * city down to a few dozen nearby reports — then CLIP embedding
 * cosine similarity re-ranks *within* that set, so two different
 * potholes 15m apart no longer get flagged as the same report just
 * because they're close together. `similarity` is attached to each
 * result (0 when either side has no embedding, e.g. reports filed
 * before the AI service was wired up) so the frontend can show *why*
 * something was suggested instead of a bare distance guess.
 */
reportsRouter.get('/nearby-similar', optionalAuth, async (req, res) => {
  const lat = parseFloat(req.query.lat);
  const lng = parseFloat(req.query.lng);
  const radius = parseFloat(req.query.radius ?? '40');
  let embedding: number[] | null = null;
  if (typeof req.query.embedding === 'string') {
    try {
      const parsed = JSON.parse(req.query.embedding);
      if (Array.isArray(parsed)) embedding = parsed;
    } catch {
      /* malformed — treat as "no embedding", falls back to GPS-only ranking */
    }
  }
  if (Number.isNaN(lat) || Number.isNaN(lng)) {
    return res.status(400).json({ error: 'lat and lng are required' });
  }

  const { rows } = await pool.query(
    `SELECT id, reporter_id, ${LAT_LNG_SELECT}, photo_url, photo_object_key, category,
            model_confidence, description, user_confirmed, created_at, status, upvotes, flag_count, merged_into_id,
            embedding, ${myVoteSelect(4)}
     FROM reports
     WHERE status = 'open'
       AND ST_DWithin(location, ST_MakePoint($1, $2)::geography, $3)
     ORDER BY created_at DESC
     LIMIT 25`,
    [lng, lat, radius, req.user?.id ?? null],
  );

  const withSimilarity = rows
    .map((row) => ({ ...rowToReport(row), similarity: cosineSimilarity(embedding, row.embedding) }))
    .sort((a, b) => b.similarity - a.similarity);

  res.json(withSimilarity);
});

/** POST /api/reports/:id/confirm — records one confirm ("same issue"
 * duplicate confirmation or a direct upvote). A user gets exactly one
 * vote per report, period — confirm and flag are mutually exclusive,
 * not separately limited. So this checks report_flags too: if the
 * user already flagged this report, confirming is blocked (and vice
 * versa in /flag below) until a moderator resets things via restore. */
reportsRouter.post('/:id/confirm', requireAuth, async (req, res) => {
  const client = await pool.connect();
  try {
    await client.query('BEGIN');

    const { rows: existing } = await client.query(
      `SELECT 1 FROM report_confirms WHERE report_id = $1 AND user_id = $2
       UNION ALL
       SELECT 1 FROM report_flags WHERE report_id = $1 AND user_id = $2`,
      [req.params.id, req.user.id],
    );
    if (existing.length > 0) {
      await client.query('ROLLBACK');
      return res.status(409).json({ error: 'You have already voted on this report (confirm or flag counts as one vote)' });
    }

    await client.query('INSERT INTO report_confirms (report_id, user_id) VALUES ($1, $2)', [req.params.id, req.user.id]);

    const { rows } = await client.query(
      'UPDATE reports SET upvotes = upvotes + 1 WHERE id = $1 RETURNING category',
      [req.params.id],
    );
    if (!rows[0]) {
      await client.query('ROLLBACK');
      return res.status(404).json({ error: 'Report not found' });
    }
    await logActivity('confirmed', req.params.id, rows[0].category, undefined, client);
    await client.query('COMMIT');
    res.status(204).end();
  } catch (err) {
    await client.query('ROLLBACK');
    throw err;
  } finally {
    client.release();
  }
});

/**
 * POST /api/reports/:id/flag
 *
 * Implements the exact formula requested: netScore = upvotes − flags.
 * A flag never deletes anything by itself — crossing REMOVAL_THRESHOLD
 * only moves the report to `pending_review`, pulling it off the public
 * map (GET /?status=open no longer returns it) while it waits for a
 * moderator's decision via POST /:id/moderate. Example check: 4
 * confirms and 3 flags nets to +1, nowhere near -3, so it correctly
 * stays open — exactly the case that must NOT trigger removal.
 * 
 * Each user gets exactly one vote per report — flagging is blocked if
 * that account already confirmed the same report (and vice versa in
 * /confirm above), same "one vote, either kind" rule.
 */
reportsRouter.post('/:id/flag', requireAuth, async (req, res) => {
  const client = await pool.connect();
  try {
    await client.query('BEGIN');

    // Check if user already voted (flag OR confirm) on this report
    const { rows: existingVotes } = await client.query(
      `SELECT 1 FROM report_flags WHERE report_id = $1 AND user_id = $2
       UNION ALL
       SELECT 1 FROM report_confirms WHERE report_id = $1 AND user_id = $2`,
      [req.params.id, req.user.id]
    );
    if (existingVotes.length > 0) {
      await client.query('ROLLBACK');
      return res.status(409).json({ error: 'You have already voted on this report (confirm or flag counts as one vote)' });
    }

    // Add flag record
    await client.query(
      'INSERT INTO report_flags (report_id, user_id) VALUES ($1, $2)',
      [req.params.id, req.user.id]
    );

    // Update report flag count
    const { rows } = await client.query(
      `UPDATE reports SET flag_count = flag_count + 1 WHERE id = $1 RETURNING status, upvotes, flag_count, category`,
      [req.params.id],
    );
    const report = rows[0];
    if (!report) {
      await client.query('ROLLBACK');
      return res.status(404).json({ error: 'Report not found' });
    }
    await logActivity('flagged', req.params.id, report.category, undefined, client);

    const netScore = report.upvotes - report.flag_count;
    if (report.status === 'open' && netScore <= REMOVAL_THRESHOLD) {
      await client.query(`UPDATE reports SET status = 'pending_review' WHERE id = $1`, [req.params.id]);
      await logActivity('pending_review', req.params.id, report.category, `score ${netScore}`, client);
    }
    await client.query('COMMIT');
    res.status(204).end();
  } catch (err) {
    await client.query('ROLLBACK');
    throw err;
  } finally {
    client.release();
  }
});

/**
 * POST /api/reports/:id/moderate  { action: 'remove' | 'restore' }
 * The only place a report can actually be taken off the map for good
 * — always a moderator's explicit call, never automatic.
 * Requires moderator authentication.
 */
reportsRouter.post('/:id/moderate', requireModerator, async (req, res) => {
  const { action } = req.body;
  if (!['remove', 'restore'].includes(action)) {
    return res.status(400).json({ error: "action must be 'remove' or 'restore'" });
  }

  if (action === 'remove') {
    const { rows } = await pool.query(`UPDATE reports SET status = 'removed' WHERE id = $1 RETURNING category`, [req.params.id]);
    if (rows[0]) await logActivity('removed', req.params.id, rows[0].category);
  } else {
    const { rows } = await pool.query(
      `UPDATE reports SET status = 'open', flag_count = 0 WHERE id = $1 RETURNING category`,
      [req.params.id],
    );
    if (rows[0]) await logActivity('restored', req.params.id, rows[0].category);
  }
  res.status(204).end();
});

reportsRouter.post('/:id/resolve', async (req, res) => {
  const { rows } = await pool.query(`UPDATE reports SET status = 'resolved' WHERE id = $1 RETURNING category`, [req.params.id]);
  if (rows[0]) await logActivity('resolved', req.params.id, rows[0].category);
  res.status(204).end();
});

reportsRouter.patch('/:id/category', async (req, res) => {
  const { category } = req.body;
  if (!category) return res.status(400).json({ error: 'category is required' });
  await pool.query('UPDATE reports SET category = $1, user_confirmed = TRUE WHERE id = $2', [category, req.params.id]);
  res.status(204).end();
});

/**
 * DELETE /api/reports/:id
 * Lets a user delete a report they filed themselves ("manage my
 * reports"), or a moderator delete any report. report_flags and
 * report_confirms rows cascade automatically (ON DELETE CASCADE in
 * schema.sql); activity_log has no cascade, so its rows for this
 * report are removed explicitly in the same transaction.
 */
reportsRouter.delete('/:id', requireAuth, async (req, res) => {
  const client = await pool.connect();
  try {
    await client.query('BEGIN');
    const { rows } = await client.query('SELECT reporter_id FROM reports WHERE id = $1 FOR UPDATE', [req.params.id]);
    const report = rows[0];
    if (!report) {
      await client.query('ROLLBACK');
      return res.status(404).json({ error: 'Report not found' });
    }
    if (report.reporter_id !== req.user.id && !req.user.is_moderator) {
      await client.query('ROLLBACK');
      return res.status(403).json({ error: 'You can only delete your own reports' });
    }
    await client.query('DELETE FROM activity_log WHERE report_id = $1', [req.params.id]);
    await client.query('DELETE FROM reports WHERE id = $1', [req.params.id]);
    await client.query('COMMIT');
    res.status(204).end();
  } catch (err) {
    await client.query('ROLLBACK');
    throw err;
  } finally {
    client.release();
  }
});
