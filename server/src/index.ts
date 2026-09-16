import "dotenv/config";
import { createServer } from "node:http";
import { getRequestListener } from "@hono/node-server";
import { Hono } from "hono";
import { cors } from "hono/cors";
import { streamSSE } from "hono/streaming";
import httpProxy from "http-proxy";
import { parse } from "csv-parse/sync";
import { seedUsers, signToken, toPublicUser, updateDisplayName, savePushToken, verifyLogin, verifyToken, findUserById, listUsers } from "./auth.ts";
import { db, getSyncRevision } from "./db.ts";
import { subscribe } from "./bus.ts";
import {
  addNote,
  claimLead,
  followUpLead,
  getLead,
  inboxCount,
  insertNormalizedLead,
  listArchive,
  listMine,
  listUnclaimed,
  markLost,
  markSold,
  toPublicLead,
} from "./leads.ts";
import { notifyClaimed } from "./push.ts";
import { angiStatus, buildDemoLead, ingestLeads, startAngiPoller, syncFromAngi } from "./sync/angi.ts";
import { normalizeMany, rowsFromCsv } from "./sync/normalize.ts";

seedUsers();

const existing = db.prepare("SELECT COUNT(*) AS n FROM leads").get() as { n: number };
if (!existing.n) {
  insertNormalizedLead({
    externalId: "angi-seed-100001",
    angiUrl: "https://office.angi.com/leads/angi-seed-100001",
    customerName: "Dana Holloway",
    phone: "512-555-0160",
    email: "dana.holloway@example.com",
    addressLine1: "1109 E 11th St",
    city: "Austin",
    state: "TX",
    zip: "78702",
    service: "New construction plans",
    description:
      "Seeded sample lead so both phones have something to claim. Replace this workflow with live Angi sync, webhook, or CSV import.",
    source: "seed",
    createdAt: new Date().toISOString(),
  });
}

const app = new Hono().basePath("/api");

app.use(
  "*",
  cors({
    origin: "*",
    allowHeaders: ["Content-Type", "Authorization", "X-API-KEY"],
    allowMethods: ["GET", "POST", "PATCH", "OPTIONS"],
  })
);

type AuthUser = { id: string; email: string; displayName: string };

function readBearer(header: string | undefined): string | null {
  if (!header) return null;
  const [type, token] = header.split(" ");
  if (type?.toLowerCase() !== "bearer" || !token) return null;
  return token;
}

function currentUser(c: { req: { header: (name: string) => string | undefined } }): AuthUser | null {
  const token = readBearer(c.req.header("authorization"));
  if (!token) return null;
  const payload = verifyToken(token);
  if (!payload) return null;
  const user = findUserById(payload.sub);
  if (!user) return null;
  return { id: user.id, email: user.email, displayName: user.display_name };
}

function requireUser(c: Parameters<typeof currentUser>[0]): AuthUser {
  const user = currentUser(c);
  if (!user) {
    throw Object.assign(new Error("Unauthorized"), { status: 401 });
  }
  return user;
}

app.get("/health", (c) =>
  c.json({
    ok: true,
    service: "apex-drafting-api",
    revision: getSyncRevision(),
    unclaimed: inboxCount(),
    angi: angiStatus(),
  })
);

app.post("/auth/login", async (c) => {
  const body = await c.req.json().catch(() => ({}));
  const email = String(body.email || "").trim();
  const password = String(body.password || "");
  if (!email || !password) return c.json({ error: "Email and password are required" }, 400);
  const user = verifyLogin(email, password);
  if (!user) return c.json({ error: "Invalid email or password" }, 401);
  return c.json({ token: signToken(user), user: toPublicUser(user) });
});

app.get("/auth/me", (c) => {
  const user = currentUser(c);
  if (!user) return c.json({ error: "Unauthorized" }, 401);
  const row = findUserById(user.id)!;
  return c.json({ user: toPublicUser(row), teammates: listUsers().map(toPublicUser) });
});

app.patch("/auth/me", async (c) => {
  try {
    const user = requireUser(c);
    const body = await c.req.json().catch(() => ({}));
    const displayName = String(body.displayName || "").trim();
    if (displayName.length < 2) return c.json({ error: "Display name must be at least 2 characters" }, 400);
    const updated = updateDisplayName(user.id, displayName);
    return c.json({ user: toPublicUser(updated) });
  } catch (err) {
    return c.json({ error: "Unauthorized" }, 401);
  }
});

