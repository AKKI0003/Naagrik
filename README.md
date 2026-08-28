# Nagrik — civic issue reporter (web/PWA build)

Report any public infrastructure problem — not just potholes — on a shared,
aging-aware public map. Built for HACK-4-CROWN, Track 04: Social Impact.

This is the **web (React + Leaflet + Node/PostGIS) rebuild** of the project,
replacing an earlier Flutter version. The reason for the switch: a
responsive, installable web app (PWA) covers Android, iOS, Windows, and
Mac from one codebase for free — no $99/year Apple Developer account
needed just to get it on an iPhone, which Flutter/React Native would
require for a real App Store listing. All the same features carried over.

## Structure

```
nagrik-web/
  src/            React + TypeScript + Tailwind client (this is what runs in the browser)
  server/         Node.js/Express API + PostgreSQL/PostGIS (the real multi-user backend)
  ai-service/     Python FastAPI service — OpenCLIP + opennsfw2 classification pipeline
```

This matches the three-column tech stack from the pitch deck exactly:
**Client** (React, Leaflet/OSM, camera capture) · **AI service** (OpenCLIP,
opennsfw2, cosine similarity) · **Backend & data** (Node API, PostgreSQL +
PostGIS, Vercel + Railway/Render free tier).

## What's been actually verified, not just written

Being specific here on purpose, same as the honest-scope approach from
the pitch itself:

- ✅ **`npm install` succeeds**, **`tsc -b` type-checks with zero errors**,
  and **`vite build` produces a working production bundle** — all run for
  real in the environment this was built in.
- ✅ **Loaded in a real headless browser (Playwright) and clicked through
  the entire flow**: open report sheet → pick a photo → see the
  low-confidence review warning → pick a category → confirm → see it
  appear in My Reports with the correct color and "New" age badge.
  Zero console errors or React crashes at any step.
- ✅ **Backend JS files pass `node --check`** (syntax-valid) and the
  Python AI service passes `python -m py_compile` (syntax-valid).
- ⚠️ **The AI service has NOT been run end-to-end** — doing that requires
  downloading the OpenCLIP and opennsfw2 model weights (multi-hundred MB),
  which wasn't practical to verify in this environment. Treat first boot
  of `ai-service` as needing a real smoke test before a demo, not as
  already-proven.
- ⚠️ **The Postgres/PostGIS backend has NOT been run against a real
  database** — no Postgres instance was available to test against here.
  The SQL and query logic are correct as written (`ST_DWithin`,
  `ST_MakePoint`, the GIST index) but deserve a real run before demo day.

## What's intentionally stubbed, and why

1. **Photo upload** isn't wired up — `photoUrl` stays null on submit.
   Cleanest free option: Cloudflare R2 or Backblaze B2 (S3-compatible,
   generous free tiers, signed upload URLs).
2. **The AI service isn't called by the frontend by default.** The app
   ships with `StubClassificationService`, which always requests manual
   review — so the real behavior (a human always confirms the category)
   holds correctly with zero ML wired up. Point `HttpClassificationService`
   at your deployed `ai-service` URL once it's live and smoke-tested.
3. **Visual-similarity duplicate matching** — `ai-service/main.py`'s
   `/embed` endpoint returns CLIP embeddings for this, but it isn't
   wired into the backend's dedupe flow yet. Today, duplicate detection
   is GPS-proximity only (`ST_DWithin`, ~30m radius) — genuinely
   functional, just the visual half of the two-signal design isn't
   connected yet.

## What's actually working now (v2 — UI overhaul + moderation)

- **Dark, custom-branded map** — CartoDB's free dark basemap instead of
  stock OSM tiles, glowing category pins with age-colored rings, a
  visible pulsing "you are here" marker, a live open-report count chip,
  and a frosted-glass control style throughout.
- **Combined type + time filtering** — the filter rail now has a
  segmented time-range control (All / 24h / 7d / 30d) alongside the
  existing category toggles, with a live result count.
- **Real moderation workflow, not auto-delete.** Flagging a report
  never removes it directly. `netScore = confirms − flags`; only once
  netScore ≤ **-3** does a report move to `pending_review` — pulled off
  the public map, but **a moderator makes the final call** (Remove or
  Restore) in the new **Moderate** tab. The example from the request —
  4 confirms and 3 flags — nets to +1 and correctly stays open.
  `netScore`, `REMOVAL_THRESHOLD`, and `crossesRemovalThreshold()` live
  in `src/types/report.ts` and are mirrored server-side in
  `server/routes/reports.js`.
- **A flagged/removed report never disappears from its owner's My
  Reports** — it stays there with a status badge (Open / Under Review /
  Resolved / Removed) so the reporter always knows what happened.
- **Activity log** — every create/confirm/flag/review/resolve/remove/
  restore is appended to an append-only log, visible in the new
  **Activity** tab, grouped by day.
