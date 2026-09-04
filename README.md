# Nagrik — AI-Powered Civic Issue Reporter

Map-based, geospatial citizen-issue reporting platform. Report a problem, drop a pin, and let computer vision and geospatial clustering do the rest.

**Stack:** React · Node.js · PostgreSQL/PostGIS · Python FastAPI · OpenCLIP

---

## What It Does

- **Geospatial issue reporting** — a React + Leaflet client lets citizens drop a pin anywhere on the map to report a civic issue (potholes, garbage, broken infrastructure, etc.), backed by a Node.js/PostGIS server.
- **Location-aware clustering** — proximity queries group nearby reports together, so the same pothole reported by five different people shows up as one issue, not five.
- **Zero-shot photo classification** — a Python FastAPI service built on OpenCLIP automatically categorizes submitted photos into the right issue type, with opennsfw2 filtering out inappropriate images before they're ever shown to anyone.
- **Automatic deduplication** — a cosine-similarity pipeline compares incoming photos against existing reports to catch repeat submissions of the same issue, keeping the map clean instead of cluttered with duplicates.

## How It Works

1. A citizen opens the map, taps a location, and submits a photo with a short description.
2. The FastAPI vision service zero-shot classifies the photo (OpenCLIP) and screens it (opennsfw2).
3. The photo's embedding is compared against existing nearby reports via cosine similarity — if it matches, it's merged into the existing issue instead of creating a duplicate.
4. The Node.js/PostGIS backend runs a proximity query to cluster the report with other nearby issues of the same type.
5. The React + Leaflet client renders all clustered issues on the map in real time, so anyone can see what's been reported nearby.

## Architecture

```
┌─────────────────┐      ┌──────────────────────┐      ┌───────────────────────┐
│  React + Leafle │ ───► │  Node.js API         │ ───► │  PostgreSQL / PostGIS │
│  (client)       │ ◄─── │  (proximity queries) │ ◄─── │  (geospatial store)   │
└─────────────────┘      └──────────────────────┘      └───────────────────────┘
         │
         ▼
┌───────────────────────────────┐
│  Python FastAPI (CV service)  │
│  OpenCLIP — zero-shot class.  │
│  opennsfw2 — content filter   │
│  cosine similarity — dedupe   │
└───────────────────────────────┘
```

## Tech Stack

| Layer | Technology |
|---|---|
| Client | React, Leaflet |
| API / Backend | Node.js |
| Database | PostgreSQL with PostGIS |
| Computer Vision | Python, FastAPI, OpenCLIP, opennsfw2 |

---

Built as a hackathon submission (HACK-4-CROWN, Social Impact track) by Team "3 Dost".
