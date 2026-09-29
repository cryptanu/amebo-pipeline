import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/auth";
import { resolveActor } from "@/auth/roles";
import { db } from "@/db/client";
import { applications } from "@/db/schema";
import { buildShortlistCsv } from "@/core/export/shortlistCsv";
import { and, eq } from "drizzle-orm";
import type { EvidenceLink } from "@/core/classify/types";

export const dynamic = "force-dynamic";

/** GET /api/export?orgId=&cycleId= — SHORTLIST rows as CSV. */
export async function GET(req: NextRequest) {
  const session = await auth();
  if (!session?.user?.email) return NextResponse.json({ error: "unauthenticated" }, { status: 401 });

  const orgId = req.nextUrl.searchParams.get("orgId") ?? "";
  const cycleId = req.nextUrl.searchParams.get("cycleId") ?? "";
  const actor = await resolveActor(session.user.email, orgId);
  if (!actor) return NextResponse.json({ error: "no membership in this org" }, { status: 403 });

  const rows = await db()
    .select()
    .from(applications)
    .where(and(eq(applications.orgId, orgId), eq(applications.cycleId, cycleId), eq(applications.bucket, "SHORTLIST")));

  const csv = buildShortlistCsv(
    rows.map((r) => ({
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

  return new NextResponse(csv, {
    headers: {
      "content-type": "text/csv; charset=utf-8",
      "content-disposition": `attachment; filename="shortlist-${cycleId}.csv"`,
    },
  });
}
