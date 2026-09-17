import { seedUsers } from "./auth.ts";
import { mailboxForUser, sendIntakeEmail } from "./gmail.ts";
import {
  composeProjectAddress,
  customerFirstName,
  fillIntakeMessage,
  fillPlaceholders,
  INTAKE_TEMPLATES,
  intakeVarsForLead,
} from "./intakeTemplates.ts";
import { addLeadEvent, claimLead, getLead, insertNormalizedLead, markSold, toPublicLead } from "./leads.ts";
import type { LeadPublic } from "./types.ts";

function assert(condition: unknown, message: string): void {
  if (!condition) {
    console.error(`FAIL: ${message}`);
    process.exit(1);
  }
}

const template = INTAKE_TEMPLATES.new_build;
const vars = intakeVarsForLead(
  {
    customerName: "Dana Holloway",
    addressLine1: "1109 E 11th St",
    city: "Austin",
    state: "TX",
    zip: "78702",
  },
  {
    displayName: "Jared",
    phone: "435-990-3556",
    from: "jared@apexdraftingservices.com",
  }
);

assert(customerFirstName("Dana Holloway") === "Dana", "first token of customerName");
assert(vars.customerFirstName === "Dana", "intake vars first name");
assert(vars.projectAddress === "1109 E 11th St Austin, TX 78702", "composed project address");
assert(
  composeProjectAddress({ fullAddress: "  9 Main St, Moab, UT  " }) === "9 Main St, Moab, UT",
  "fullAddress wins when present"
);

const filled = fillIntakeMessage(template, vars);
assert(
  filled.subject === "Next steps for your new build drawings — 1109 E 11th St Austin, TX 78702",
  `subject uses first option + address, got: ${filled.subject}`
);
assert(filled.body.startsWith("Hi Dana,"), "body opens with first name");
assert(filled.body.includes("Best regards,\nJared\nApex Drafting\n435-990-3556\njared@apexdraftingservices.com"), "sign-off placeholders filled");
assert(!filled.body.includes("[Customer First Name]"), "no leftover first-name placeholder");
assert(!filled.body.includes("[Sales Rep Name]"), "no leftover sales-rep placeholder");
assert(!filled.body.includes("[Project Address]"), "no leftover address placeholder");
assert(filled.body.includes("Site & survey (critical for new builds)"), "new build keeps all 5 sections");
assert(INTAKE_TEMPLATES.remodel.body.includes("What we’re remodeling (scope)"), "remodel body is complete");
assert(INTAKE_TEMPLATES.retroactive.body.includes("Existing evidence (please send everything you have)"), "retroactive evidence section present");
assert(INTAKE_TEMPLATES.addition.body.includes("Will the addition share a roof"), "addition covers shared roof");
assert(
  fillPlaceholders("Hi [Customer Name] at [Project Address]", vars) ===
    "Hi Dana Holloway at 1109 E 11th St Austin, TX 78702",
  "full name + address placeholders"
);

delete process.env.GMAIL_JARED_APP_PASSWORD;
delete process.env.GMAIL_REUBEN_APP_PASSWORD;

seedUsers();

const { lead } = insertNormalizedLead({
  externalId: `sold-email-test-${Date.now()}`,
  customerName: "Dana Holloway",
  phone: "555-0100",
  email: "dana.holloway@example.com",
  addressLine1: "1109 E 11th St",
  city: "Austin",
  state: "TX",
  zip: "78702",
  service: "Permit set",
  source: "test",
  createdAt: new Date().toISOString(),
});

const claimed = claimLead(lead.id, "user_jared");
assert(claimed.ok, "claim should succeed before sold");

const sold = markSold(lead.id, "user_jared", "Closed on call");
assert(!("error" in sold), "markSold should succeed without Gmail password");
assert((sold as LeadPublic).stage === "sold", "lead is sold even when email cannot send");

const email = await sendIntakeEmail({
  lead: sold as LeadPublic,
  user: { id: "user_jared", displayName: "Jared" },
  templateId: "new_build",
});
assert(email.status === "skipped", `expected skipped without app password, got ${email.status}: ${email.detail}`);
assert(email.detail.includes("GMAIL_JARED_APP_PASSWORD"), `skip detail should name missing env, got: ${email.detail}`);
addLeadEvent(lead.id, "email_skipped", "user_jared", email.detail);
const afterSkip = toPublicLead(getLead(lead.id)!, "user_jared");
assert(afterSkip.stage === "sold", "sold stage stays sold after skipped email");
assert(
  afterSkip.events.some((event) => event.type === "sold") && afterSkip.events.some((event) => event.type === "email_skipped"),
  "sold + email_skipped events are both recorded"
);

