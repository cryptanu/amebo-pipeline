import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/auth";
import { resolveActor } from "@/auth/roles";
import { db } from "@/db/client";
import { applications, costEvents, cycles } from "@/db/schema";
import { compileRubric, type MandateConfig } from "@/core/mandate/rubric";
import { classifyApplication } from "@/core/classify/pipeline";
import { providerFor } from "@/core/classify/providerRegistry";
import { and, eq, isNull } from "drizzle-orm";

export const dynamic = "force-dynamic";
export const maxDuration = 300;

/**
 * POST /api/classify { orgId, cycleId }
 * Classifies every not-yet-classified application in the cycle,
 * sequentially. Admin-only. Pilot-scale by design; a job queue is the
 * documented next step once batches exceed a few hundred rows.
 */
export async function POST(req: NextRequest) {
  const session = await auth();
  if (!session?.user?.email) return NextResponse.json({ error: "unauthenticated" }, { status: 401 });

  const { orgId, cycleId } = await req.json();
  if (!orgId || !cycleId) return NextResponse.json({ error: "orgId and cycleId required" }, { status: 400 });

  const actor = await resolveActor(session.user.email, orgId);
  if (actor?.role !== "admin") return NextResponse.json({ error: "admin-only" }, { status: 403 });

  const cycle = (await db().select().from(cycles).where(and(eq(cycles.id, cycleId), eq(cycles.orgId, orgId))).limit(1))[0];
  if (!cycle) return NextResponse.json({ error: "cycle not found" }, { status: 404 });

  const rubric = compileRubric(cycle.mandateConfig as MandateConfig);
  const provider = providerFor(cycle.modelId);
  const pending = await db()
    .select()
    .from(applications)
    .where(and(eq(applications.cycleId, cycleId), eq(applications.orgId, orgId), isNull(applications.bucket)));

  let classified = 0;
  let failedToQueue = 0;

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
      deckText: null, // deck text extraction is the next increment
      threshold: cycle.threshold,
    });

    await db()
      .update(applications)
      .set(
        outcome.ok
          ? {
              label: outcome.result.label,
              confidence: outcome.result.confidence,
              rationale: outcome.result.rationale,
              evidence: outcome.result.evidence,
              bucket: outcome.bucket,
            }
          : { bucket: "REVIEW_QUEUE", rationale: `classification failed: ${outcome.error}` },
      )
      .where(eq(applications.id, row.id));

    await db().insert(costEvents).values({
      orgId,
      cycleId,
      applicationId: row.id,
      modelId: outcome.modelId,
      inputTokens: 0, // per-call usage aggregation lands with the job queue
      outputTokens: 0,
      costUsd: outcome.costUsd,
    });

    if (outcome.ok) classified += 1;
    else failedToQueue += 1;
  }

  return NextResponse.json({ classified, failedToQueue, total: pending.length });
}