app.post("/auth/push-token", async (c) => {
  try {
    const user = requireUser(c);
    const body = await c.req.json().catch(() => ({}));
    const token = body.token ? String(body.token) : null;
    savePushToken(user.id, token);
    return c.json({ ok: true });
  } catch {
    return c.json({ error: "Unauthorized" }, 401);
  }
});

app.get("/leads/sync-state", (c) => {
  if (!currentUser(c)) return c.json({ error: "Unauthorized" }, 401);
  return c.json({ revision: getSyncRevision(), unclaimed: inboxCount() });
});

app.get("/leads/unclaimed", (c) => {
  const user = currentUser(c);
  if (!user) return c.json({ error: "Unauthorized" }, 401);
  return c.json({ leads: listUnclaimed(user.id) });
});

app.get("/leads/mine", (c) => {
  const user = currentUser(c);
  if (!user) return c.json({ error: "Unauthorized" }, 401);
  return c.json({ leads: listMine(user.id) });
});

app.get("/leads/archive", (c) => {
  const user = currentUser(c);
  if (!user) return c.json({ error: "Unauthorized" }, 401);
  const stage = c.req.query("stage");
  const filtered = stage === "sold" || stage === "lost" ? stage : undefined;
  return c.json({ leads: listArchive(user.id, filtered) });
});

app.get("/leads/:id", (c) => {
  const user = currentUser(c);
  if (!user) return c.json({ error: "Unauthorized" }, 401);
  const lead = getLead(c.req.param("id"));
  if (!lead) return c.json({ error: "Lead not found" }, 404);
  return c.json({ lead: toPublicLead(lead, user.id) });
});

app.post("/leads/:id/claim", async (c) => {
  const user = currentUser(c);
  if (!user) return c.json({ error: "Unauthorized" }, 401);
  const result = claimLead(c.req.param("id"), user.id);
  if (!result.ok && result.reason === "not_found") return c.json({ error: "Lead not found" }, 404);
  if (!result.ok) {
    return c.json(
      {
        error: result.lead?.claimedByName
          ? `${result.lead.claimedByName} already claimed this lead`
          : "This lead was already claimed",
        lead: result.lead,
      },
      409
    );
  }
  void notifyClaimed(result.lead, user.displayName);
  return c.json({ lead: result.lead });
});

app.post("/leads/:id/follow-up", async (c) => {
  const user = currentUser(c);
  if (!user) return c.json({ error: "Unauthorized" }, 401);
  const body = await c.req.json().catch(() => ({}));
  const result = followUpLead(c.req.param("id"), user.id, body.note);
  if ("error" in result) return c.json({ error: result.error }, result.status);
  return c.json({ lead: result });
});

app.post("/leads/:id/sold", async (c) => {
  const user = currentUser(c);
  if (!user) return c.json({ error: "Unauthorized" }, 401);
  const body = await c.req.json().catch(() => ({}));
  const result = markSold(c.req.param("id"), user.id, body.note);
  if ("error" in result) return c.json({ error: result.error }, result.status);
  return c.json({ lead: result });
});

app.post("/leads/:id/lost", async (c) => {
  const user = currentUser(c);
  if (!user) return c.json({ error: "Unauthorized" }, 401);
  const body = await c.req.json().catch(() => ({}));
  const result = markLost(c.req.param("id"), user.id, body.note);
  if ("error" in result) return c.json({ error: result.error }, result.status);
  return c.json({ lead: result });
});

app.post("/leads/:id/notes", async (c) => {
  const user = currentUser(c);
  if (!user) return c.json({ error: "Unauthorized" }, 401);
  const body = await c.req.json().catch(() => ({}));
  const note = String(body.note || "").trim();
  if (!note) return c.json({ error: "Note is required" }, 400);
  const result = addNote(c.req.param("id"), user.id, note);
  if ("error" in result) return c.json({ error: result.error }, result.status);
  return c.json({ lead: result });
});

app.post("/import/json", async (c) => {
  if (!currentUser(c)) return c.json({ error: "Unauthorized" }, 401);
  const body = await c.req.json().catch(() => null);
  const leads = normalizeMany(body, "manual-json");
  if (!leads.length) {
    return c.json({ error: "No recognizable leads. Need at least a name and Angi lead id." }, 400);
  }
  const result = await ingestLeads(leads, "import");
  return c.json(result);
});

