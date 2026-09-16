import bcrypt from "bcryptjs";
import jwt from "jsonwebtoken";
import { db, nowIso } from "./db.ts";
import type { PublicUser, UserRow } from "./types.ts";

const JWT_SECRET = process.env.JWT_SECRET || "apex-drafting-dev-secret-change-me";
const JWT_EXPIRES = "30d";

export const SEED_USERS = [
  {
    id: "user_jared",
    email: process.env.USER_JARED_EMAIL || "jared@apexdrafting.local",
    password: process.env.USER_JARED_PASSWORD || "ApexJared1!",
    displayName: process.env.USER_JARED_NAME || "Jared",
  },
  {
    id: "user_reuben",
    email: process.env.USER_REUBEN_EMAIL || "reuben@apexdrafting.local",
    password: process.env.USER_REUBEN_PASSWORD || "ApexReuben1!",
    displayName: process.env.USER_REUBEN_NAME || "Reuben",
  },
] as const;

export function seedUsers(): void {
  const insert = db.prepare(
    `INSERT INTO users (id, email, password_hash, display_name, expo_push_token, created_at)
     VALUES (?, ?, ?, ?, NULL, ?)
     ON CONFLICT(email) DO UPDATE SET
       password_hash = excluded.password_hash`
  );

  for (const user of SEED_USERS) {
    const existing = db.prepare("SELECT id, display_name FROM users WHERE email = ?").get(user.email) as
      | { id: string; display_name: string }
      | undefined;
    const hash = bcrypt.hashSync(user.password, 10);
    if (existing) {
      db.prepare("UPDATE users SET password_hash = ? WHERE email = ?").run(hash, user.email);
      continue;
    }
    insert.run(user.id, user.email.toLowerCase(), hash, user.displayName, nowIso());
  }
}

export function toPublicUser(row: UserRow): PublicUser {
  return {
    id: row.id,
    email: row.email,
    displayName: row.display_name,
  };
}

export function findUserByEmail(email: string): UserRow | undefined {
  return db.prepare("SELECT * FROM users WHERE email = ?").get(email.toLowerCase()) as UserRow | undefined;
}

export function findUserById(id: string): UserRow | undefined {
  return db.prepare("SELECT * FROM users WHERE id = ?").get(id) as UserRow | undefined;
}

export function listUsers(): UserRow[] {
  return db.prepare("SELECT * FROM users ORDER BY display_name").all() as UserRow[];
}

export function verifyLogin(email: string, password: string): UserRow | null {
  const user = findUserByEmail(email);
  if (!user) return null;
  if (!bcrypt.compareSync(password, user.password_hash)) return null;
  return user;
}

export function signToken(user: UserRow): string {
  return jwt.sign({ sub: user.id, email: user.email }, JWT_SECRET, { expiresIn: JWT_EXPIRES });
}

export function verifyToken(token: string): { sub: string; email: string } | null {
  try {
    return jwt.verify(token, JWT_SECRET) as { sub: string; email: string };
  } catch {
    return null;
  }
}

export function updateDisplayName(userId: string, displayName: string): UserRow {
  db.prepare("UPDATE users SET display_name = ? WHERE id = ?").run(displayName.trim(), userId);
  const user = findUserById(userId);
  if (!user) throw new Error("User not found");
  return user;
}

export function savePushToken(userId: string, token: string | null): void {
  db.prepare("UPDATE users SET expo_push_token = ? WHERE id = ?").run(token, userId);
}
