/**
 * End-to-end demo against a live database — same core code paths the API
 * routes use, minus the HTTP/auth layer. Provider is the deterministic
 * mock with scripted per-startup replies, so the run is reproducible and
 * free. Swap `provider` for a real one (see providerRegistry) to demo
 * against a live model.
 *
 * Usage: DATABASE_URL=postgres://… npx vite-node --config vitest.config.ts scripts/demo-e2e.ts
 */
import { readFileSync } from "node:fs";
import { db } from "@/db/client";
import { applications, auditEvents, costEvents, cycles, ingestBatches, memberships, orgs, users } from "@/db/schema";
import { parseIntakeCsv } from "@/core/ingest/parseIntakeCsv";
import { buildIngestManifest } from "@/core/ingest/hash";
import { compileRubric, type MandateConfig } from "@/core/mandate/rubric";
import { classifyApplication } from "@/core/classify/pipeline";
import { mockProvider } from "@/core/classify/providers/mock";
import { applyReviewAction } from "@/core/review/transitions";
import { buildShortlistCsv } from "@/core/export/shortlistCsv";
import type { EvidenceLink } from "@/core/classify/types";
import { and, eq, isNull, sql } from "drizzle-orm";

const reply = (label: string, confidence: number, rationale: string, evidence: EvidenceLink[] = [], failed: string[] = []) =>
  JSON.stringify({ label, confidence, rationale, evidence, criteriaFailed: failed });

// Scripted verdicts keyed by startup name (matched against the prompt text).
const SCRIPT = new Map<string, string>([
  ["PayLink", reply("venture_scalable", 0.93, "Merchant payment API with recurring take-rate; growth decoupled from headcount.", [{ source: "csv:Describe what your company does", excerpt: "API for merchant payments" }])],
  ["ColdHaul", reply("venture_scalable", 0.9, "Asset-light cold-chain logistics marketplace; network effects with fleet partners.")],
  ["MediVault", reply("venture_scalable", 0.88, "Health records SaaS with per-clinic subscription; software margins.")],
  ["FarmLink Ghana", reply("venture_scalable", 0.72, "Agritech marketplace, but revenue model unclear from the form alone.")],
  ["Okafor Bakery", reply("sme_lifestyle", 0.95, "Two-location bakery; growth is linear with shops and staff.", [{ source: "csv:What makes your business scalable?", excerpt: "opening more branches" }], ["venture_scalability"])],
  ["Bella Stitches", reply("sme_lifestyle", 0.92, "Custom tailoring service; capacity bound to the founder's hours.", [], ["venture_scalability"])],
  ["Grace Event Planning", reply("sme_lifestyle", 0.9, "Event services firm; project-based, headcount-linear revenue.", [], ["venture_scalability"])],
  ["Sunrise Poultry", reply("sme_lifestyle", 0.91, "Poultry farm; physical-capacity bound.", [], ["venture_scalability"])],
  ["QuantumYield", reply("out_of_mandate", 0.94, "Registered and operating outside the program's geography focus.", [{ source: "csv:Country of operation", excerpt: "United Arab Emirates" }], ["geography"])],
  ["Nairobi Design Studio", reply("needs_review", 0.55, "Agency today, but claims a productized SaaS in beta — genuinely ambiguous.")],
]);

const provider = mockProvider({
  replies: SCRIPT,
  defaultReply: reply("needs_review", 0.5, "no scripted verdict"),
  usage: { inputTokens: 1400, outputTokens: 180 },
});
const flatPrice = () => 0.0009; // stand-in per-call price for the mock

const d = db();
console.log("── seed ──");
const [org] = await d.insert(orgs).values({ name: "Catapult (demo)" }).returning();
const [admin] = await d.insert(users).values({ email: "shiv@catapult.example", name: "Shiv" }).returning();
await d.insert(memberships).values({ orgId: org!.id, userId: admin!.id, role: "admin" });
const mandate: MandateConfig = {
  programName: "Catapult 2027",
  stages: ["idea", "pre_seed", "seed"],
  sectors: ["Fintech", "Healthtech", "Agritech", "Logistics", "Design/Software"],
  geographies: ["Nigeria", "Ghana", "Kenya"],
  additionalCriteria: "Prefer post-revenue teams with recurring models.",
};
const [cycle] = await d
  .insert(cycles)
  .values({ orgId: org!.id, name: "2027 Cohort", mandateConfig: mandate, threshold: 0.85, modelId: "mock:test-model" })
  .returning();
