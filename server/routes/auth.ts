import { Router } from 'express';
import { pool } from '../db/pool.ts';
import crypto from 'crypto';
import bcrypt from 'bcryptjs';

export const authRouter = Router();

const SESSION_EXPIRY_DAYS = 30;

function generateToken(): string {
  return crypto.randomBytes(32).toString('hex');
}

function hashPassword(password: string): Promise<string> {
  return bcrypt.hash(password, 10);
}

function verifyPassword(password: string, hash: string): Promise<boolean> {
  return bcrypt.compare(password, hash);
}

async function createSession(userId: string): Promise<string> {
  const token = generateToken();
  const expiresAt = new Date(Date.now() + SESSION_EXPIRY_DAYS * 24 * 60 * 60 * 1000);
  await pool.query(
    'INSERT INTO sessions (user_id, token, expires_at) VALUES ($1, $2, $3)',
    [userId, token, expiresAt]
  );
  return token;
}

async function deleteSession(token: string): Promise<void> {
  await pool.query('DELETE FROM sessions WHERE token = $1', [token]);
}

async function getUserFromToken(token: string): Promise<{ id: string; email: string; display_name: string | null; is_moderator: boolean } | null> {
  const { rows } = await pool.query(
    `SELECT u.id, u.email, u.display_name, u.is_moderator
     FROM users u
     JOIN sessions s ON s.user_id = u.id
     WHERE s.token = $1 AND s.expires_at > now()`,
    [token]
  );
  return rows[0] ?? null;
}

/** POST /api/auth/register { email, password, displayName? } */
authRouter.post('/register', async (req, res) => {
  const { email, password, displayName } = req.body;
  if (!email || !password) {
    return res.status(400).json({ error: 'email and password are required' });
  }
  if (password.length < 8) {
    return res.status(400).json({ error: 'password must be at least 8 characters' });
  }

  try {
    const passwordHash = await hashPassword(password);
    const { rows } = await pool.query(
      'INSERT INTO users (email, password_hash, display_name) VALUES ($1, $2, $3) RETURNING id, email, display_name, is_moderator',
      [email.toLowerCase(), passwordHash, displayName ?? null]
    );
    const user = rows[0];
    const token = await createSession(user.id);
    res.status(201).json({ user: { id: user.id, email: user.email, displayName: user.display_name, isModerator: user.is_moderator }, token });
  } catch (err: any) {
    if (err.code === '23505') { // unique violation
      return res.status(409).json({ error: 'email already registered' });
    }
    throw err;
  }
});

/** POST /api/auth/login { email, password } */
authRouter.post('/login', async (req, res) => {
  const { email, password } = req.body;
  if (!email || !password) {
    return res.status(400).json({ error: 'email and password are required' });
  }

  const { rows } = await pool.query(
    'SELECT id, password_hash, display_name, is_moderator FROM users WHERE email = $1',
    [email.toLowerCase()]
  );
  if (!rows[0]) {
    return res.status(401).json({ error: 'invalid credentials' });
  }

  const user = rows[0];
  const valid = await verifyPassword(password, user.password_hash);
  if (!valid) {
    return res.status(401).json({ error: 'invalid credentials' });
  }

  const token = await createSession(user.id);
  res.json({ user: { id: user.id, email, displayName: user.display_name, isModerator: user.is_moderator }, token });
});

/** POST /api/auth/logout */
authRouter.post('/logout', async (req, res) => {
  const authHeader = req.headers.authorization;
  if (authHeader?.startsWith('Bearer ')) {
    const token = authHeader.slice(7);
    await deleteSession(token);
  }
  res.status(204).end();
});

/** GET /api/auth/me — returns current user from session token */
authRouter.get('/me', async (req, res) => {
  const authHeader = req.headers.authorization;
  if (!authHeader?.startsWith('Bearer ')) {
    return res.status(401).json({ error: 'no session' });
  }
  const token = authHeader.slice(7);
  const user = await getUserFromToken(token);
  if (!user) {
    return res.status(401).json({ error: 'session expired or invalid' });
  }
  res.json({ user: { id: user.id, email: user.email, displayName: user.display_name, isModerator: user.is_moderator } });
});

/** Middleware to require authentication */
export async function requireAuth(req: any, res: any, next: any) {
  const authHeader = req.headers.authorization;
  if (!authHeader?.startsWith('Bearer ')) {
    return res.status(401).json({ error: 'authentication required' });
  }
  const token = authHeader.slice(7);
  const user = await getUserFromToken(token);
  if (!user) {
    return res.status(401).json({ error: 'session expired or invalid' });
  }
  req.user = user;
  next();
}

/** Middleware to require moderator role */
export async function requireModerator(req: any, res: any, next: any) {
  await requireAuth(req, res, () => {
    if (!req.user.is_moderator) {
      return res.status(403).json({ error: 'moderator access required' });
    }
    next();
  });
}

/** Middleware that attaches req.user when a valid Bearer token is
 * present, but never rejects the request when it's missing or
 * invalid — used on read endpoints (GET /reports, /reports/nearby)
 * so they can report "did I already confirm/flag this?" per-report
 * for a logged-in caller, while staying open to anonymous browsing. */
export async function optionalAuth(req: any, _res: any, next: any) {
  const authHeader = req.headers.authorization;
  if (authHeader?.startsWith('Bearer ')) {
    const token = authHeader.slice(7);
    const user = await getUserFromToken(token);
    if (user) req.user = user;
  }
  next();
}