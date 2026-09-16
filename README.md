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
- Angi ingest: **attach Jared’s real office.angi.com session** (cookie / CRM webhook / CSV). Demo inject is only for testing.

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

Copy `server/.env.example` → `server/.env`. Copy `mobile/.env.example` → `mobile/.env` when using phones.

| Variable | Where | Purpose |
| --- | --- | --- |
| `JWT_SECRET` | `server/.env` | Sign session tokens |
| `DATABASE_PATH` | `server/.env` | SQLite file (default `server/data/apex.sqlite`) |
| `USER_JARED_*` / `USER_REUBEN_*` | `server/.env` | Seed emails, passwords, display names |
| `ANGI_SESSION_COOKIE` | `server/.env` **or Settings** | Logged-in `office.angi.com` Cookie header |
| `ANGI_EMAIL` / `ANGI_PASSWORD` | `server/.env` **or Settings** | Tried if no cookie; usually blocked by Cloudflare |
| `ANGI_LEADS_API_URL` | `server/.env` **or Settings** | DevTools XHR URL that returns leads JSON |
| `ANGI_POLL_INTERVAL_MS` | `server/.env` | Default `60000` (minimum 15000) |
| `ANGI_WEBHOOK_KEY` | `server/.env` **or Settings** | Shared secret for `POST /api/webhooks/angi` (`X-API-KEY`) |
| `EXPO_PUBLIC_API_URL` | `mobile/.env` | API origin the **phones** call (never `127.0.0.1` on a device) |

`.env` files are gitignored. Values in `server/.env` override the same field saved in Settings.

Passwords are re-hashed from env on each API boot so you can rotate them in `.env`. Existing display names are preserved.

## How Jared connects Angi Pro (live leads)

Angi for Business (**office.angi.com**) has **no public leads API and no OAuth** we can implement. Login is fronted by Cloudflare (`id.angi.com`), so this server cannot complete a browser bot-check with email/password alone. The working attach path is a **session cookie** (or Angi CRM webhook).

### Path A — session cookie + poller (fastest to live sync)