console.log(`   org=${org!.id.slice(0, 8)}… cycle=${cycle!.id.slice(0, 8)}… threshold=${cycle!.threshold}`);

console.log("\n── ingest ──");
const csvBuffer = readFileSync("test/fixtures/mock_catapult_intake_export.csv");
const parsed = parseIntakeCsv(csvBuffer.toString("utf8"));
const manifest = buildIngestManifest({
  csv: csvBuffer,
  decks: new Map(), // no deck files in the demo upload
  referencedDecks: parsed.applications.flatMap((a) => (a.deckFile ? [a.deckFile.split("/").pop()!] : [])),
});
const [batch] = await d
  .insert(ingestBatches)
  .values({
    orgId: org!.id,
    cycleId: cycle!.id,
    uploadedBy: admin!.id,
    csvSha256: manifest.csvSha256,
    rowCount: parsed.applications.length,
    errorCount: parsed.errors.length,
    rowErrors: parsed.errors,
  })
  .returning();
await d.insert(applications).values(
  parsed.applications.map((a) => ({
    orgId: org!.id,
    cycleId: cycle!.id,
    batchId: batch!.id,
    sourceRow: a.row,
    email: a.email,
    startupName: a.startupName,
    founder: a.founder,
    country: a.country,
    sector: a.sector,
    stage: a.stage,
    description: a.description,
    revenueAmount: a.revenue.amount,
    revenueCurrency: a.revenue.currency,
    revenueRaw: a.revenue.raw,
    recurring: a.recurring,
    teamSize: a.teamSize,
    externalFunding: a.externalFunding,
    scalability: a.scalability,
    deckFile: a.deckFile,
    deckSha256: null,
    priorDecision: a.decision,
  })),
);
console.log(`   csv sha256=${manifest.csvSha256.slice(0, 16)}… ingested=${parsed.applications.length} rowErrors=${parsed.errors.length} missingDecks=${manifest.missingDecks.length}`);

console.log("\n── classify ──");
const rubric = compileRubric(mandate);
const pending = await d
  .select()
  .from(applications)
  .where(and(eq(applications.cycleId, cycle!.id), isNull(applications.bucket)));
for (const row of pending) {
  const outcome = await classifyApplication({
    provider,
    rubric,
    app: {
      row: row.sourceRow,
      submittedAt: "",
      email: row.email,
      startupName: row.startupName,
      founder: row.founder,
      country: row.country,
      sector: row.sector,
      stage: row.stage as never,
      description: row.description,
      revenue: { amount: row.revenueAmount, currency: row.revenueCurrency as never, raw: row.revenueRaw },
      recurring: row.recurring as never,
      teamSize: row.teamSize,
      externalFunding: row.externalFunding,
      scalability: row.scalability,
      deckFile: row.deckFile,
      decision: row.priorDecision,
    },
    deckText: null,
    threshold: cycle!.threshold,
    price: flatPrice,
  });
  await d
    .update(applications)
    .set(
      outcome.ok
        ? { label: outcome.result.label, confidence: outcome.result.confidence, rationale: outcome.result.rationale, evidence: outcome.result.evidence, bucket: outcome.bucket }
        : { bucket: "REVIEW_QUEUE", rationale: `classification failed: ${outcome.error}` },
    )
    .where(eq(applications.id, row.id));
  await d.insert(costEvents).values({
    orgId: org!.id,
    cycleId: cycle!.id,
    applicationId: row.id,
    modelId: outcome.modelId,
    inputTokens: 1400,
    outputTokens: 180,
    costUsd: outcome.costUsd,
  });
  const tag = outcome.ok ? `${outcome.result.label} @ ${(outcome.result.confidence * 100).toFixed(0)}%` : "PARSE-FAIL";
  console.log(`   ${row.startupName.padEnd(22)} → ${outcome.bucket.padEnd(13)} (${tag})`);
}

