import {
  angiCallerType,
  angiLeadBoardReferer,
  angiRequestHeaders,
  parseAngiCallerId,
  parseAngiCallerIdFromPath,
  resolveAngiCallerId,
} from "./angiHeaders.ts";

function assert(condition: unknown, message: string): void {
  if (!condition) {
    console.error(`FAIL: ${message}`);
    process.exit(1);
  }
}

function withEnv(key: string, value: string | undefined, fn: () => void): void {
  const prev = process.env[key];
  if (value === undefined) delete process.env[key];
  else process.env[key] = value;
  try {
    fn();
  } finally {
    if (prev === undefined) delete process.env[key];
    else process.env[key] = prev;
  }
}

withEnv("ANGI_CALLER_ID", undefined, () => {
  withEnv("ANGI_CALLER_TYPE", undefined, () => {
    assert(angiCallerType() === "ServiceProvider", "default caller type is ServiceProvider");
    assert(
      parseAngiCallerIdFromPath("https://gateway.angi.com/angiLeads/sp-12345/lead-summaries") === "sp-12345",
      "parse /angiLeads/<id>/"
    );
    assert(
      parseAngiCallerIdFromPath("https://office.angi.com/app/h/sp-999/leads/lead-board") === "sp-999",
      "parse /app/h/<id>/"
    );
    assert(parseAngiCallerIdFromPath("https://office.angi.com/leads") === "", "no id on generic leads URL");
    assert(parseAngiCallerId("https://office.angi.com/app/h/abc/leads/") === "abc", "parseAngiCallerId uses path");
    assert(
      resolveAngiCallerId(["https://office.angi.com/api/leads", "https://office.angi.com/app/h/from-list/x"]) ===
        "from-list",
      "resolveAngiCallerId scans URLs"
    );

    const headers = angiRequestHeaders("sid=1", {
      url: "https://office.angi.com/angiLeads/entity-77/lead-summaries",
    });
    assert(headers["X-ANGI-CallerType"] === "ServiceProvider", "sends default X-ANGI-CallerType");
    assert(headers["X-ANGI-CallerId"] === "entity-77", "sends X-ANGI-CallerId from URL");
    assert(
      headers.referer === "https://office.angi.com/app/h/entity-77/leads/lead-board",
      "referer is lead-board when id known"
    );
  });
});

withEnv("ANGI_CALLER_ID", "env-id-1", () => {
  withEnv("ANGI_CALLER_TYPE", "Partner", () => {
    assert(angiCallerType() === "Partner", "ANGI_CALLER_TYPE overrides default");
    assert(parseAngiCallerId("https://office.angi.com/app/h/path-id/leads/") === "env-id-1", "env caller id wins");
    assert(resolveAngiCallerId(["https://office.angi.com/app/h/other/leads/"]) === "env-id-1", "env wins over URLs");
    const headers = angiRequestHeaders("sid=1", { url: "https://office.angi.com/" });
    assert(headers["X-ANGI-CallerId"] === "env-id-1", "env id on generic URL");
    assert(headers["X-ANGI-CallerType"] === "Partner", "custom caller type header");
    assert(headers.referer === angiLeadBoardReferer("env-id-1"), "referer uses env id");
  });
});

withEnv("ANGI_CALLER_ID", undefined, () => {
  const headers = angiRequestHeaders("sid=1", { url: "https://office.angi.com/leads" });
  assert(!("X-ANGI-CallerId" in headers), "omit X-ANGI-CallerId when unknown");
  assert(headers.referer === "https://office.angi.com/", "generic referer when id unknown");
  assert(headers["X-ANGI-CallerType"] === "ServiceProvider", "still send caller type");
});

console.log("OK: Angi gateway headers (caller type/id + lead-board referer)");
