import { randomUUID } from "node:crypto";
import { bumpSyncRevision, db, nowIso } from "./db.ts";
import { emit } from "./bus.ts";
import type { EventRow, LeadPublic, LeadRow, NormalizedLead } from "./types.ts";
import { findUserById } from "./auth.ts";

function fullAddress(row: Pick<LeadRow, "address_line1" | "city" | "state" | "zip">): string | null {
  const parts = [row.address_line1, [row.city, row.state].filter(Boolean).join(", "), row.zip]
    .map((part) => part?.trim())
    .filter(Boolean);
  return parts.length ? parts.join(" ") : null;
}

function eventsForLead(leadId: string): LeadPublic["events"] {
  const rows = db
    .prepare(
      `SELECT e.*, u.display_name AS user_name
       FROM lead_events e
       LEFT JOIN users u ON u.id = e.user_id
       WHERE e.lead_id = ?
       ORDER BY e.created_at ASC`
    )
    .all(leadId) as (EventRow & { user_name: string | null })[];

  return rows.map((row) => ({
    id: row.id,
    type: row.type,
    note: row.note,
    userId: row.user_id,
    userName: row.user_name,
    createdAt: row.created_at,
  }));
}

export function toPublicLead(row: LeadRow, viewerId?: string): LeadPublic {
  const claimed = row.claimed_by ? findUserById(row.claimed_by) : undefined;
  let interview: LeadPublic["interview"] = null;
  if (row.interview_json) {
    try {
      interview = JSON.parse(row.interview_json);
    } catch {
      interview = null;
    }
  }

  const owned = !row.claimed_by || row.stage === "unclaimed" || row.claimed_by === viewerId;
  const events = owned ? eventsForLead(row.id) : [];

  return {
    id: row.id,
    externalId: owned ? row.external_id : row.external_id,
    angiUrl: owned ? row.angi_url : null,
    customerName: row.customer_name,
    phone: owned ? row.phone : null,
    email: owned ? row.email : null,
    addressLine1: owned ? row.address_line1 : null,
    city: owned ? row.city : null,
    state: owned ? row.state : null,
    zip: owned ? row.zip : null,
    fullAddress: owned ? fullAddress(row) : null,
    service: row.service,
    description: owned ? row.description : null,
    interview: owned ? interview : null,
    source: row.source,
    stage: row.stage,
    claimedBy: row.claimed_by,
    claimedByName: claimed?.display_name ?? null,
    claimedAt: row.claimed_at,
    needsFollowUp: owned ? Boolean(row.needs_follow_up) : false,
    followUpAt: owned ? row.follow_up_at : null,
    soldAt: owned ? row.sold_at : null,
    lostAt: owned ? row.lost_at : null,
    createdAt: row.created_at,
    importedAt: row.imported_at,
    updatedAt: row.updated_at,
    events,
  };
}

export function getLead(id: string): LeadRow | undefined {
  return db.prepare("SELECT * FROM leads WHERE id = ?").get(id) as LeadRow | undefined;
}

export function getLeadByExternalId(externalId: string): LeadRow | undefined {
  return db.prepare("SELECT * FROM leads WHERE external_id = ?").get(externalId) as LeadRow | undefined;
}

export function listUnclaimed(viewerId?: string): LeadPublic[] {
  const rows = db
    .prepare("SELECT * FROM leads WHERE stage = 'unclaimed' ORDER BY created_at DESC")
    .all() as LeadRow[];
  return rows.map((row) => toPublicLead(row, viewerId));
}

export function listMine(userId: string): LeadPublic[] {
  const rows = db
    .prepare(
      `SELECT * FROM leads
       WHERE claimed_by = ? AND stage = 'claimed'
       ORDER BY needs_follow_up DESC, updated_at DESC`
    )
    .all(userId) as LeadRow[];
  return rows.map((row) => toPublicLead(row, userId));
}

export function listArchive(userId: string, stage?: "sold" | "lost"): LeadPublic[] {
  const rows = (
    stage
      ? db
          .prepare(
            `SELECT * FROM leads
             WHERE claimed_by = ? AND stage = ?
             ORDER BY updated_at DESC`
          )
          .all(userId, stage)
      : db
          .prepare(
            `SELECT * FROM leads
             WHERE claimed_by = ? AND stage IN ('sold', 'lost')
             ORDER BY updated_at DESC`
          )
          .all(userId)
  ) as LeadRow[];
  return rows.map((row) => toPublicLead(row, userId));
}

function addEvent(leadId: string, type: string, userId: string | null, note: string | null): void {
  db.prepare(
    `INSERT INTO lead_events (id, lead_id, user_id, type, note, created_at)
     VALUES (?, ?, ?, ?, ?, ?)`
  ).run(randomUUID(), leadId, userId, type, note, nowIso());
}

export function addLeadEvent(leadId: string, type: string, userId: string | null, note: string | null): void {
  addEvent(leadId, type, userId, note);
  bumpSyncRevision();
  emit({ type: "lead.updated", leadId });
}