console.log("\n── review queue: human decisions ──");
const actor = { userId: admin!.id, role: "admin" as const };
const queued = await d
  .select()
  .from(applications)
  .where(and(eq(applications.cycleId, cycle!.id), eq(applications.bucket, "REVIEW_QUEUE")));
for (const row of queued) {
  // Reviewer relabels the ambiguous agency, then accepts it; accepts FarmLink outright.
  if (row.startupName === "Nairobi Design Studio") {
    const relabel = applyReviewAction({ bucket: row.bucket!, label: row.label! }, { type: "relabel", actor, newLabel: "venture_scalable", note: "SaaS beta has 40 paying users — product, not agency." });
    await d.update(applications).set({ bucket: relabel.next.bucket, label: relabel.next.label, reviewNote: relabel.audit.note }).where(eq(applications.id, row.id));
    await d.insert(auditEvents).values({ orgId: org!.id, applicationId: row.id, actorId: actor.userId, action: relabel.audit.action, note: relabel.audit.note, overrideFrom: relabel.audit.override?.from, overrideTo: relabel.audit.override?.to, isTrainingSignal: true });
    const accept = applyReviewAction(relabel.next, { type: "accept", actor });
    await d.update(applications).set({ bucket: accept.next.bucket }).where(eq(applications.id, row.id));
    await d.insert(auditEvents).values({ orgId: org!.id, applicationId: row.id, actorId: actor.userId, action: accept.audit.action, isTrainingSignal: false });
    console.log(`   ${row.startupName}: relabel ${relabel.audit.override?.from} → ${relabel.audit.override?.to} (training signal), then accept`);
  } else {
    const accept = applyReviewAction({ bucket: row.bucket!, label: row.label! }, { type: "accept", actor, note: "worth an interview" });
    await d.update(applications).set({ bucket: accept.next.bucket, reviewNote: accept.audit.note }).where(eq(applications.id, row.id));
    await d.insert(auditEvents).values({ orgId: org!.id, applicationId: row.id, actorId: actor.userId, action: accept.audit.action, note: accept.audit.note, isTrainingSignal: false });
    console.log(`   ${row.startupName}: accept → SHORTLIST`);
  }
}

console.log("\n── stats (cost meter + buckets) ──");
const buckets = await d
  .select({ bucket: applications.bucket, count: sql<number>`count(*)::int` })
  .from(applications)
  .where(eq(applications.cycleId, cycle!.id))
  .groupBy(applications.bucket);
const [cost] = await d
  .select({ totalUsd: sql<number>`coalesce(sum(${costEvents.costUsd}), 0)::float`, calls: sql<number>`count(*)::int` })
  .from(costEvents)
  .where(eq(costEvents.cycleId, cycle!.id));
for (const b of buckets) console.log(`   ${String(b.bucket).padEnd(13)} ${b.count}`);
console.log(`   cost: $${cost!.totalUsd.toFixed(4)} across ${cost!.calls} model calls`);

console.log("\n── audit trail ──");
const audits = await d.select().from(auditEvents).where(eq(auditEvents.orgId, org!.id));
for (const a of audits) {
  const override = a.overrideFrom ? ` [override ${a.overrideFrom}→${a.overrideTo}, training=${a.isTrainingSignal}]` : "";
  console.log(`   ${a.action.padEnd(8)}${override}${a.note ? ` note="${a.note}"` : ""}`);
}

console.log("\n── shortlist export ──");
const shortlist = await d
  .select()
  .from(applications)
  .where(and(eq(applications.cycleId, cycle!.id), eq(applications.bucket, "SHORTLIST")));
const exportCsv = buildShortlistCsv(
  shortlist.map((r) => ({
    startupName: r.startupName,
    founder: r.founder,
    email: r.email,
    country: r.country,
    sector: r.sector,
    label: r.label ?? "needs_review",
    confidence: r.confidence ?? 0,
    rationale: r.rationale ?? "",
    evidence: (r.evidence as EvidenceLink[] | null) ?? [],
  })),
);
console.log(exportCsv);
process.exit(0);
