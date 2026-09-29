import { describe, expect, it } from "vitest";
import { sha256Hex, buildIngestManifest } from "@/core/ingest/hash";

describe("sha256Hex", () => {
  it("hashes deterministically", () => {
    const a = sha256Hex(Buffer.from("hello"));
    expect(a).toBe("2cf24dba5fb0a30e26e83b2ac5b9e29e1b161e5c1fa7425e73043362938b9824");
    expect(sha256Hex(Buffer.from("hello"))).toBe(a);
  });
});

describe("buildIngestManifest", () => {
  it("hashes the CSV and every deck, and flags decks referenced but not supplied", () => {
    const manifest = buildIngestManifest({
      csv: Buffer.from("a,b\n1,2\n"),
      decks: new Map([["decks/one.pdf", Buffer.from("pdf-bytes")]]),
      referencedDecks: ["decks/one.pdf", "decks/missing.pdf"],
    });
    expect(manifest.csvSha256).toHaveLength(64);
    expect(manifest.deckHashes.get("decks/one.pdf")).toHaveLength(64);
    expect(manifest.missingDecks).toEqual(["decks/missing.pdf"]);
    expect(manifest.orphanDecks).toEqual([]);
  });

  it("flags supplied decks no row references as orphans", () => {
    const manifest = buildIngestManifest({
      csv: Buffer.from("x"),
      decks: new Map([["decks/extra.pdf", Buffer.from("y")]]),
      referencedDecks: [],
    });
    expect(manifest.orphanDecks).toEqual(["decks/extra.pdf"]);
  });
});
