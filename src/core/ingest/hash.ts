import { createHash } from "node:crypto";

export function sha256Hex(data: Buffer | string): string {
  return createHash("sha256").update(data).digest("hex");
}

export interface IngestManifest {
  csvSha256: string;
  deckHashes: Map<string, string>;
  missingDecks: string[]; // referenced by a row, absent from the upload
  orphanDecks: string[]; // uploaded, referenced by no row
}

export function buildIngestManifest(input: {
  csv: Buffer;
  decks: Map<string, Buffer>;
  referencedDecks: string[];
}): IngestManifest {
  const deckHashes = new Map<string, string>();
  for (const [name, bytes] of input.decks) deckHashes.set(name, sha256Hex(bytes));

  const referenced = new Set(input.referencedDecks);
  const missingDecks = input.referencedDecks.filter((d) => !input.decks.has(d));
  const orphanDecks = [...input.decks.keys()].filter((d) => !referenced.has(d));

  return { csvSha256: sha256Hex(input.csv), deckHashes, missingDecks, orphanDecks };
}
