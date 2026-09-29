import { boolean, doublePrecision, integer, jsonb, pgEnum, pgTable, text, timestamp, uniqueIndex, uuid } from "drizzle-orm/pg-core";

/**
 * Multi-tenancy rule: every business table carries orgId and every query
 * in the repository layer filters by it. No table without an org except
 * users (who join orgs through memberships).
 */

export const roleEnum = pgEnum("role", ["admin", "reviewer"]);
export const bucketEnum = pgEnum("bucket", ["SHORTLIST", "REVIEW_QUEUE", "AUTO_FILTERED", "REJECTED"]);
export const labelEnum = pgEnum("label", ["venture_scalable", "sme_lifestyle", "out_of_mandate", "needs_review"]);

export const orgs = pgTable("orgs", {
  id: uuid("id").primaryKey().defaultRandom(),
  name: text("name").notNull(),
  // Provisioned manually in v1 — no self-serve signup path writes here.
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
});

export const users = pgTable("users", {
  id: uuid("id").primaryKey().defaultRandom(),
  email: text("email").notNull().unique(),
  name: text("name").notNull().default(""),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
});

export const memberships = pgTable(
  "memberships",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    orgId: uuid("org_id").notNull().references(() => orgs.id),
    userId: uuid("user_id").notNull().references(() => users.id),
    role: roleEnum("role").notNull(),
  },
  (t) => [uniqueIndex("memberships_org_user").on(t.orgId, t.userId)],
);

export const cycles = pgTable("cycles", {
  id: uuid("id").primaryKey().defaultRandom(),
  orgId: uuid("org_id").notNull().references(() => orgs.id),
  name: text("name").notNull(),
  mandateConfig: jsonb("mandate_config").notNull(), // MandateConfig shape
  threshold: doublePrecision("threshold").notNull().default(0.85),
  modelId: text("model_id").notNull(), // bake-off winner, set per org/cycle
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
});

export const ingestBatches = pgTable("ingest_batches", {
  id: uuid("id").primaryKey().defaultRandom(),
  orgId: uuid("org_id").notNull().references(() => orgs.id),
  cycleId: uuid("cycle_id").notNull().references(() => cycles.id),
  uploadedBy: uuid("uploaded_by").notNull().references(() => users.id),
  csvSha256: text("csv_sha256").notNull(),
  rowCount: integer("row_count").notNull(),
  errorCount: integer("error_count").notNull(),
  rowErrors: jsonb("row_errors").notNull(), // RowError[]
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
});

export const applications = pgTable("applications", {
  id: uuid("id").primaryKey().defaultRandom(),
  orgId: uuid("org_id").notNull().references(() => orgs.id),
  cycleId: uuid("cycle_id").notNull().references(() => cycles.id),
  batchId: uuid("batch_id").notNull().references(() => ingestBatches.id),
  sourceRow: integer("source_row").notNull(),
  email: text("email").notNull(),
  startupName: text("startup_name").notNull(),
  founder: text("founder").notNull(),
  country: text("country").notNull(),
  sector: text("sector").notNull(),
  stage: text("stage").notNull(),
  description: text("description").notNull(),
  revenueAmount: doublePrecision("revenue_amount"),
  revenueCurrency: text("revenue_currency"),
  revenueRaw: text("revenue_raw").notNull().default(""),
  recurring: text("recurring").notNull(),
  teamSize: integer("team_size"),
  externalFunding: text("external_funding").notNull().default(""),
  scalability: text("scalability").notNull().default(""),
  deckFile: text("deck_file"),
  deckSha256: text("deck_sha256"),
  priorDecision: text("prior_decision"), // ground-truth label when present
  label: labelEnum("label"),
  confidence: doublePrecision("confidence"),
  rationale: text("rationale"),
  evidence: jsonb("evidence"), // EvidenceLink[]
  bucket: bucketEnum("bucket"),
  reviewNote: text("review_note"),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
});

export const auditEvents = pgTable("audit_events", {
  id: uuid("id").primaryKey().defaultRandom(),
  orgId: uuid("org_id").notNull().references(() => orgs.id),
  applicationId: uuid("application_id").notNull().references(() => applications.id),
  actorId: uuid("actor_id").notNull().references(() => users.id),
  action: text("action").notNull(),
  note: text("note"),
  overrideFrom: labelEnum("override_from"),
  overrideTo: labelEnum("override_to"),
  isTrainingSignal: boolean("is_training_signal").notNull().default(false),
  at: timestamp("at", { withTimezone: true }).notNull().defaultNow(),
});

export const costEvents = pgTable("cost_events", {
  id: uuid("id").primaryKey().defaultRandom(),
  orgId: uuid("org_id").notNull().references(() => orgs.id),
  cycleId: uuid("cycle_id").notNull().references(() => cycles.id),
  applicationId: uuid("application_id").references(() => applications.id),
  modelId: text("model_id").notNull(),
  inputTokens: integer("input_tokens").notNull(),
  outputTokens: integer("output_tokens").notNull(),
  costUsd: doublePrecision("cost_usd").notNull(),
  at: timestamp("at", { withTimezone: true }).notNull().defaultNow(),
});