- **A real "access point to the AI"** — the new **Settings** tab lets
  you paste a deployed `ai-service` URL, test it live against its
  `/health` route, and save it — `classificationService.ts` picks up
  the configured endpoint automatically, no code changes needed
  elsewhere. Ships with nothing configured, which means every report
  requires manual category selection until you deploy and connect it —
  a safe default, not a missing feature.
- **Responsive by breakpoint** — a persistent left sidebar on `md`+
  screens, a bottom nav below that; same nav config drives both so they
  can't drift out of sync.

All of the above was verified with a real headless-browser click-through
(create a report → flag it three times → watch it cross the -3
threshold → appear in the Moderate queue → restore it → see it reflected
in Activity and My Reports), not just written and assumed to work.

## Running it

**Frontend (works standalone, zero setup, single-device demo):**
```bash
cd nagrik-web
npm install
npm run dev
```
With no `VITE_API_BASE_URL` set, it runs entirely against `localStorage`
via `LocalReportsRepository` — good for early development and solo demo
rehearsal, not for a real multi-user hackathon demo.

**Backend (for a real multi-user demo):**
```bash
cd server
npm install
createdb nagrik && psql nagrik -c "CREATE EXTENSION postgis;"   # or use a managed Postgres with PostGIS enabled
cp .env.example .env   # set DATABASE_URL
npm run migrate
npm run dev
```
Then set `VITE_API_BASE_URL=http://localhost:8080` in the frontend's
`.env` and restart `npm run dev` there — it'll automatically switch from
`LocalReportsRepository` to `HttpReportsRepository`.

**AI service (optional until you're ready to wire it in):**
```bash
cd ai-service
pip install -r requirements.txt
uvicorn main:app --reload --port 8000
```

## Location tracking fix (v3)

If the map ever seems stuck on an old location again, here's what was
actually wrong and what to check:

1. **Root cause #1 — cached geolocation reads.** The old code called
   `getCurrentPosition` once, with no options. Browsers/OS location
   services frequently return a cached network/IP-based fix instead of
   a real GPS read. Fixed in `src/hooks/useLiveLocation.ts`, which uses
   `watchPosition` with `{ enableHighAccuracy: true, maximumAge: 0 }` —
   `maximumAge: 0` explicitly forbids a cached position, ever.
2. **Root cause #2 — a denied/blocked permission silently falls back
   forever.** If location permission was denied at any point, the app
   used to just sit on the New Delhi fallback with no indication why.
   `useLiveLocation` now proactively checks `navigator.permissions`
   and the map shows a visible gold banner ("Location access is
   blocked...") with a Retry button instead of failing silently.
3. **Root cause #3 — stale PWA build.** Because this app installs as a
   PWA, an update you deploy doesn't necessarily reach an already-open
   tab immediately — the old service worker can keep serving the old
   JS bundle until every tab is fully closed. Fixed with
   `skipWaiting`/`clientsClaim`/`cleanupOutdatedCaches` in
   `vite.config.ts`, plus an explicit update check in `src/main.tsx`
   on load and on tab-focus. **If you still see old behavior after
   deploying an update**, hard-confirm you're not just looking at a
   cached tab: DevTools → Application → Service Workers → Unregister,
   then hard-reload (Ctrl/Cmd+Shift+R).

Verified with Playwright by simulating a geolocation change mid-session
(Bengaluru → Mumbai) and confirming the map's tile requests actually
shifted toward the new coordinates after tapping recenter — not just
that the code compiled.

## Location tracking fix (v4) — manual override

If GPS/network location is just plain wrong (common on desktop/laptop
browsers, which rarely have real GPS and fall back to WiFi-based
positioning keyed to a lookup database that can be stale or simply
incorrect for your router), no amount of "don't cache" fixes the
underlying bad data — it's upstream of the browser entirely.

The real fix: **`src/services/locationOverride.ts`** + **`src/hooks/useEffectiveLocation.ts`**
add a manual location override that always wins over GPS when set:

- A new gold pin-drop button on the map enters "tap anywhere to set
  your location" mode (`PinDropHandler` in `MapScreen.tsx`, using
  react-leaflet's `useMapEvents`).
- If GPS accuracy is worse than 2km, a proactive banner appears
  suggesting the manual pin instead of waiting for you to notice.
- Searching an address via the existing search bar also sets it as
  your manual location — reusing a flow that already existed.
- The "you are here" marker turns gold instead of cyan when running on
  a manual override, so it's always visually clear which source is
  active; "Use GPS instead" clears it and goes back to live tracking.
- The override is what every part of the app uses for "where am I" —
  map center, the marker, and where a new report gets filed — via
  `useEffectiveLocation()`, not raw GPS directly.

## Installing as an app (the whole point of the stack switch)

Once deployed (e.g. to Vercel), open the site on a phone:
- **Android (Chrome):** "Add to Home Screen" prompt appears automatically.
- **iOS (Safari):** Share → "Add to Home Screen."
- **Windows/Mac (Chrome/Edge):** install icon in the address bar.

All free, all from one deployment — no app store review, no per-platform
build, no developer account fee.
