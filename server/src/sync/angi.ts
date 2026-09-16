import * as cheerio from "cheerio";
import { insertNormalizedLead } from "../leads.ts";
import { getSetting, setSetting } from "../db.ts";
import { emit } from "../bus.ts";
import { notifyNewLead } from "../push.ts";
import { normalizeLead, normalizeMany } from "./normalize.ts";
import { angiPollingReady, getAngiConfig, publicAngiStatusExtras } from "./credentials.ts";
import type { NormalizedLead } from "../types.ts";

const OFFICE = "https://office.angi.com";
const BROWSER_UA =
  "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/128.0.0.0 Safari/537.36";

export type SyncResult = {
  ok: boolean;
  mode: "disabled" | "poll" | "import" | "simulate";
  inserted: number;
  skipped: number;
  errors: string[];
  message: string;
};

function browserHeaders(cookie: string): Record<string, string> {
  return {
    cookie,
    accept: "application/json, text/html;q=0.9, */*;q=0.8",
    "accept-language": "en-US,en;q=0.9",
    "user-agent": BROWSER_UA,
    origin: OFFICE,
    referer: `${OFFICE}/`,
  };
}

function looksLikeLoginWall(text: string, status: number): boolean {
  if (status === 401 || status === 403) return true;
  const sample = text.slice(0, 4000).toLowerCase();
  return (
    sample.includes("id.angi.com") ||
    sample.includes("performing security verification") ||
    (sample.includes("sign in") && sample.includes("password") && sample.includes("forgot"))
  );
}

function harvestLeads(node: unknown, out: NormalizedLead[], depth = 0): void {
  if (depth > 8 || node === null || node === undefined) return;
  const normalized = normalizeLead(node, "angi-poll");
  if (normalized) out.push(normalized);
  if (Array.isArray(node)) {
    for (const item of node) harvestLeads(item, out, depth + 1);
    return;
  }
  if (typeof node === "object") {
    for (const value of Object.values(node as Record<string, unknown>)) {
      harvestLeads(value, out, depth + 1);
    }
  }
}

function uniqueLeads(leads: NormalizedLead[]): NormalizedLead[] {
  const seen = new Set<string>();
  const out: NormalizedLead[] = [];
  for (const lead of leads) {
    if (seen.has(lead.externalId)) continue;
    seen.add(lead.externalId);
    out.push(lead);
  }
  return out;
}

async function loginIfNeeded(cookieFromConfig: string, email: string, password: string): Promise<{ cookie: string; errors: string[] }> {
  if (cookieFromConfig) {
    return { cookie: cookieFromConfig, errors: [] };
  }
  if (!email || !password) {
    return { cookie: "", errors: ["No Angi session cookie. Email/password login is usually blocked by Cloudflare on id.angi.com — paste the Cookie header instead."] };
  }

  const errors: string[] = [];
  try {
    const loginUrl = process.env.ANGI_LOGIN_URL || `${OFFICE}/login`;
    const page = await fetch(loginUrl, { redirect: "follow", headers: browserHeaders("") });
    const html = await page.text();
    if (looksLikeLoginWall(html, page.status)) {
      errors.push(
        "Angi login page is behind Cloudflare (id.angi.com). The server cannot complete that challenge. Paste ANGI_SESSION_COOKIE from a logged-in browser."
      );
      return { cookie: "", errors };
    }
    const setCookies = page.headers.getSetCookie?.() ?? [];
    const $ = cheerio.load(html);
    const token =
      $('input[name="csrf"], input[name="_csrf"], input[name="authenticity_token"]').attr("value") || "";

    const body = new URLSearchParams({
      email,
      password,
      username: email,
      csrf: token,
      _csrf: token,
    });

    const res = await fetch(process.env.ANGI_LOGIN_POST_URL || loginUrl, {
      method: "POST",
      headers: {
        ...browserHeaders(setCookies.map((c) => c.split(";")[0]).join("; ")),
        "content-type": "application/x-www-form-urlencoded",
      },
      body,
      redirect: "manual",
    });
    const nextCookies = res.headers.getSetCookie?.() ?? [];
    const cookie = [...setCookies, ...nextCookies].map((c) => c.split(";")[0]).join("; ");
    if (!cookie || looksLikeLoginWall(await res.text().catch(() => ""), res.status)) {
      errors.push("Angi login did not return a usable session. Paste the Cookie header from office.angi.com in Chrome DevTools.");
      return { cookie: "", errors };
    }
    return { cookie, errors };
  } catch (err) {
    errors.push(`Angi login failed: ${err instanceof Error ? err.message : String(err)}`);
    return { cookie: "", errors };
  }
}

