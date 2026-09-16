# APEX Drafting — Lead Desk

Two-person iOS + Android app for **APEX Drafting LLC**. New Angi for Business leads land in a shared unclaimed inbox. Jared or Reuben claims a lead atomically; that lead then lives only on their pipeline with Follow up / Sold / Lost actions.

This repo is one Expo app (`mobile/`) plus a Node/TypeScript API (`server/`) with SQLite, Expo push, and an Angi sync layer that does **not** invent a fake Angi OAuth flow.

## What you get

- Seeded users: **Jared** and **Reuben** (display names editable in Settings)
- Shared **Unclaimed** inbox with live updates (SSE on web + 2.5s poll everywhere)
- Atomic claim (SQLite `BEGIN IMMEDIATE` — second claim returns 409)
- Personal pipeline with full client fields and an activity log
- Follow up, Sold, and Lost job actions
- Push wiring via Expo Push (native). Web preview uses an in-app banner
- Angi ingest: CRM webhook, JSON/CSV import, optional session poller, demo inject

## Quick start (web preview)

```bash
npm install
npm --prefix server install
npm --prefix mobile install
npm run dev
```

Open **http://127.0.0.1:43121** (API gateway, proxies Expo web from port 43122).

| User | Email | Password |
| --- | --- | --- |
| Jared | `jared@apexdrafting.local` | `ApexJared1!` |
| Reuben | `reuben@apexdrafting.local` | `ApexReuben1!` |

A sample unclaimed lead (Dana Holloway) is seeded on first boot. Settings → **Inject demo lead** adds another. Sign in as both users in two browsers to watch the claim race.

API health: `GET http://127.0.0.1:43121/api/health`

## Architecture

```
iPhone / Android / Expo web
        │  JWT
        ▼
server  :43121
  /api/*     Hono + SQLite (WAL)
  /api/events  SSE
  /*         reverse proxy → Expo web :43122
```

Real-time: clients poll `/api/leads/sync-state` every 2.5s and refetch when `revision` changes. Web also opens SSE at `/api/events`.

## Environment

Copy `server/.env.example` to `server/.env`.

| Variable | Purpose |
| --- | --- |
| `JWT_SECRET` | Sign session tokens |
| `DATABASE_PATH` | SQLite file (default `server/data/apex.sqlite`) |
| `USER_JARED_*` / `USER_REUBEN_*` | Seed emails, passwords, display names |
| `ANGI_SESSION_COOKIE` | Logged-in `office.angi.com` cookie for polling |
| `ANGI_EMAIL` / `ANGI_PASSWORD` | Alternate login attempt (often blocked) |
| `ANGI_POLL_INTERVAL_MS` | Default `60000` |
| `ANGI_LEADS_API_URL` | Optional comma-separated URLs to try first |
| `ANGI_WEBHOOK_KEY` | Shared secret for `POST /api/webhooks/angi` (`X-API-KEY`) |
| `EXPO_PUBLIC_API_URL` | Native/Expo Go API origin, e.g. `http://192.168.1.20:43121` |

Passwords are re-hashed from env on each API boot so you can rotate them in `.env`. Existing display names are preserved.

## Angi sync — limitations and the working path

Angi for Business (**office.angi.com**) has **no public leads API**. Angi delivers new leads to CRMs with a one-way JSON POST that their team enables after you email `crmintegrations@angi.com`. HTML on the Leads page changes, so scraping is a best-effort fallback, not the production contract.

**Supported ingest, in order of reliability**

1. **CRM / Zapier webhook (production)**  
   Tell Angi your webhook URL is `https://YOUR-API/api/webhooks/angi` and send the same value as `ANGI_WEBHOOK_KEY` in `X-API-KEY`. Payload is normalized from typical Angi/HomeAdvisor fields (`leadOid` / `srOid` / `leadId`, name, phone, email, address, `taskName`, `comments`, `interview`, `createDate`). Deduped by Angi lead id.

2. **Manual CSV / JSON import (always works)**  
   From office.angi.com: Leads → All leads → Export all. Then:
   - Settings → paste JSON, or
   - `POST /api/import/json` (auth) with a lead or `{ "leads": [...] }`
   - `POST /api/import/csv` (auth) with the export body  
   Sample files: `sample-data/leads.sample.json`, `sample-data/leads.sample.csv`

3. **Poller (optional, fragile)**  
   Set `ANGI_SESSION_COOKIE` from a logged-in browser (or `ANGI_EMAIL` + `ANGI_PASSWORD`). The worker tries common JSON endpoints and HTML tables. If Angi HTML/XHR shapes change, the poller logs a clear failure and you fall back to 1 or 2. There is no Angi OAuth in this app.

4. **Simulate**  
   Settings → Inject demo lead, or `POST /api/sync/simulate`. Both users are notified (push and/or inbox banner).

Every insert goes through the same lock + notify path regardless of source.

## Expo Go (iPhone and Android)

1. Start the API on a machine the phones can reach: `npm run dev:api`
2. In `mobile/.env`: `EXPO_PUBLIC_API_URL=http://YOUR_LAN_IP:43121`
3. `npm --prefix mobile start` and scan the QR code with Expo Go
4. Grant notification permission. Tokens are stored per user and used by `expo-server-sdk`

Web preview cannot receive APNs/FCM; it shows a live banner instead. Push is implemented for TestFlight / Play / Expo Go.

## iOS TestFlight

```bash
npm i -g eas-cli
cd mobile
eas login
eas init          # writes extra.eas.projectId into app.json
eas build --platform ios --profile preview
eas submit --platform ios --profile production
```

Bundle id: `com.apexdrafting.leads`. After the first iOS credentials prompt, add testers in App Store Connect → TestFlight.

## Android internal testing

```bash
cd mobile
eas build --platform android --profile preview   # APK
# or
eas build --platform android --profile production
eas submit --platform android
```

Package: `com.apexdrafting.leads`. Upload the AAB to Play Console → internal testing track. For Expo push on a standalone Android build, add an FCM v1 key in the Expo dashboard / EAS credentials.

## API cheat sheet

| Method | Path | Notes |
| --- | --- | --- |
| POST | `/api/auth/login` | `{ email, password }` |
| GET | `/api/leads/unclaimed` | Shared inbox |
| POST | `/api/leads/:id/claim` | 409 if already claimed |
| GET | `/api/leads/mine` | Claimed / active for the caller |
| POST | `/api/leads/:id/follow-up` | Optional `{ note }` |
| POST | `/api/leads/:id/sold` | Optional `{ note }` |
| POST | `/api/leads/:id/lost` | Optional `{ note }` |
| POST | `/api/webhooks/angi` | `X-API-KEY` |
| POST | `/api/import/json` | Auth |
| POST | `/api/sync/simulate` | Auth |

`npm test` runs the atomic-claim race (Jared wins, Reuben is rejected).

## Product stages

Unclaimed inbox → Claimed / Active (optional Follow-up flag) → Sold or Lost.
