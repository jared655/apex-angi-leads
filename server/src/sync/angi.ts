import * as cheerio from "cheerio";
import { insertNormalizedLead } from "../leads.ts";
import { getSetting, setSetting } from "../db.ts";
import { emit } from "../bus.ts";
import { notifyNewLead } from "../push.ts";
import { normalizeLead, normalizeMany } from "./normalize.ts";
import type { NormalizedLead } from "../types.ts";

const OFFICE = "https://office.angi.com";

export type SyncResult = {
  ok: boolean;
  mode: "disabled" | "poll" | "import" | "simulate";
  inserted: number;
  skipped: number;
  errors: string[];
  message: string;
};

function configured(): boolean {
  return Boolean(
    process.env.ANGI_SESSION_COOKIE ||
      (process.env.ANGI_EMAIL && process.env.ANGI_PASSWORD)
  );
}

async function loginIfNeeded(cookieFromEnv: string | undefined): Promise<{ cookie: string; errors: string[] }> {
  if (cookieFromEnv) {
    return { cookie: cookieFromEnv, errors: [] };
  }
  const email = process.env.ANGI_EMAIL;
  const password = process.env.ANGI_PASSWORD;
  if (!email || !password) {
    return { cookie: "", errors: ["ANGI_EMAIL and ANGI_PASSWORD are not set"] };
  }

  const errors: string[] = [];
  try {
    const loginUrl = process.env.ANGI_LOGIN_URL || `${OFFICE}/login`;
    const page = await fetch(loginUrl, { redirect: "follow" });
    const html = await page.text();
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
        "content-type": "application/x-www-form-urlencoded",
        cookie: setCookies.map((c) => c.split(";")[0]).join("; "),
        origin: OFFICE,
        referer: loginUrl,
      },
      body,
      redirect: "manual",
    });
    const nextCookies = res.headers.getSetCookie?.() ?? [];
    const cookie = [...setCookies, ...nextCookies].map((c) => c.split(";")[0]).join("; ");
    if (!cookie) errors.push("Angi login returned no session cookie. Set ANGI_SESSION_COOKIE from a logged-in browser.");
    return { cookie, errors };
  } catch (err) {
    errors.push(`Angi login failed: ${err instanceof Error ? err.message : String(err)}`);
    return { cookie: "", errors };
  }
}

