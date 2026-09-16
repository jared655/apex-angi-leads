# Deploy the APEX lead-desk API (always-on)

Phones call this Node API over HTTPS. Local Expo Go on the same Wi‑Fi still works; this is the off-network path.

CORS already allows any mobile origin (`Access-Control-Allow-Origin: *`). Do not commit `.env`, cookies, passwords, or JWT secrets.

## 1. Create the Fly app

From the **repository root** (needs [flyctl](https://fly.io/docs/flyctl/install/) and a Fly account):

```bash
fly auth login
fly apps create apex-angi-leads-api
```

If the name is taken, create another and set `app` in `fly.toml` to match.

Primary region in `fly.toml` is `dfw` (change if you prefer). SQLite + a volume must stay on **one Machine**.

## 2. Create the volume

```bash
fly volumes create apex_data --app apex-angi-leads-api --region dfw --size 1
```

`fly.toml` mounts that volume at `/data` and sets `DATABASE_PATH=/data/apex.sqlite`. First deploy can also create a 1GB volume via `initial_size` if none exists.

## 3. Set secrets

Set values in the Fly dashboard or with `fly secrets set`. **Names only — put real values on your machine, never in git:**

Required:

- `JWT_SECRET`

Seed logins (override the example passwords from `server/.env.example`):

- `USER_JARED_PASSWORD`
- `USER_REUBEN_PASSWORD`

Angi live sync (cookie poll is the reliable path; password login is usually blocked by Cloudflare):

- `ANGI_SESSION_COOKIE`
- `ANGI_PASSWORD` (optional)
- `ANGI_WEBHOOK_KEY` (optional; CRM webhook)
- `ANGI_CALLER_ID` (optional if the leads URL already contains `/angiLeads/<id>/` or `/app/h/<id>/`)
- `ANGI_LEADS_API_URL` (optional; treat as secret if it includes account ids)

Example (paste values locally, do not echo them into the repo):

```bash
fly secrets set JWT_SECRET
# fly secrets set USER_JARED_PASSWORD USER_REUBEN_PASSWORD
# fly secrets set ANGI_SESSION_COOKIE ANGI_CALLER_ID ANGI_LEADS_API_URL
```

Non-secret Fly env is already in `fly.toml`: `HOST`, `PORT`, `DATABASE_PATH`, `PROXY_EXPO_WEB=0`, `NODE_ENV`. You can also `fly secrets set` / `fly scale` without changing those.

Optional non-secret env (CLI or dashboard): `ANGI_EMAIL`, `ANGI_CALLER_TYPE` (default `ServiceProvider`), `ANGI_POLL_INTERVAL_MS`, `USER_JARED_EMAIL`, `USER_REUBEN_EMAIL`, `USER_JARED_NAME`, `USER_REUBEN_NAME`.

## 4. Deploy

```bash
fly deploy --ha=false
```

`--ha=false` keeps a single Machine so two SQLite volumes do not diverge. Confirm `fly scale count` stays at **1**.

Image: Node 22, `npm ci` in `server/Dockerfile`, `CMD npm start` (same script as `server/package.json`: `tsx src/index.ts`). Listens on `process.env.PORT` (8080 on Fly) at `HOST=0.0.0.0`.

## 5. Health check

```bash
curl -sS https://apex-angi-leads-api.fly.dev/api/health
```

Expect JSON `{ "ok": true, "service": "apex-drafting-api", ... }`. Fly also checks `GET /api/health` on the private network.

Replace the hostname if your app name differs (`https://<app>.fly.dev`).

## 6. Point Expo at the public URL

In `mobile/.env` (gitignored) for **Expo Go / Metro**:

```
EXPO_PUBLIC_API_URL=https://apex-angi-leads-api.fly.dev
```

No trailing slash. Restart Metro (`npm run go` / `npm run lan`). Phones no longer need the PC or the same Wi‑Fi for the API.

**EAS installable builds** bake the same URL in `mobile/eas.json` (`EXPO_PUBLIC_API_URL` on development / preview / production). After `eas build`, no Metro or Expo Go is required — see [mobile/INSTALL.md](mobile/INSTALL.md).

Local Windows + Expo Go is unchanged: keep `EXPO_PUBLIC_API_URL=http://<LAN-IP>:43121` and `npm --prefix server run dev` when you are not using Fly.

## Angi cookie on Fly

1. Chrome → [office.angi.com](https://office.angi.com) → Leads.
2. DevTools → Network → copy the **Cookie** header into `ANGI_SESSION_COOKIE`.
3. If poll returns 0 leads, copy the lead-summaries XHR URL into `ANGI_LEADS_API_URL`.
4. `fly secrets set` those names, then `fly apps restart apex-angi-leads-api` (or redeploy).

The API sends `X-ANGI-CallerType` / `X-ANGI-CallerId` and a lead-board `Referer` when calling Angi gateway URLs.

## Railway (optional)

Same `server/Dockerfile` works if you set the Docker build context to the **repo root** and Dockerfile path `server/Dockerfile`. Attach a persistent volume at `/data`, set `DATABASE_PATH=/data/apex.sqlite`, `HOST=0.0.0.0`, `PORT` from the platform, `PROXY_EXPO_WEB=0`, and the same secret names as above. Health: `GET /api/health`.