function parseLeadsFromHtml(html: string): NormalizedLead[] {
  const $ = cheerio.load(html);
  const found: NormalizedLead[] = [];

  $("script").each((_, el) => {
    const text = $(el).text();
    if (!text.includes("{")) return;
    const candidates = [text];
    const nextData = text.match(/\{[\s\S]*\}/);
    if (nextData) candidates.push(nextData[0]);
    for (const candidate of candidates) {
      try {
        harvestLeads(JSON.parse(candidate), found);
      } catch {
        // not json
      }
    }
  });

  $("table tbody tr, [data-lead-id], .lead-row, .LeadRow").each((_, el) => {
    const node = $(el);
    const externalId =
      node.attr("data-lead-id") ||
      node.find("[data-lead-id]").attr("data-lead-id") ||
      node.find("a[href*='lead']").attr("href")?.match(/(\d{5,})/)?.[1] ||
      node.find("td").first().text().trim();
    const cells = node
      .find("td")
      .toArray()
      .map((td) => $(td).text().replace(/\s+/g, " ").trim());
    const customerName = node.attr("data-name") || cells[1] || cells[0];
    if (!externalId || !customerName) return;
    const normalized = normalizeLead(
      {
        externalId,
        customerName,
        phone: cells[2],
        email: cells[3],
        service: cells[4],
        city: cells[5],
        description: cells.slice(6).join(" | "),
      },
      "angi-html"
    );
    if (normalized) found.push(normalized);
  });

  return uniqueLeads(found);
}

async function fetchLeadSources(cookie: string, customUrls: string): Promise<{ leads: NormalizedLead[]; errors: string[] }> {
  const errors: string[] = [];
  const leads: NormalizedLead[] = [];
  const endpoints = customUrls
    .split(",")
    .map((item) => item.trim())
    .filter(Boolean)
    .concat([
      `${OFFICE}/api/leads`,
      `${OFFICE}/api/v1/leads`,
      `${OFFICE}/api/pro/leads`,
      `${OFFICE}/leads`,
      `${OFFICE}/leads/all`,
      `${OFFICE}/app/leads`,
      `${OFFICE}/`,
      "https://pro.angi.com/leads",
      "https://pro.angi.com/api/leads",
    ]);

  for (const url of endpoints) {
    try {
      const res = await fetch(url, {
        headers: browserHeaders(cookie),
        redirect: "follow",
      });
      const contentType = res.headers.get("content-type") || "";
      const text = await res.text();
      if (looksLikeLoginWall(text, res.status)) {
        errors.push(`${url} → session expired or blocked (login/Cloudflare). Copy a fresh Cookie header.`);
        continue;
      }
      if (!res.ok) {
        errors.push(`${url} → HTTP ${res.status}`);
        continue;
      }
      if (contentType.includes("json") || text.trim().startsWith("{") || text.trim().startsWith("[")) {
        try {
          const batch: NormalizedLead[] = [];
          harvestLeads(JSON.parse(text), batch);
          if (batch.length) {
            leads.push(...batch);
            break;
          }
          errors.push(`${url} returned JSON but no recognizable leads (need id + name)`);
        } catch {
          errors.push(`${url} looked like JSON but failed to parse`);
        }
      } else {
        const batch = parseLeadsFromHtml(text);
        if (batch.length) {
          leads.push(...batch);
          break;
        }
        errors.push(`${url} HTML had no parseable leads`);
      }
    } catch (err) {
      errors.push(`${url} failed: ${err instanceof Error ? err.message : String(err)}`);
    }
  }
  return { leads: uniqueLeads(leads), errors };
}

function rememberSync(result: SyncResult): SyncResult {
  setSetting("last_sync_at", new Date().toISOString());
  setSetting("last_sync_mode", result.mode);
  setSetting("last_sync_inserted", String(result.inserted));
  setSetting("last_sync_error", result.ok ? "" : result.message);
  if (result.errors.length) {
    setSetting("last_sync_error_detail", result.errors.slice(0, 8).join(" | "));
  } else {
    setSetting("last_sync_error_detail", "");
  }
  return result;
}

export async function ingestLeads(
  leads: NormalizedLead[],
  mode: SyncResult["mode"]
): Promise<SyncResult> {
  let inserted = 0;
  let skipped = 0;

  for (const lead of leads) {
    const result = insertNormalizedLead(lead);
    if (result.created) {
      inserted += 1;
      void notifyNewLead(result.lead);
    } else {
      skipped += 1;
    }
  }

  emit({ type: "sync.completed", inserted, skipped });
  return rememberSync({
    ok: true,
    mode,
    inserted,
    skipped,
    errors: [],
    message:
      inserted > 0
        ? `Imported ${inserted} new lead${inserted === 1 ? "" : "s"} (${skipped} already stored). Both users are notified.`
        : skipped
          ? `No new leads. ${skipped} already stored (deduped by Angi lead id).`
          : "No leads in this payload.",
  });
}

