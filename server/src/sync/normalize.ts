import type { InterviewItem, NormalizedLead } from "./types.ts";

function asString(value: unknown): string | null {
  if (value === null || value === undefined) return null;
  const text = String(value).trim();
  return text.length ? text : null;
}

function pick(record: Record<string, unknown>, keys: string[]): string | null {
  const lookup = new Map<string, unknown>();
  for (const [key, value] of Object.entries(record)) {
    lookup.set(key.toLowerCase().replace(/[^a-z0-9]/g, ""), value);
  }
  for (const key of keys) {
    const found = lookup.get(key.toLowerCase().replace(/[^a-z0-9]/g, ""));
    const text = asString(found);
    if (text) return text;
  }
  return null;
}

function fullName(record: Record<string, unknown>): string | null {
  const combined = pick(record, [
    "customerName",
    "customer_name",
    "name",
    "fullName",
    "contactName",
    "homeownerName",
  ]);
  if (combined) return combined;
  const first = pick(record, ["firstName", "first_name", "firstname"]);
  const last = pick(record, ["lastName", "last_name", "lastname"]);
  const joined = [first, last].filter(Boolean).join(" ").trim();
  return joined || null;
}

function interviewFrom(record: Record<string, unknown>): InterviewItem[] | null {
  const raw = record.interview ?? record.questions ?? record.leadInterview;
  if (!Array.isArray(raw)) return null;
  const items = raw
    .map((item) => {
      if (!item || typeof item !== "object") return null;
      const row = item as Record<string, unknown>;
      const question = asString(row.question ?? row.prompt ?? row.q);
      const answer = asString(row.answer ?? row.response ?? row.a);
      if (!question && !answer) return null;
      return { question: question || "Question", answer: answer || "" };
    })
    .filter((item): item is InterviewItem => Boolean(item));
  return items.length ? items : null;
}

export function normalizeLead(input: unknown, fallbackSource = "angi"): NormalizedLead | null {
  if (!input || typeof input !== "object") return null;
  const record = input as Record<string, unknown>;

  const nested =
    record.lead && typeof record.lead === "object"
      ? (record.lead as Record<string, unknown>)
      : record;

  const externalId = pick(nested, [
    "externalId",
    "external_id",
    "leadId",
    "lead_id",
    "leadOid",
    "srOid",
    "id",
    "angiLeadId",
    "oid",
  ]);
  const customerName = fullName(nested);
  if (!externalId || !customerName) return null;

  const interview = interviewFrom(nested);
  const descriptionParts = [
    pick(nested, ["description", "comments", "leadDescription", "message", "details", "jobDetails", "notes"]),
  ];
  if (interview?.length) {
    descriptionParts.push(
      interview.map((item) => `${item.question}: ${item.answer}`).join("\n")
    );
  }

  return {
    externalId,
    angiUrl:
      pick(nested, ["angiUrl", "angi_url", "url", "leadUrl", "link"]) ||
      `https://office.angi.com/leads/${encodeURIComponent(externalId)}`,
    customerName,
    phone: pick(nested, ["phone", "primaryPhone", "phoneNumber", "mobile", "contactPhone"]),
    email: pick(nested, ["email", "emailAddress", "contactEmail"]),
    addressLine1: pick(nested, ["addressLine1", "address", "street", "streetAddress", "address1"]),
    city: pick(nested, ["city"]),
    state: pick(nested, ["state", "stateProvince", "region"]),
    zip: pick(nested, ["zip", "postalCode", "zipCode", "zipcode"]),
    service: pick(nested, ["service", "taskName", "category", "jobType", "task", "project"]),
    description: descriptionParts.filter(Boolean).join("\n\n") || null,
    interview,
    source: pick(nested, ["source"]) || fallbackSource,
    createdAt: pick(nested, ["createdAt", "createDate", "leadDate", "submittedAt", "date"]),
  };
}

export function normalizeMany(input: unknown, fallbackSource = "angi"): NormalizedLead[] {
  if (Array.isArray(input)) {
    return input.map((item) => normalizeLead(item, fallbackSource)).filter((item): item is NormalizedLead => Boolean(item));
  }
  if (input && typeof input === "object") {
    const record = input as Record<string, unknown>;
    if (Array.isArray(record.leads)) return normalizeMany(record.leads, fallbackSource);
    const single = normalizeLead(input, fallbackSource);
    return single ? [single] : [];
  }
  return [];
}

const CSV_ALIASES: Record<keyof Pick<NormalizedLead, "externalId" | "customerName" | "phone" | "email" | "addressLine1" | "city" | "state" | "zip" | "service" | "description" | "createdAt" | "angiUrl">, string[]> = {
  externalId: ["lead id", "leadid", "id", "sr oid", "lead oid"],
  customerName: ["name", "customer name", "contact name", "full name"],
  phone: ["phone", "phone number", "primary phone"],
  email: ["email", "email address"],
  addressLine1: ["address", "street", "address 1"],
  city: ["city"],
  state: ["state"],
  zip: ["zip", "zip code", "postal code"],
  service: ["task", "task name", "service", "category", "job"],
  description: ["comments", "description", "details", "message"],
  createdAt: ["lead date", "date", "created", "create date"],
  angiUrl: ["url", "lead url", "link"],
};

export function rowsFromCsv(records: Record<string, string>[]): NormalizedLead[] {
  return records
    .map((row) => {
      const lowered: Record<string, string> = {};
      for (const [key, value] of Object.entries(row)) {
        lowered[key.trim().toLowerCase()] = value;
      }
      const mapped: Record<string, string> = {};
      for (const [field, aliases] of Object.entries(CSV_ALIASES)) {
        for (const alias of aliases) {
          if (lowered[alias]?.trim()) {
            mapped[field] = lowered[alias].trim();
            break;
          }
        }
      }
      if (!mapped.customerName && (lowered["first name"] || lowered["last name"])) {
        mapped.customerName = [lowered["first name"], lowered["last name"]].filter(Boolean).join(" ");
      }
      return normalizeLead(mapped, "angi-csv");
    })
    .filter((item): item is NormalizedLead => Boolean(item));
}
