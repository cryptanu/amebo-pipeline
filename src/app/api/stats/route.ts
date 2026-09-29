import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/auth";
import { resolveActor } from "@/auth/roles";
import { db } from "@/db/client";
import { applications } from "@/db/schema";
import { and, eq, sql } from "drizzle-orm";

export const dynamic = "force-dynamic";

/**
 * GET /api/stats?orgId=&cycleId= — bucket counts. Screening cost is an
 * Amebo-internal metric (cost_events table) and is deliberately not exposed
 * to customer orgs.
 */
export async function GET(req: NextRequest) {
  const session = await auth();
  if (!session?.user?.email) return NextResponse.json({ error: "unauthenticated" }, { status: 401 });

  const orgId = req.nextUrl.searchParams.get("orgId") ?? "";
  const cycleId = req.nextUrl.searchParams.get("cycleId") ?? "";
  const actor = await resolveActor(session.user.email, orgId);
  if (!actor) return NextResponse.json({ error: "no membership in this org" }, { status: 403 });

  const buckets = await db()
    .select({ bucket: applications.bucket, count: sql<number>`count(*)::int` })
    .from(applications)
    .where(and(eq(applications.orgId, orgId), eq(applications.cycleId, cycleId)))
    .groupBy(applications.bucket);

  return NextResponse.json({ buckets });
}