app.post("/import/csv", async (c) => {
  if (!currentUser(c)) return c.json({ error: "Unauthorized" }, 401);
  const text = await c.req.text();
  if (!text.trim()) return c.json({ error: "CSV body is empty" }, 400);
  try {
    const records = parse(text, { columns: true, skip_empty_lines: true, trim: true }) as Record<string, string>[];
    const leads = rowsFromCsv(records);
    if (!leads.length) {
      return c.json({ error: "CSV parsed but no rows had a lead id and customer name" }, 400);
    }
    const result = await ingestLeads(leads, "import");
    return c.json(result);
  } catch (err) {
    return c.json({ error: `CSV parse failed: ${err instanceof Error ? err.message : String(err)}` }, 400);
  }
});

app.post("/webhooks/angi", async (c) => {
  const expected = process.env.ANGI_WEBHOOK_KEY;
  if (!expected) {
    return c.json(
      { error: "Set ANGI_WEBHOOK_KEY to enable the Angi CRM webhook, or import CSV/JSON instead." },
      501
    );
  }
  const provided = c.req.header("x-api-key") || c.req.header("authorization")?.replace(/^Bearer /i, "");
  if (provided !== expected) return c.json({ error: "Invalid webhook key" }, 401);
  const body = await c.req.json().catch(() => null);
  const leads = normalizeMany(body, "angi-webhook");
  if (!leads.length) return c.json({ error: "Unrecognized Angi payload" }, 400);
  const result = await ingestLeads(leads, "import");
  return c.json(result);
});

app.post("/sync/angi", async (c) => {
  if (!currentUser(c)) return c.json({ error: "Unauthorized" }, 401);
  const result = await syncFromAngi();
  return c.json(result, result.ok ? 200 : 422);
});

app.post("/sync/simulate", async (c) => {
  if (!currentUser(c)) return c.json({ error: "Unauthorized" }, 401);
  const result = await ingestLeads([buildDemoLead()], "simulate");
  return c.json(result);
});

app.get("/sync/status", (c) => {
  if (!currentUser(c)) return c.json({ error: "Unauthorized" }, 401);
  return c.json(angiStatus());
});

app.get("/events", (c) => {
  const token = c.req.query("token") || readBearer(c.req.header("authorization"));
  const payload = token ? verifyToken(token) : null;
  if (!payload) return c.json({ error: "Unauthorized" }, 401);

  return streamSSE(c, async (stream) => {
    let alive = true;
    const send = async (data: unknown) => {
      if (!alive) return;
      await stream.writeSSE({ data: JSON.stringify(data) });
    };
    await send({ type: "hello", revision: getSyncRevision() });
    const unsubscribe = subscribe(async (event) => {
      await send({ ...event, revision: getSyncRevision() });
    });
    const ping = setInterval(() => {
      void send({ type: "ping", revision: getSyncRevision() });
    }, 15000);
    stream.onAbort(() => {
      alive = false;
      unsubscribe();
      clearInterval(ping);
    });
    while (alive) {
      await stream.sleep(30000);
    }
  });
});

const apiPort = Number(process.env.PORT || 43121);
const expoWebPort = Number(process.env.EXPO_WEB_PORT || 43122);
const listenHost = process.env.HOST || "0.0.0.0";
const proxyEnabled = process.env.PROXY_EXPO_WEB !== "0";

const listener = getRequestListener(app.fetch);
const proxy = httpProxy.createProxyServer({
  target: `http://127.0.0.1:${expoWebPort}`,
  ws: true,
  xfwd: true,
});

proxy.on("error", (err, _req, res) => {
  if (res && "writeHead" in res) {
    res.writeHead(502, { "content-type": "application/json" });
    res.end(
      JSON.stringify({
        error: "Expo web is not running yet. Start it with npm run dev:app, or open /api/health.",
        detail: err.message,
      })
    );
  }
});

const server = createServer((req, res) => {
  const url = req.url || "/";
  if (url.startsWith("/api") || url.startsWith("/health")) {
    if (url === "/health") req.url = "/api/health";
    void listener(req, res);
    return;
  }
  if (!proxyEnabled) {
    res.writeHead(404, { "content-type": "application/json" });
    res.end(JSON.stringify({ error: "Not found" }));
    return;
  }
  proxy.web(req, res);
});

server.on("upgrade", (req, socket, head) => {
  if ((req.url || "").startsWith("/api")) {
    socket.destroy();
    return;
  }
  proxy.ws(req, socket, head);
});

server.listen(apiPort, listenHost, () => {
  console.log(`APEX Drafting API on http://${listenHost}:${apiPort}`);
  console.log(`Web preview (proxied Expo) http://127.0.0.1:${apiPort}`);
  startAngiPoller();
});