export function insertNormalizedLead(input: NormalizedLead): { lead: LeadPublic; created: boolean } {
  const existing = getLeadByExternalId(input.externalId);
  if (existing) {
    return { lead: toPublicLead(existing), created: false };
  }

  const id = randomUUID();
  const ts = nowIso();
  db.prepare(
    `INSERT INTO leads (
      id, external_id, angi_url, customer_name, phone, email, address_line1, city, state, zip,
      service, description, interview_json, source, stage, created_at, imported_at, updated_at
    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 'unclaimed', ?, ?, ?)`
  ).run(
    id,
    input.externalId,
    input.angiUrl ?? null,
    input.customerName,
    input.phone ?? null,
    input.email ?? null,
    input.addressLine1 ?? null,
    input.city ?? null,
    input.state ?? null,
    input.zip ?? null,
    input.service ?? null,
    input.description ?? null,
    input.interview ? JSON.stringify(input.interview) : null,
    input.source || "angi",
    input.createdAt || ts,
    ts,
    ts
  );
  addEvent(id, "imported", null, `Synced from ${input.source || "angi"}`);
  bumpSyncRevision();
  const lead = toPublicLead(getLead(id)!);
  emit({ type: "lead.created", leadId: id });
  return { lead, created: true };
}

export function claimLead(leadId: string, userId: string): { ok: true; lead: LeadPublic } | { ok: false; reason: "not_found" | "already_claimed"; lead?: LeadPublic } {
  const ts = nowIso();
  db.exec("BEGIN IMMEDIATE");
  try {
    const current = getLead(leadId);
    if (!current) {
      db.exec("ROLLBACK");
      return { ok: false, reason: "not_found" };
    }
    const result = db
      .prepare(
        `UPDATE leads
         SET stage = 'claimed', claimed_by = ?, claimed_at = ?, updated_at = ?,
             needs_follow_up = 0
         WHERE id = ? AND stage = 'unclaimed' AND claimed_by IS NULL`
      )
      .run(userId, ts, ts, leadId);

    if (result.changes !== 1) {
      const latest = getLead(leadId)!;
      db.exec("ROLLBACK");
      return { ok: false, reason: "already_claimed", lead: toPublicLead(latest, userId) };
    }

    addEvent(leadId, "claimed", userId, null);
    db.exec("COMMIT");
  } catch (err) {
    try {
      db.exec("ROLLBACK");
    } catch {
      // ignore
    }
    throw err;
  }

  bumpSyncRevision();
  const lead = toPublicLead(getLead(leadId)!, userId);
  emit({ type: "lead.claimed", leadId, userId });
  emit({ type: "lead.updated", leadId });
  return { ok: true, lead };
}

export function followUpLead(leadId: string, userId: string, note?: string): LeadPublic | { error: string; status: number } {
  const lead = getLead(leadId);
  if (!lead) return { error: "Lead not found", status: 404 };
  if (lead.claimed_by !== userId) return { error: "This lead is not in your pipeline", status: 403 };
  if (lead.stage !== "claimed") return { error: "Only active leads can be marked for follow-up", status: 409 };

  const ts = nowIso();
  db.prepare(
    `UPDATE leads SET needs_follow_up = 1, follow_up_at = ?, updated_at = ? WHERE id = ?`
  ).run(ts, ts, leadId);
  addEvent(leadId, "follow_up", userId, note?.trim() || "Follow-up logged");
  bumpSyncRevision();
  emit({ type: "lead.updated", leadId });
  return toPublicLead(getLead(leadId)!, userId);
}

export function markSold(leadId: string, userId: string, note?: string): LeadPublic | { error: string; status: number } {
  const lead = getLead(leadId);
  if (!lead) return { error: "Lead not found", status: 404 };
  if (lead.claimed_by !== userId) return { error: "This lead is not in your pipeline", status: 403 };
  if (lead.stage !== "claimed") return { error: "Only active leads can be marked sold", status: 409 };

  const ts = nowIso();
  db.prepare(
    `UPDATE leads SET stage = 'sold', sold_at = ?, needs_follow_up = 0, updated_at = ? WHERE id = ?`
  ).run(ts, ts, leadId);
  addEvent(leadId, "sold", userId, note?.trim() || null);
  bumpSyncRevision();
  emit({ type: "lead.updated", leadId });
  return toPublicLead(getLead(leadId)!, userId);
}

export function markLost(leadId: string, userId: string, note?: string): LeadPublic | { error: string; status: number } {
  const lead = getLead(leadId);
  if (!lead) return { error: "Lead not found", status: 404 };
  if (lead.claimed_by !== userId) return { error: "This lead is not in your pipeline", status: 403 };
  if (lead.stage !== "claimed") return { error: "Only active leads can be marked lost", status: 409 };

  const ts = nowIso();
  db.prepare(
    `UPDATE leads SET stage = 'lost', lost_at = ?, needs_follow_up = 0, updated_at = ? WHERE id = ?`
  ).run(ts, ts, leadId);
  addEvent(leadId, "lost", userId, note?.trim() || null);
  bumpSyncRevision();
  emit({ type: "lead.updated", leadId });
  return toPublicLead(getLead(leadId)!, userId);
}

export function addNote(leadId: string, userId: string, note: string): LeadPublic | { error: string; status: number } {
  const lead = getLead(leadId);
  if (!lead) return { error: "Lead not found", status: 404 };
  if (lead.claimed_by && lead.claimed_by !== userId && lead.stage !== "unclaimed") {
    return { error: "This lead is not in your pipeline", status: 403 };
  }
  addEvent(leadId, "note", userId, note.trim());
  db.prepare("UPDATE leads SET updated_at = ? WHERE id = ?").run(nowIso(), leadId);
  bumpSyncRevision();
  emit({ type: "lead.updated", leadId });
  return toPublicLead(getLead(leadId)!, userId);
}

export function inboxCount(): number {
  const row = db.prepare("SELECT COUNT(*) AS n FROM leads WHERE stage = 'unclaimed'").get() as { n: number };
  return row.n;
}