1. On a computer, open Chrome and sign in at [https://office.angi.com/login](https://office.angi.com/login). Open **Leads**.
2. Press F12 → **Network**. Click any request to `office.angi.com`. Copy the full **Cookie** request header.
3. Either:
   - **In the app:** Settings → Connect Angi Pro → paste Cookie → **Save & poll Angi**, or
   - **On the server:** put it in `server/.env` as `ANGI_SESSION_COOKIE=...` and restart `npm run dev:api`.
4. Confirm: Unclaimed inbox shows real homeowners (not only “Inject demo lead”). Health: `GET /api/health` then Settings status **Attached · cookie**. Server log: `Angi poller attached`.
5. If poll says **0 leads**, DevTools → Network → find the XHR whose JSON includes lead names/ids. Paste that URL as `ANGI_LEADS_API_URL` (or the Leads API URL field) and poll again.
6. Cookies expire. When sync errors mention login/Cloudflare, paste a fresh Cookie. The poller runs every 60s and **dedupes by Angi lead id**. New ids notify **both** users (Expo push on phones, inbox banner on web).

Do **not** paste Angi passwords into git, chat, or this README.

### Path B — Angi CRM / Zapier webhook (most stable)

1. Settings → **Generate webhook key** (or set `ANGI_WEBHOOK_KEY` in `server/.env`).
2. Expose the API on HTTPS (see tunnel notes under Expo Go).
3. Email `crmintegrations@angi.com` with company id, webhook URL `https://YOUR-API/api/webhooks/angi`, auth type **key**, header `X-API-KEY`, JSON body. Angi documents this in [CRM integration](https://intercom.help/angi/en/articles/10288125-setting-up-your-crm-integration-with-angi).
4. Ask them to send a test lead. It should land in Unclaimed and push both phones.

### Path C — CSV / JSON export (always works)

office.angi.com → Leads → All leads → **Export all**. Import in Settings or `POST /api/import/csv`. Samples: `sample-data/`.

### Verify live sync

| Check | Expected |
| --- | --- |
| Settings status | Attached · cookie (or webhook key) |
| Save & poll / Poll now | New Angi ids appear once; repeats say “already stored” |
| Second phone | Same unclaimed row; claim still atomic |
| Push | Both Expo Go / EAS installs get “New Angi lead” |

**Demo inject is not Angi.** Use it only to test claim/push without an Angi session.

## Install on phones today (Expo Go)

Fastest way onto a physical **iPhone and Samsung** without Apple/Google store review.

**Accounts you need today:** none for Apple/Play. Install [Expo Go for iOS](https://apps.apple.com/app/expo-go/id982107779) and [Expo Go for Android](https://play.google.com/store/apps/details?id=host.exp.exponent).

Same Wi-Fi as the computer running the API:

```bash
# computer
npm --prefix server run dev

# find the computer’s LAN IP (Windows: ipconfig → IPv4)
# mobile/.env
EXPO_PUBLIC_API_URL=http://192.168.x.x:43121

cd mobile
npm run lan
```

Scan the QR code: iPhone uses the Camera app → Expo Go; Samsung uses the QR scanner in Expo Go.

Different networks (or this cloud VM): tunnel the **API** as well as Metro. Phones cannot call `127.0.0.1` on the server.

```bash
# terminal 1 — API
npm --prefix server run dev

# terminal 2 — public HTTPS to the API (example)
npx --yes cloudflared tunnel --url http://127.0.0.1:43121
# copy the https://*.trycloudflare.com URL into mobile/.env:
# EXPO_PUBLIC_API_URL=https://YOUR-TUNNEL.trycloudflare.com

# terminal 3 — Expo Go tunnel
cd mobile && npm run go
```

Sign in as Jared on one phone and Reuben on the other. Allow notifications. Settings → **This device** must show the tunnel/LAN API URL, not `http://127.0.0.1:43121`.

## Installable builds (EAS) — iPhone + Android

Use this when you want an icon on the home screen without Expo Go (TestFlight / Play internal / APK).

**Accounts / paid programs**

| Who | What | Why |
| --- | --- | --- |
| Expo | Free account (`eas login`) | Cloud builds |
| Apple | [Apple Developer Program](https://developer.apple.com/programs/) (~$99/year) | Any iOS install besides Expo Go / simulator |
| Google | [Play Console](https://play.google.com/console) (~$25 one-time) | Play internal testing. APK profile can sideload without Play |

**One-time EAS setup** (from `mobile/`):

```bash
npm i -g eas-cli
cd mobile
eas login
eas init
# This writes extra.eas.projectId into app.json — required for Expo push
# on standalone builds. Commit that projectId. Do not invent one.
```

Create the iOS app in [App Store Connect](https://appstoreconnect.apple.com) with bundle id `com.apexdrafting.leads`. Create the Android app in Play Console with package `com.apexdrafting.leads`.

**iPhone (internal / TestFlight)**

```bash
cd mobile
# Ad hoc / internal install via expo.dev (registers this iPhone’s UDID the first time)
eas build --platform ios --profile preview

# Store / TestFlight binary, then:
eas submit --platform ios --profile production
```

After submit: App Store Connect → TestFlight → add Jared and Reuben as testers → they install **TestFlight** from the App Store, then APEX Drafting.

**Samsung / Android**

```bash
cd mobile
# Sideload APK (fastest Play-free install)
eas build --platform android --profile preview
# Install the APK from the Expo build page onto the Samsung (allow unknown sources).

# Play internal testing track:
eas build --platform android --profile production
eas submit --platform android --profile production
```

Then Play Console → Testing → Internal testing → add Gmail testers → share the join link.

**Push on EAS builds:** Expo dashboard → project → credentials → Android FCM v1 service account; iOS push key is created during the first `eas build` when you are logged into the Apple Developer team.

Set `EXPO_PUBLIC_API_URL` to a **stable HTTPS API** before EAS build (baked in at build time), e.g. your VPS or Cloudflare tunnel hostname.

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
| POST | `/api/sync/angi/connect` | Save cookie/email/XHR URL; starts poller |
| POST | `/api/sync/angi` | Poll office.angi.com now |
| POST | `/api/webhooks/angi` | `X-API-KEY` |
| POST | `/api/import/json` | Auth |
| POST | `/api/sync/simulate` | Auth |

`npm test` runs the atomic-claim race (Jared wins, Reuben is rejected).

## Product stages

Unclaimed inbox → Claimed / Active (optional Follow-up flag) → Sold or Lost.
