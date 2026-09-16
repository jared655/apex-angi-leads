import { deleteSetting, getSetting, setSetting } from "../db.ts";

/** Confirmed Angi Pro login. Password is supplied later via secure env — never commit it. */
export const DEFAULT_ANGI_EMAIL = "apexdraftingllc@gmail.com";

export type AngiConfig = {
  cookie: string;
  email: string;
  password: string;
  leadsApiUrl: string;
  webhookKey: string;
  cookieFrom: "env" | "settings" | null;
  emailFrom: "env" | "settings" | "default" | null;
  passwordFrom: "env" | "settings" | null;
  leadsApiUrlFrom: "env" | "settings" | null;
  webhookKeyFrom: "env" | "settings" | null;
};

const SETTING_KEYS = {
  cookie: "angi_session_cookie",
  email: "angi_email",
  password: "angi_password",
  leadsApiUrl: "angi_leads_api_url",
  webhookKey: "angi_webhook_key",
} as const;

function pick(envName: string, settingKey: string): { value: string; from: "env" | "settings" | null } {
  const env = process.env[envName]?.trim() || "";
  if (env) return { value: env, from: "env" };
  const stored = getSetting(settingKey)?.trim() || "";
  if (stored) return { value: stored, from: "settings" };
  return { value: "", from: null };
}

export function getAngiConfig(): AngiConfig {
  const cookie = pick("ANGI_SESSION_COOKIE", SETTING_KEYS.cookie);
  const email = pick("ANGI_EMAIL", SETTING_KEYS.email);
  const password = pick("ANGI_PASSWORD", SETTING_KEYS.password);
  const leadsApiUrl = pick("ANGI_LEADS_API_URL", SETTING_KEYS.leadsApiUrl);
  const webhookKey = pick("ANGI_WEBHOOK_KEY", SETTING_KEYS.webhookKey);
  const emailValue = email.value || DEFAULT_ANGI_EMAIL;
  return {
    cookie: cookie.value,
    email: emailValue,
    password: password.value,
    leadsApiUrl: leadsApiUrl.value,
    webhookKey: webhookKey.value,
    cookieFrom: cookie.from,
    emailFrom: email.from ?? "default",
    passwordFrom: password.from,
    leadsApiUrlFrom: leadsApiUrl.from,
    webhookKeyFrom: webhookKey.from,
  };
}

export function angiPollingReady(config = getAngiConfig()): boolean {
  return Boolean(config.cookie || (config.email && config.password) || config.leadsApiUrl);
}

function writeOptional(settingKey: string, value: string | null | undefined): void {
  if (value === undefined) return;
  if (value === null || value.trim() === "") {
    deleteSetting(settingKey);
    return;
  }
  setSetting(settingKey, value.trim());
}

export function saveAngiSettings(input: {
  sessionCookie?: string | null;
  email?: string | null;
  password?: string | null;
  leadsApiUrl?: string | null;
  webhookKey?: string | null;
}): void {
  writeOptional(SETTING_KEYS.cookie, input.sessionCookie);
  writeOptional(SETTING_KEYS.email, input.email);
  writeOptional(SETTING_KEYS.password, input.password);
  writeOptional(SETTING_KEYS.leadsApiUrl, input.leadsApiUrl);
  writeOptional(SETTING_KEYS.webhookKey, input.webhookKey);
}

export function clearAngiSettings(): void {
  for (const key of Object.values(SETTING_KEYS)) {
    deleteSetting(key);
  }
}

export function publicAngiStatusExtras() {
  const config = getAngiConfig();
  const waitingForPassword = Boolean(config.email) && !config.password && !config.cookie;
  return {
    connected: angiPollingReady(config) || Boolean(config.webhookKey),
    hasCookie: Boolean(config.cookie),
    hasEmail: Boolean(config.email),
    hasPassword: Boolean(config.password),
    waitingForPassword,
    angiEmail: config.email,
    hasCustomLeadsUrl: Boolean(config.leadsApiUrl),
    webhookEnabled: Boolean(config.webhookKey),
    envLocked: {
      cookie: config.cookieFrom === "env",
      email: config.emailFrom === "env",
      password: config.passwordFrom === "env",
      leadsApiUrl: config.leadsApiUrlFrom === "env",
      webhookKey: config.webhookKeyFrom === "env",
    },
  };
}
