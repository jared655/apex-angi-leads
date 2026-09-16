export type LeadStage = "unclaimed" | "claimed" | "sold" | "lost";

export type UserRow = {
  id: string;
  email: string;
  password_hash: string;
  display_name: string;
  expo_push_token: string | null;
  created_at: string;
};

export type LeadRow = {
  id: string;
  external_id: string;
  angi_url: string | null;
  customer_name: string;
  phone: string | null;
  email: string | null;
  address_line1: string | null;
  city: string | null;
  state: string | null;
  zip: string | null;
  service: string | null;
  description: string | null;
  interview_json: string | null;
  source: string;
  stage: LeadStage;
  claimed_by: string | null;
  claimed_at: string | null;
  needs_follow_up: number;
  follow_up_at: string | null;
  sold_at: string | null;
  lost_at: string | null;
  created_at: string;
  imported_at: string;
  updated_at: string;
};

export type EventRow = {
  id: string;
  lead_id: string;
  user_id: string | null;
  type: string;
  note: string | null;
  created_at: string;
};

export type InterviewItem = { question: string; answer: string };

export type NormalizedLead = {
  externalId: string;
  angiUrl?: string | null;
  customerName: string;
  phone?: string | null;
  email?: string | null;
  addressLine1?: string | null;
  city?: string | null;
  state?: string | null;
  zip?: string | null;
  service?: string | null;
  description?: string | null;
  interview?: InterviewItem[] | null;
  source?: string;
  createdAt?: string | null;
};

export type PublicUser = {
  id: string;
  email: string;
  displayName: string;
};

export type LeadEventPublic = {
  id: string;
  type: string;
  note: string | null;
  userId: string | null;
  userName: string | null;
  createdAt: string;
};

export type LeadPublic = {
  id: string;
  externalId: string;
  angiUrl: string | null;
  customerName: string;
  phone: string | null;
  email: string | null;
  addressLine1: string | null;
  city: string | null;
  state: string | null;
  zip: string | null;
  fullAddress: string | null;
  service: string | null;
  description: string | null;
  interview: InterviewItem[] | null;
  source: string;
  stage: LeadStage;
  claimedBy: string | null;
  claimedByName: string | null;
  claimedAt: string | null;
  needsFollowUp: boolean;
  followUpAt: string | null;
  soldAt: string | null;
  lostAt: string | null;
  createdAt: string;
  importedAt: string;
  updatedAt: string;
  events: LeadEventPublic[];
};

export type AppEvent =
  | { type: "lead.created"; leadId: string }
  | { type: "lead.updated"; leadId: string }
  | { type: "lead.claimed"; leadId: string; userId: string }
  | { type: "sync.completed"; inserted: number; skipped: number };
