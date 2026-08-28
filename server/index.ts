import 'dotenv/config';
import express from 'express';
import cors from 'cors';
import { reportsRouter } from './routes/reports.ts';
import { activityRouter } from './routes/activity.ts';
import { authRouter } from './routes/auth.ts';
import { usersRouter } from './routes/users.ts';

const app = express();
app.use(cors());
app.use(express.json({ limit: '2mb' }));

app.get('/health', (_req, res) => res.json({ ok: true }));
app.use('/api/auth', authRouter);
app.use('/api/reports', reportsRouter);
app.use('/api/activity', activityRouter);
app.use('/api/users', usersRouter);

// Centralized error handler — routes above don't each need their own
// try/catch; an async route that throws lands here instead of hanging
// the request or crashing the process.
app.use((err, _req, res, _next) => {
  console.error(err);
  res.status(500).json({ error: 'Internal error' });
});

const port = process.env.PORT || 8080;
app.listen(port, () => console.log(`Nagrik API listening on :${port}`));
