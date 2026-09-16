import { flattenAngiLeadRecord, normalizeLead, normalizeMany } from "./normalize.ts";

function assert(condition: unknown, message: string): void {
  if (!condition) {
    console.error(`FAIL: ${message}`);
    process.exit(1);
  }
}

const nestedSummary = {
  consumerDetails: {
    consumerFirstName: "Sofia",
    consumerLastName: "Ramirez",
    formattedConsumerPhone: "(512) 555-0188",
    email: "sofia.ramirez@example.com",
    addressLine1: "7601 S Congress Ave",
    city: "Austin",
    state: "TX",
    zip: "78745",
  },
  leadDetails: {
    leadId: "ANGI-100184",
    taskName: "New home architectural drawings",
    taskDescription: "Looking for a designer to produce a full permit set.",
  },
  leadStatusDetails: {
    creationDatetime: "2026-09-16T15:04:00Z",
  },
};

const flat = flattenAngiLeadRecord(nestedSummary);
assert(flat.leadId === "ANGI-100184", "flatten hoists leadId from leadDetails");
assert(flat.consumerFirstName === "Sofia", "flatten hoists consumerFirstName");
assert(flat.formattedConsumerPhone === "(512) 555-0188", "flatten hoists formattedConsumerPhone");
assert(flat.taskDescription?.toString().includes("permit set"), "flatten hoists taskDescription");
assert(flat.creationDatetime === "2026-09-16T15:04:00Z", "flatten hoists creationDatetime");
assert(flat.addressLine1 === "7601 S Congress Ave", "flatten hoists address fields");

const lead = normalizeLead(nestedSummary, "angi-poll");
assert(lead, "nested lead-summaries payload normalizes");
assert(lead?.externalId === "ANGI-100184", "leadId becomes externalId");
assert(lead?.customerName === "Sofia Ramirez", "consumer first+last become customerName");
assert(lead?.phone === "(512) 555-0188", "formattedConsumerPhone becomes phone");
assert(lead?.description === "Looking for a designer to produce a full permit set.", "taskDescription becomes description");
assert(lead?.addressLine1 === "7601 S Congress Ave", "addressLine1 from consumerDetails");
assert(lead?.city === "Austin" && lead?.state === "TX" && lead?.zip === "78745", "city/state/zip from consumerDetails");
assert(lead?.service === "New home architectural drawings", "taskName becomes service");
assert(lead?.createdAt === "2026-09-16T15:04:00Z", "creationDatetime becomes createdAt");
assert(lead?.email === "sofia.ramirez@example.com", "email from consumerDetails");

const wrapped = normalizeMany({ leadSummaries: [nestedSummary] }, "angi-poll");
assert(wrapped.length === 1 && wrapped[0]?.externalId === "ANGI-100184", "normalizeMany reads leadSummaries[]");

const alreadyFlat = normalizeLead(
  {
    leadId: "ANGI-100184",
    firstName: "Sofia",
    lastName: "Ramirez",
    primaryPhone: "5125550188",
    city: "Austin",
  },
  "angi"
);
assert(alreadyFlat?.customerName === "Sofia Ramirez", "flat payloads still normalize");

assert(normalizeLead(["not", "a", "lead"]) === null, "arrays are not treated as leads");

console.log("OK: Angi nested lead-summaries flatten + normalize");
