export type LeadStage = "unclaimed" | "claimed" | "sold" | "lost";

export type InterviewItem = { question: string; answer: string };

export type LeadEvent = {
  id: string;
  type: string;
  note: string | null;
  userId: string | null;
  userName: string | null;
  createdAt: string;
};

export type Lead = {
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
  events: LeadEvent[];
};

export type User = {
  id: string;
  email: string;
  displayName: string;
};

export type SyncStatus = {
  pollingEnabled: boolean;
  lastSyncAt: string | null;
  lastSyncMode: string | null;
  lastSyncInserted: string | null;
  lastError: string | null;
  lastErrorDetail: string | null;
  pollIntervalMs: number;
  webhookPath: string;
  connected: boolean;
  hasCookie: boolean;
  hasEmail: boolean;
  hasPassword: boolean;
  waitingForPassword: boolean;
  angiEmail: string;
  hasCustomLeadsUrl: boolean;
  webhookEnabled: boolean;
  envLocked: {
    cookie: boolean;
    email: boolean;
    password: boolean;
    leadsApiUrl: boolean;
    webhookKey: boolean;
  };
};
