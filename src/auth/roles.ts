import { db } from "@/db/client";
import { memberships, users } from "@/db/schema";
import { and, eq } from "drizzle-orm";

export interface OrgActor {
  userId: string;
  orgId: string;
  role: "admin" | "reviewer";
}

/**
 * Resolve the signed-in email to an org role. Returns null when the user
 * has no membership — provisioning is manual in v1, so an unknown Google
 * account gets a clean 403, not an auto-created org.
 */
export async function resolveActor(email: string, orgId: string): Promise<OrgActor | null> {
  const rows = await db()
    .select({ userId: users.id, role: memberships.role })
    .from(users)
    .innerJoin(memberships, and(eq(memberships.userId, users.id), eq(memberships.orgId, orgId)))
    .where(eq(users.email, email))
    .limit(1);
  const row = rows[0];
  return row ? { userId: row.userId, orgId, role: row.role } : null;
}