export async function syncFromAngi(): Promise<SyncResult> {
  const config = getAngiConfig();
  if (!angiPollingReady(config)) {
    return rememberSync({
      ok: false,
      mode: "disabled",
      inserted: 0,
      skipped: 0,
      errors: [],
      message:
        "Angi is not attached. In Settings, paste your office.angi.com Cookie header (or ANGI_SESSION_COOKIE in server/.env), then tap Save & poll.",
    });
  }

  const { cookie, errors } = await loginIfNeeded(config.cookie, config.email, config.password);
  if (!cookie && !config.leadsApiUrl) {
    return rememberSync({
      ok: false,
      mode: "poll",
      inserted: 0,
      skipped: 0,
      errors,
      message: errors[0] || "Could not obtain an Angi session.",
    });
  }

  const fetched = await fetchLeadSources(cookie || config.cookie, config.leadsApiUrl);
  if (!fetched.leads.length) {
    return rememberSync({
      ok: false,
      mode: "poll",
      inserted: 0,
      skipped: 0,
      errors: [...errors, ...fetched.errors],
      message:
        "Attached to Angi but found 0 leads. office.angi.com has no public API and the HTML/XHR shape may have changed. In Chrome DevTools → Network, copy the leads XHR URL into Leads API URL, or use the CRM webhook / CSV export.",
    });
  }

  const result = await ingestLeads(fetched.leads, "poll");
  result.errors = fetched.errors;
  return result;
}

export function angiStatus() {
  const extras = publicAngiStatusExtras();
  return {
    pollingEnabled: angiPollingReady(),
    lastSyncAt: getSetting("last_sync_at"),
    lastSyncMode: getSetting("last_sync_mode"),
    lastSyncInserted: getSetting("last_sync_inserted"),
    lastError: getSetting("last_sync_error") || null,
    lastErrorDetail: getSetting("last_sync_error_detail") || null,
    pollIntervalMs: Number(process.env.ANGI_POLL_INTERVAL_MS || 60000),
    webhookPath: "/api/webhooks/angi",
    ...extras,
  };
}

let timer: ReturnType<typeof setInterval> | null = null;

export function startAngiPoller(): void {
  if (timer) {
    clearInterval(timer);
    timer = null;
  }
  const ms = Math.max(Number(process.env.ANGI_POLL_INTERVAL_MS || 60000), 15000);
  const config = getAngiConfig();
  if (!angiPollingReady(config)) {
    console.log("Angi poller idle — paste session cookie in Settings or server/.env to attach office.angi.com.");
    return;
  }
  console.log(`Angi poller attached; checking every ${ms}ms`);
  void syncFromAngi().catch((err) => console.error("Angi poll error", err));
  timer = setInterval(() => {
    void syncFromAngi().catch((err) => console.error("Angi poll error", err));
  }, ms);
}

export function restartAngiPoller(): void {
  startAngiPoller();
}

export function stopAngiPoller(): void {
  if (timer) clearInterval(timer);
  timer = null;
}

const DEMO_LEADS: Array<Omit<NormalizedLead, "externalId"> & { externalId?: string }> = [
  {
    customerName: "Elena Vasquez",
    phone: "512-555-0148",
    email: "elena.vasquez@example.com",
    addressLine1: "1842 Barton Hills Dr",
    city: "Austin",
    state: "TX",
    zip: "78704",
    service: "Custom home plans",
    description:
      "Need a full permit set for a new 2,400 sq ft hill-country home. Existing survey available. Wants covered patio and a dedicated office.",
  },
  {
    customerName: "Marcus Chen",
    phone: "737-555-0192",
    email: "marcus.chen@example.net",
    addressLine1: "902 W 32nd St",
    city: "Austin",
    state: "TX",
    zip: "78705",
    service: "ADU / garage conversion",
    description:
      "Convert detached garage into a 1-bed ADU. Needs drawings for city permit. Timeline: submit in 3 weeks.",
  },
  {
    customerName: "Priya Nair",
    phone: "512-555-0117",
    email: "priya.nair@example.com",
    addressLine1: "4410 Balcones Dr",
    city: "Austin",
    state: "TX",
    zip: "78731",
    service: "Remodel as-builts + permit set",
    description:
      "Kitchen and primary bath remodel. No existing plans. Needs as-builts and construction drawings.",
  },
];

export function buildDemoLead(): NormalizedLead {
  const template = DEMO_LEADS[Math.floor(Math.random() * DEMO_LEADS.length)]!;
  const stamp = Date.now().toString().slice(-8);
  return {
    ...template,
    externalId: `angi-demo-${stamp}-${Math.floor(Math.random() * 90 + 10)}`,
    angiUrl: `https://office.angi.com/leads/angi-demo-${stamp}`,
    source: "simulate",
    createdAt: new Date().toISOString(),
  };
}
