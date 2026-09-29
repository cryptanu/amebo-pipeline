import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/auth";
import { resolveActor } from "@/auth/roles";
import { db } from "@/db/client";
import { applications } from "@/db/schema";
import { and, asc, eq } from "drizzle-orm";

export const dynamic = "force-dynamic";

/**
 * GET /api/applications?orgId=&cycleId= — every application in the cycle,
 * all buckets, for the pipeline board/table views. Also returns the
 * caller's role so the UI only offers actions the state machine allows.
 */
export async function GET(req: NextRequest) {
  const session = await auth();
  if (!session?.user?.email) return NextResponse.json({ error: "unauthenticated" }, { status: 401 });

  const orgId = req.nextUrl.searchParams.get("orgId") ?? "";
  const cycleId = req.nextUrl.searchParams.get("cycleId") ?? "";
  const actor = await resolveActor(session.user.email, orgId);
  if (!actor) return NextResponse.json({ error: "no membership in this org" }, { status: 403 });

  const rows = await db()
    .select({
      id: applications.id,
      startupName: applications.startupName,
      founder: applications.founder,
      email: applications.email,
      country: applications.country,
      sector: applications.sector,
      stage: applications.stage,
      description: applications.description,
      revenueAmount: applications.revenueAmount,
      revenueCurrency: applications.revenueCurrency,
      revenueRaw: applications.revenueRaw,
      recurring: applications.recurring,
      teamSize: applications.teamSize,
      externalFunding: applications.externalFunding,
      scalability: applications.scalability,
      hasDeck: applications.deckSha256,
      label: applications.label,
      confidence: applications.confidence,
      rationale: applications.rationale,
      evidence: applications.evidence,
      bucket: applications.bucket,
      reviewNote: applications.reviewNote,
    })
    .from(applications)
    .where(and(eq(applications.orgId, orgId), eq(applications.cycleId, cycleId)))
    .orderBy(asc(applications.sourceRow));

  return NextResponse.json({
    role: actor.role,
    applications: rows.map(({ hasDeck, ...r }) => ({ ...r, hasDeck: hasDeck !== null })),
  });
}
