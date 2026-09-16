const OFFICE = "https://office.angi.com";

export const ANGI_OFFICE_ORIGIN = OFFICE;

export const BROWSER_UA =
  "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/128.0.0.0 Safari/537.36";

const CALLER_ID_PATH = /\/(?:angiLeads|app\/h)\/([^/?#]+)/i;

export function angiCallerType(): string {
  return process.env.ANGI_CALLER_TYPE?.trim() || "ServiceProvider";
}

export function parseAngiCallerIdFromPath(url: string): string {
  if (!url) return "";
  try {
    const path = /^https?:\/\//i.test(url) ? new URL(url).pathname : url;
    return path.match(CALLER_ID_PATH)?.[1] || "";
  } catch {
    return url.match(CALLER_ID_PATH)?.[1] || "";
  }
}

/** Env `ANGI_CALLER_ID` wins; otherwise parse `/angiLeads/<id>/` or `/app/h/<id>/` from the URL. */
export function parseAngiCallerId(url = ""): string {
  return process.env.ANGI_CALLER_ID?.trim() || parseAngiCallerIdFromPath(url);
}

export function resolveAngiCallerId(urls: string[] = []): string {
  const fromEnv = process.env.ANGI_CALLER_ID?.trim();
  if (fromEnv) return fromEnv;
  for (const url of urls) {
    const id = parseAngiCallerIdFromPath(url);
    if (id) return id;
  }
  return "";
}

export function angiLeadBoardReferer(callerId: string): string {
  if (callerId) return `${OFFICE}/app/h/${callerId}/leads/lead-board`;
  return `${OFFICE}/`;
}

export function angiRequestHeaders(
  cookie: string,
  opts?: { url?: string; callerId?: string }
): Record<string, string> {
  const callerId = opts?.callerId || parseAngiCallerId(opts?.url || "");
  const headers: Record<string, string> = {
    cookie,
    accept: "application/json, text/html;q=0.9, */*;q=0.8",
    "accept-language": "en-US,en;q=0.9",
    "user-agent": BROWSER_UA,
    origin: OFFICE,
    referer: angiLeadBoardReferer(callerId),
    "X-ANGI-CallerType": angiCallerType(),
  };
  if (callerId) {
    headers["X-ANGI-CallerId"] = callerId;
  }
  return headers;
}
