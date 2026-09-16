import { DatabaseSync } from "node:sqlite";
import { mkdirSync } from "node:fs";
import { dirname, resolve } from "node:path";

const dbPath = process.env.DATABASE_PATH || resolve(process.cwd(), "data", "apex.sqlite");

if (dbPath !== ":memory:") {
  mkdirSync(dirname(dbPath), { recursive: true });
}

export const db = new DatabaseSync(dbPath);

db.exec("PRAGMA journal_mode = WAL;");
db.exec("PRAGMA foreign_keys = ON;");
db.exec("PRAGMA busy_timeout = 5000;");

db.exec(`
CREATE TABLE IF NOT EXISTS users (
  id TEXT PRIMARY KEY,
  email TEXT NOT NULL UNIQUE,
  password_hash TEXT NOT NULL,
  display_name TEXT NOT NULL,
  expo_push_token TEXT,
  created_at TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS leads (
  id TEXT PRIMARY KEY,
  external_id TEXT NOT NULL UNIQUE,
  angi_url TEXT,
  customer_name TEXT NOT NULL,
  phone TEXT,
  email TEXT,
  address_line1 TEXT,
  city TEXT,
  state TEXT,
  zip TEXT,
  service TEXT,
  description TEXT,
  interview_json TEXT,
  source TEXT NOT NULL DEFAULT 'angi',
  stage TEXT NOT NULL DEFAULT 'unclaimed',
  claimed_by TEXT,
  claimed_at TEXT,
  needs_follow_up INTEGER NOT NULL DEFAULT 0,
  follow_up_at TEXT,
  sold_at TEXT,
  lost_at TEXT,
  created_at TEXT NOT NULL,
  imported_at TEXT NOT NULL,
  updated_at TEXT NOT NULL,
  FOREIGN KEY (claimed_by) REFERENCES users(id)
);

CREATE TABLE IF NOT EXISTS lead_events (
  id TEXT PRIMARY KEY,
  lead_id TEXT NOT NULL,
  user_id TEXT,
  type TEXT NOT NULL,
  note TEXT,
  created_at TEXT NOT NULL,
  FOREIGN KEY (lead_id) REFERENCES leads(id),
  FOREIGN KEY (user_id) REFERENCES users(id)
);

CREATE TABLE IF NOT EXISTS settings (
  key TEXT PRIMARY KEY,
  value TEXT NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_leads_stage ON leads(stage);
CREATE INDEX IF NOT EXISTS idx_leads_claimed_by ON leads(claimed_by);
CREATE INDEX IF NOT EXISTS idx_lead_events_lead ON lead_events(lead_id);
`);

export function nowIso(): string {
  return new Date().toISOString();
}

export function getSetting(key: string): string | null {
  const row = db.prepare("SELECT value FROM settings WHERE key = ?").get(key) as
    | { value: string }
    | undefined;
  return row?.value ?? null;
}

export function setSetting(key: string, value: string): void {
  db.prepare(
    `INSERT INTO settings (key, value) VALUES (?, ?)
     ON CONFLICT(key) DO UPDATE SET value = excluded.value`
  ).run(key, value);
}

export function deleteSetting(key: string): void {
  db.prepare("DELETE FROM settings WHERE key = ?").run(key);
}

export function bumpSyncRevision(): number {
  const current = Number(getSetting("sync_revision") || "0");
  const next = current + 1;
  setSetting("sync_revision", String(next));
  return next;
}

export function getSyncRevision(): number {
  return Number(getSetting("sync_revision") || "0");
}
