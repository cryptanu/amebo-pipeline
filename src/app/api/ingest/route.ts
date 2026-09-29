import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/auth";
import { resolveActor } from "@/auth/roles";
import { db } from "@/db/client";
import { applications, ingestBatches } from "@/db/schema";
import { parseIntakeCsv } from "@/core/ingest/parseIntakeCsv";
import { buildIngestManifest, sha256Hex } from "@/core/ingest/hash";

export const dynamic = "force-dynamic";

/**
 * POST /api/ingest — multipart form:
 *   orgId, cycleId, csv (file), decks (files, repeated)
 * Admin only: uploading a batch starts a cycle's screening run.
 */
export async function POST(req: NextRequest) {
  const session = await auth();
  if (!session?.user?.email) return NextResponse.json({ error: "unauthenticated" }, { status: 401 });

  const form = await req.formData();
  const orgId = String(form.get("orgId") ?? "");
  const cycleId = String(form.get("cycleId") ?? "");
  const csvFile = form.get("csv");
  if (!orgId || !cycleId || !(csvFile instanceof File)) {
    return NextResponse.json({ error: "orgId, cycleId and a csv file are required" }, { status: 400 });
  }

  const actor = await resolveActor(session.user.email, orgId);
  if (!actor) return NextResponse.json({ error: "no membership in this org" }, { status: 403 });
  if (actor.role !== "admin") return NextResponse.json({ error: "batch upload is admin-only" }, { status: 403 });

  const csvBuffer = Buffer.from(await csvFile.arrayBuffer());
  let parsed;
  try {
    parsed = parseIntakeCsv(csvBuffer.toString("utf8"));
  } catch (e) {
    return NextResponse.json({ error: e instanceof Error ? e.message : "unparseable CSV" }, { status: 422 });
  }

  const decks = new Map<string, Buffer>();
  for (const entry of form.getAll("decks")) {
    if (entry instanceof File) decks.set(entry.name, Buffer.from(await entry.arrayBuffer()));
  }
  const manifest = buildIngestManifest({
    csv: csvBuffer,
    decks,
    referencedDecks: parsed.applications.flatMap((a) => (a.deckFile ? [basename(a.deckFile)] : [])),
  });

  const [batch] = await db()
    .insert(ingestBatches)
    .values({
      orgId,
      cycleId,
      uploadedBy: actor.userId,
      csvSha256: manifest.csvSha256,
      rowCount: parsed.applications.length,
      errorCount: parsed.errors.length,
      rowErrors: parsed.errors,
    })
    .returning({ id: ingestBatches.id });

  if (parsed.applications.length > 0) {
    await db()
      .insert(applications)
      .values(
        parsed.applications.map((a) => ({
          orgId,
          cycleId,
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
          deckSha256: a.deckFile ? (manifest.deckHashes.get(basename(a.deckFile)) ?? null) : null,
          priorDecision: a.decision,
        })),
      );
  }

  return NextResponse.json({
    batchId: batch!.id,
    ingested: parsed.applications.length,
    rowErrors: parsed.errors,
    missingDecks: manifest.missingDecks,
    orphanDecks: manifest.orphanDecks,
  });
}

function basename(path: string): string {
  return path.split("/").pop() ?? path;
}
