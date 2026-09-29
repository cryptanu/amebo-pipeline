import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/auth";
import { resolveActor } from "@/auth/roles";
import { db } from "@/db/client";
import { applications, auditEvents } from "@/db/schema";
import { applyReviewAction, type ReviewAction } from "@/core/review/transitions";
import { and, eq } from "drizzle-orm";

export const dynamic = "force-dynamic";

/** POST /api/review { orgId, applicationId, type, newLabel?, note? } */
export async function POST(req: NextRequest) {
  const session = await auth();
  if (!session?.user?.email) return NextResponse.json({ error: "unauthenticated" }, { status: 401 });

  const body = await req.json();
  const { orgId, applicationId, type, newLabel, note } = body;
  if (!orgId || !applicationId || !type) {
    return NextResponse.json({ error: "orgId, applicationId, type required" }, { status: 400 });
  }

  const actor = await resolveActor(session.user.email, orgId);
  if (!actor) return NextResponse.json({ error: "no membership in this org" }, { status: 403 });

  const app = (
    await db().select().from(applications).where(and(eq(applications.id, applicationId), eq(applications.orgId, orgId))).limit(1)
  )[0];
  if (!app?.bucket || !app.label) return NextResponse.json({ error: "application not found or not classified" }, { status: 404 });

  const action = { type, actor: { userId: actor.userId, role: actor.role }, newLabel, note } as ReviewAction;

  let result;
  try {
    result = applyReviewAction({ bucket: app.bucket, label: app.label }, action);
  } catch (e) {
    return NextResponse.json({ error: e instanceof Error ? e.message : "invalid action" }, { status: 422 });
  }

  await db()
    .update(applications)
    .set({ bucket: result.next.bucket, label: result.next.label, reviewNote: note ?? app.reviewNote })
    .where(eq(applications.id, app.id));

  await db().insert(auditEvents).values({
    orgId,
    applicationId: app.id,
    actorId: actor.userId,
    action: result.audit.action,
    note: result.audit.note,
    overrideFrom: result.audit.override?.from,
    overrideTo: result.audit.override?.to,
    isTrainingSignal: Boolean(result.audit.override), // overrides feed the classifier
  });

  return NextResponse.json({ bucket: result.next.bucket, label: result.next.label });
}