function parseLeadsFromHtml(html: string): NormalizedLead[] {
  const $ = cheerio.load(html);
  const found: NormalizedLead[] = [];

  $("script[type='application/json'], script#__NEXT_DATA__, script[id*='data']").each((_, el) => {
    const text = $(el).text();
    if (!text.includes("lead") && !text.includes("Lead")) return;
    try {
      const json = JSON.parse(text);
      found.push(...normalizeMany(json, "angi-html"));
    } catch {
      // ignore non-json
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

  return found;
}

async function fetchJsonCandidates(cookie: string): Promise<{ leads: NormalizedLead[]; errors: string[] }> {
  const errors: string[] = [];
  const leads: NormalizedLead[] = [];
  const endpoints = (process.env.ANGI_LEADS_API_URL || "")
    .split(",")
    .map((item) => item.trim())
    .filter(Boolean)
    .concat([
      `${OFFICE}/api/leads`,
      `${OFFICE}/api/v1/leads`,
      `${OFFICE}/api/pro/leads`,
      `${OFFICE}/leads?format=json`,
    ]);

  for (const url of endpoints) {
    try {
      const res = await fetch(url, {
        headers: {
          cookie,
          accept: "application/json,text/html;q=0.9",
          "user-agent": "APEX-Drafting-LeadSync/1.0",
        },
        redirect: "follow",
      });
      const contentType = res.headers.get("content-type") || "";
      const text = await res.text();
      if (!res.ok) {
        errors.push(`${url} -> HTTP ${res.status}`);
        continue;
      }
      if (contentType.includes("json")) {
        const json = JSON.parse(text);
        const batch = normalizeMany(json, "angi-api");
        if (batch.length) {
          leads.push(...batch);
          break;
        }
        errors.push(`${url} returned JSON but no recognizable leads`);
      } else {
        const batch = parseLeadsFromHtml(text);
        if (batch.length) {
          leads.push(...batch);
          break;
        }
        errors.push(`${url} returned HTML with no parseable leads (Angi UI likely changed or login required)`);
      }
    } catch (err) {
      errors.push(`${url} failed: ${err instanceof Error ? err.message : String(err)}`);
    }
  }
  return { leads, errors };
}

export async function ingestLeads(
  leads: NormalizedLead[],
  mode: SyncResult["mode"]
): Promise<SyncResult> {
  let inserted = 0;
  let skipped = 0;
  const createdIds: string[] = [];

  for (const lead of leads) {
    const result = insertNormalizedLead(lead);
    if (result.created) {
      inserted += 1;
      createdIds.push(result.lead.id);
      void notifyNewLead(result.lead);
    } else {
      skipped += 1;
    }
  }

  emit({ type: "sync.completed", inserted, skipped });
  setSetting("last_sync_at", new Date().toISOString());
  setSetting("last_sync_mode", mode);
  setSetting("last_sync_inserted", String(inserted));

  return {
    ok: true,
    mode,
    inserted,
    skipped,
    errors: [],
    message:
      inserted > 0
        ? `Imported ${inserted} new lead${inserted === 1 ? "" : "s"} (${skipped} already stored).`
        : skipped
          ? `No new leads. ${skipped} already stored.`
          : "No leads in this payload.",
  };
}

export async function syncFromAngi(): Promise<SyncResult> {
  if (!configured()) {
    return {
      ok: false,
      mode: "disabled",
      inserted: 0,
      skipped: 0,
      errors: [],
      message:
        "Angi polling is off. Set ANGI_SESSION_COOKIE or ANGI_EMAIL + ANGI_PASSWORD, or import JSON/CSV / use the webhook.",
    };
  }

  const { cookie, errors } = await loginIfNeeded(process.env.ANGI_SESSION_COOKIE);
  if (!cookie) {
    return {
      ok: false,
      mode: "poll",
      inserted: 0,
      skipped: 0,
      errors,
      message: "Could not obtain an Angi session. Use CSV/JSON import or the CRM webhook.",
    };
  }

  const fetched = await fetchJsonCandidates(cookie);
  if (!fetched.leads.length) {
    return {
      ok: false,
      mode: "poll",
      inserted: 0,
      skipped: 0,
      errors: [...errors, ...fetched.errors],
      message:
        "Angi poll ran but found 0 leads. office.angi.com has no public API; HTML/XHR shapes change. Import a CSV/JSON export or point Angi CRM to POST /api/webhooks/angi.",
    };
  }

  const result = await ingestLeads(fetched.leads, "poll");
  result.errors = fetched.errors;
  return result;
}

export function angiStatus(): {
  pollingEnabled: boolean;
  lastSyncAt: string | null;
  lastSyncMode: string | null;
  lastSyncInserted: string | null;
  webhookEnabled: boolean;
} {
  return {
    pollingEnabled: configured(),
    lastSyncAt: getSetting("last_sync_at"),
    lastSyncMode: getSetting("last_sync_mode"),
    lastSyncInserted: getSetting("last_sync_inserted"),
    webhookEnabled: Boolean(process.env.ANGI_WEBHOOK_KEY),
  };
}

let timer: ReturnType<typeof setInterval> | null = null;

export function startAngiPoller(): void {
  const ms = Number(process.env.ANGI_POLL_INTERVAL_MS || 60000);
  if (!configured()) {
    console.log("Angi poller idle (no credentials). Import, simulate, or webhook will still work.");
    return;
  }
  console.log(`Angi poller starting every ${ms}ms`);
  void syncFromAngi();
  timer = setInterval(() => {
    void syncFromAngi().catch((err) => console.error("Angi poll error", err));
  }, Math.max(ms, 15000));
}

export function stopAngiPoller(): void {
  if (timer) clearInterval(timer);
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
