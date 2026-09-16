# APEX Drafting — Lead Desk

Two-person iOS + Android app for **APEX Drafting LLC**. New Angi for Business leads land in a shared unclaimed inbox. Jared or Reuben claims a lead atomically; that lead then lives only on their pipeline with Follow up / Sold / Lost actions.

This repo is one Expo app (`mobile/`) plus a Node/TypeScript API (`server/`) with SQLite, Expo push, and an Angi sync layer that does **not** invent a fake Angi OAuth flow.

## What you get

- Seeded users: **Jared** and **Reuben** (display names editable in Settings)
- Shared **Unclaimed** inbox with live updates (SSE on web + 2.5s poll everywhere)
- Atomic claim (SQLite `BEGIN IMMEDIATE` — second claim returns 409)
- Personal pipeline with full client fields and an activity log
- Follow up, Sold, and Lost job actions
- Push wiring via Expo Push in development/production builds. Expo Go uses an in-app banner (Android Expo Go SDK 53 cannot register remote push)
- Angi ingest: **attach Jared’s real office.angi.com session** (cookie / CRM webhook / CSV). Demo inject is only for testing.

## Windows PC + Expo Go (no WSL, no Origin CLI)

Use this if you cannot clone with Origin CLI. Unzip the project zip, then run in **PowerShell** (not WSL).