const { lead: noEmailLead } = insertNormalizedLead({
  externalId: `sold-no-email-${Date.now()}`,
  customerName: "No Email Neighbor",
  phone: "555-0199",
  email: null,
  city: "Moab",
  state: "UT",
  service: "Remodel",
  source: "test",
  createdAt: new Date().toISOString(),
});
assert(claimLead(noEmailLead.id, "user_reuben").ok, "claim lead with no email");
const soldNoEmail = markSold(noEmailLead.id, "user_reuben");
assert(!("error" in soldNoEmail) && (soldNoEmail as LeadPublic).stage === "sold", "skip-email path can still mark sold");

const missingEmailLead: LeadPublic = { ...(sold as LeadPublic), email: null };
const skippedNoTo = await sendIntakeEmail({
  lead: missingEmailLead,
  user: { id: "user_jared", displayName: "Jared" },
  templateId: "remodel",
});
assert(skippedNoTo.status === "skipped", "missing customer email skips send");

process.env.GMAIL_JARED_APP_PASSWORD = "not-a-real-password";
const captured: { subject: string; text: string; from: string; to: string }[] = [];
const sent = await sendIntakeEmail({
  lead: sold as LeadPublic,
  user: { id: "user_jared", displayName: "Jared" },
  templateId: "addition",
  send: async (opts) => {
    captured.push({ subject: opts.subject, text: opts.text, from: opts.from, to: opts.to });
  },
});
assert(sent.status === "sent", `mocked send should succeed, got ${sent.status}: ${sent.detail}`);
assert(captured[0]?.to === "dana.holloway@example.com", "sends to lead email");
assert(captured[0]?.from === "jared@apexdraftingservices.com", "from is Jared's Apex mailbox");
assert(captured[0]?.subject.includes("addition drawings"), "addition subject used");
assert(captured[0]?.text.includes("Hi Dana,"), "addition body filled");
assert(captured[0]?.text.includes("share a roof"), "addition body includes attachment/roof questions");

const failed = await sendIntakeEmail({
  lead: sold as LeadPublic,
  user: { id: "user_jared", displayName: "Jared" },
  templateId: "retroactive",
  send: async () => {
    throw new Error("SMTP 535");
  },
});
assert(failed.status === "failed", "send errors become email failed, not thrown");
assert(failed.detail.includes("SMTP 535"), "failure detail includes transport error");

const reubenBox = mailboxForUser({ id: "user_reuben", displayName: "Reuben" });
assert(reubenBox?.from === "reuben@apexdraftingservices.com", "Reuben from-address stays mapped for later");
assert(reubenBox?.sendEnabled === false, "Reuben send is stubbed");
assert(reubenBox?.appPassword === undefined, "Reuben mailbox never reads an app password");

process.env.GMAIL_REUBEN_APP_PASSWORD = "should-not-be-used";
let reubenSendCalled = false;
const { lead: reubenLead } = insertNormalizedLead({
  externalId: `sold-reuben-stub-${Date.now()}`,
  customerName: "Riley Homeowner",
  email: "riley@example.com",
  city: "Austin",
  state: "TX",
  service: "Addition",
  source: "test",
  createdAt: new Date().toISOString(),
});
assert(claimLead(reubenLead.id, "user_reuben").ok, "Reuben can claim");
const reubenSold = markSold(reubenLead.id, "user_reuben");
assert(!("error" in reubenSold) && (reubenSold as LeadPublic).stage === "sold", "Reuben sold succeeds");
const reubenEmail = await sendIntakeEmail({
  lead: reubenSold as LeadPublic,
  user: { id: "user_reuben", displayName: "Reuben" },
  templateId: "new_build",
  send: async () => {
    reubenSendCalled = true;
    throw new Error("Reuben SMTP should not run");
  },
});
assert(reubenEmail.status === "skipped", `Reuben template choice should skip, got ${reubenEmail.status}`);
assert(
  reubenEmail.detail === "Reuben Gmail not configured yet",
  `expected stub skip detail, got: ${reubenEmail.detail}`
);
assert(!reubenSendCalled, "Reuben path must not call the mail transport");
assert((reubenSold as LeadPublic).stage === "sold", "Reuben lead stays sold after stub skip");

console.log("OK: intake template fill + sold without Gmail password still succeeds");
