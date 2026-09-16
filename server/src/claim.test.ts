import { seedUsers } from "./auth.ts";
import { claimLead, insertNormalizedLead, listUnclaimed } from "./leads.ts";

seedUsers();

const { lead } = insertNormalizedLead({
  externalId: `claim-test-${Date.now()}`,
  customerName: "Claim Race Homeowner",
  phone: "555-0100",
  email: "race@example.com",
  city: "Austin",
  state: "TX",
  service: "Permit set",
  source: "test",
  createdAt: new Date().toISOString(),
});

const first = claimLead(lead.id, "user_jared");
const second = claimLead(lead.id, "user_reuben");

if (!first.ok) {
  console.error("FAIL: first claim should succeed");
  process.exit(1);
}
if (second.ok) {
  console.error("FAIL: second claim should be rejected");
  process.exit(1);
}
if (second.reason !== "already_claimed") {
  console.error("FAIL: expected already_claimed", second);
  process.exit(1);
}

const inbox = listUnclaimed().some((item) => item.id === lead.id);
if (inbox) {
  console.error("FAIL: claimed lead still in unclaimed inbox");
  process.exit(1);
}

console.log("OK: atomic claim — Jared won, Reuben received already_claimed");