1. Install **Node.js 22 LTS** from [https://nodejs.org](https://nodejs.org) (includes npm). Confirm: `node -v` and `npm -v`.
2. Unzip `angi_flow_full_project.zip` to a folder such as `C:\Users\Jared\angi-flow`.
3. Copy env files and set the Angi password (leave it blank until you have it):

```powershell
cd C:\Users\Jared\angi-flow
Copy-Item server\.env.example server\.env
Copy-Item mobile\.env.example mobile\.env
notepad server\.env
```

`ANGI_EMAIL` is already `apexdraftingllc@gmail.com`. Set `ANGI_PASSWORD=` to the real Angi Pro password when you have it (this file is not committed). You can also paste an office.angi.com **Cookie** in the app Settings without a password.

4. Install dependencies:

```powershell
npm install
npm --prefix server install
npm --prefix mobile install
```

5. Start the API (leave this window open):

```powershell
npm --prefix server run dev
```

Health check in a browser: http://127.0.0.1:43121/api/health

6. Point phones at this PC. Same Wi-Fi: run `ipconfig`, copy the **IPv4 Address** for Wi-Fi (e.g. `192.168.1.20`). Edit `mobile\.env`:

```
EXPO_PUBLIC_API_URL=http://192.168.1.20:43121
```

Allow Node.js through Windows Firewall for private networks if the phones cannot connect.

7. New PowerShell window — QR code for Expo Go:

```powershell
cd C:\Users\Jared\angi-flow\mobile
npm run go
```

(`npm run go` = `expo start --tunnel --port 8082`. First run may ask for a free Expo login.)

8. **iPhone:** App Store → Expo Go. Open **Camera**, scan the terminal QR, tap Open in Expo Go. Sign in as Jared (`jared@apexdrafting.local` / `ApexJared1!`). New leads show in Unclaimed (and an in-app banner). Remote push needs a later development/production build.

9. **Samsung:** Play Store → Expo Go → **Scan QR code**, same QR. Sign in as Reuben (`reuben@apexdrafting.local` / `ApexReuben1!`). Do **not** expect a notification permission prompt — Expo Go Android cannot register Expo Push (SDK 53). The app still runs.

Web preview on the PC: in a third window `npm run dev` and open http://127.0.0.1:43121

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

## Cloud API (phones without the PC)

To keep the API always-on with a public HTTPS URL (Fly.io volume + SQLite), follow **[DEPLOY.md](DEPLOY.md)**. Then set `EXPO_PUBLIC_API_URL` in `mobile/.env` to `https://<app>.fly.dev`. Local Windows + Expo Go on the same Wi‑Fi is unchanged.

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
| `ANGI_EMAIL` | `server/.env` | Confirmed: `apexdraftingllc@gmail.com` |
| `ANGI_PASSWORD` | `server/.env` | **Blank until supplied via secure env. Never commit.** |
| `ANGI_LEADS_API_URL` | `server/.env` **or Settings** | DevTools XHR URL that returns leads JSON |
| `ANGI_CALLER_TYPE` | `server/.env` | `X-ANGI-CallerType` (default `ServiceProvider`) |
| `ANGI_CALLER_ID` | `server/.env` | `X-ANGI-CallerId` (or parsed from `/angiLeads/<id>/` / `/app/h/<id>/`) |
| `ANGI_POLL_INTERVAL_MS` | `server/.env` | Default `60000` (minimum 15000) |
| `ANGI_WEBHOOK_KEY` | `server/.env` **or Settings** | Shared secret for `POST /api/webhooks/angi` (`X-API-KEY`) |
| `EXPO_PUBLIC_API_URL` | `mobile/.env` | API origin the **phones** call (never `127.0.0.1` on a device) |

`.env` files are gitignored. Values in `server/.env` override the same field saved in Settings.

Passwords are re-hashed from env on each API boot so you can rotate them in `.env`. Existing display names are preserved.

## How Jared connects Angi Pro (live leads)

Confirmed Angi Pro login email: **apexdraftingllc@gmail.com**. The password is **not** in this repo. Put it in `server/.env` as `ANGI_PASSWORD` later via a secure env. Do not commit it.

`server/.env.example` already has:

```
ANGI_EMAIL=apexdraftingllc@gmail.com
ANGI_PASSWORD=
```

Copy that to `server/.env`. Until `ANGI_PASSWORD` is set, live sync uses a **session cookie** (Cloudflare blocks headless login on id.angi.com).

### Path A — session cookie + poller (works today, no password required)

1. Chrome → sign in at [https://office.angi.com/login](https://office.angi.com/login) as `apexdraftingllc@gmail.com` → open **Leads**.
2. F12 → **Network** → any `office.angi.com` request → copy the **Cookie** header.
3. Settings → Connect Angi Pro → paste Cookie → **Save & poll Angi**, or set `ANGI_SESSION_COOKIE` in `server/.env` and restart the API.
4. Unclaimed should list real homeowners. Duplicate Angi lead ids are skipped. New ids notify both users.
5. If poll finds 0 leads, paste the leads XHR URL as `ANGI_LEADS_API_URL`.

When the password is supplied: add `ANGI_PASSWORD=...` only in `server/.env` (gitignored), restart `npm run dev:api`. Cookie remains the reliable poll path.

### Path B — Angi CRM / Zapier webhook

Settings → **Generate webhook key**, then point Angi at `POST /api/webhooks/angi` with `X-API-KEY`. See [CRM integration](https://intercom.help/angi/en/articles/10288125-setting-up-your-crm-integration-with-angi).

### Path C — CSV / JSON export

office.angi.com → Leads → Export all → Settings import or `sample-data/`.

### Verify

| Check | Expected |
| --- | --- |
| Settings | Email `apexdraftingllc@gmail.com`; **waiting for password** until `ANGI_PASSWORD` or a Cookie is set |
| After Cookie | Attached · cookie; real leads in Unclaimed |
| Phones | Same inbox; in-app banner on new ids (Expo Go). Remote push only in a dev/production build |

**Demo inject is not Angi.**

## Install on phones today (Expo Go)

This is the install path. No Apple Developer or Play Console needed.

**Project:** Expo app name `APEX Drafting`, slug `apex-drafting`, folder `mobile/`.

### 0. Apps on the phones

- **iPhone:** App Store → [Expo Go](https://apps.apple.com/app/expo-go/id982107779) → Install.
- **Samsung:** Play Store → [Expo Go](https://play.google.com/store/apps/details?id=host.exp.exponent) → Install.

### 1. API the phones can reach

Phones cannot use `http://127.0.0.1:43121` (that is the phone itself).

Same Wi-Fi as the computer:

```bash
npm --prefix server run dev
# Windows: ipconfig → IPv4   |  macOS/Linux: ipconfig getifaddr en0   or ip a
```

Create `mobile/.env` from `mobile/.env.example`:

```
EXPO_PUBLIC_API_URL=http://192.168.x.x:43121
```

Use the computer’s LAN IP.

### 2. Start Metro and show the QR

```bash
cd mobile
npm install
npm run lan
```

Leave this terminal open. It prints a **QR code** and a `exp://192.168.x.x:8082` URL.

Different Wi-Fi / cloud VM: tunnel Metro **and** the API.

```bash
# terminal 1
npm --prefix server run dev

# terminal 2 — HTTPS to the API
npx --yes cloudflared tunnel --url http://127.0.0.1:43121
# put https://xxxxx.trycloudflare.com in mobile/.env as EXPO_PUBLIC_API_URL

# terminal 3 — QR that works off-LAN
cd mobile && npm run go
```

`npm run go` is `expo start --tunnel --port 8082`. First time, Expo may ask you to log in to an Expo account (free).

### 3. Scan the same QR on both phones

**iPhone**

1. Open the **Camera** app (not Expo Go first).
2. Point at the QR in the terminal.
3. Tap the banner **Open in Expo Go**.
4. Wait for `APEX Drafting` to bundle.
5. Sign in as Jared (`jared@apexdrafting.local` / `ApexJared1!`) or Reuben.
6. Sign in. If Expo Go asks for notifications on iOS you can allow them; Android Expo Go skips remote push on purpose (SDK 53).

**Samsung**

1. Open the **Expo Go** app.
2. Tap **Scan QR code**.
3. Scan the **same** QR from the computer.
4. Sign in as the other user on the second phone.
5. Sign in. Remote push is skipped in Expo Go on Android so the app does not crash.

If the QR does nothing on iOS, in Expo Go tap “Enter URL manually” and paste the `exp://…` line from the terminal.

### 4. Confirm

Settings → **Expo Go** / API line must show the LAN or tunnel URL, not `127.0.0.1`. Inject a demo lead (or a real Angi lead) — both phones should see it in Unclaimed with an in-app banner. Remote Expo Push is registered only in a development or production build, not Expo Go Android (SDK 53 removed it and throws if called).

## EAS / TestFlight / Play (can wait)

Not needed to test on device. When you want a home-screen icon without Expo Go: Expo account + Apple Developer (~$99/year) + Play Console (~$25). Then from `mobile/`: `eas login`, `eas init`, `eas build --platform ios --profile preview`, `eas build --platform android --profile preview`. Full notes stay in git history / ask when you are ready to ship stores.

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
