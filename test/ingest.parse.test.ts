import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";
import { parseIntakeCsv } from "@/core/ingest/parseIntakeCsv";

const fixture = readFileSync("test/fixtures/mock_catapult_intake_export.csv", "utf8");

describe("parseIntakeCsv", () => {
  it("parses all ten fixture rows with zero rejects", () => {
    const result = parseIntakeCsv(fixture);
    expect(result.applications).toHaveLength(10);
    expect(result.errors).toHaveLength(0);
  });

  it("carries startup name, founder, and normalized fields", () => {
    const { applications } = parseIntakeCsv(fixture);
    const paylink = applications.find((a) => a.startupName === "PayLink");
    expect(paylink).toBeDefined();
    expect(paylink?.founder).toBe("Funke Adebayo");
    expect(paylink?.revenue).toEqual({ amount: 4200, currency: "USD", raw: "4200" });
    expect(paylink?.stage).toBe("pre_seed");
    expect(paylink?.deckFile).toBe("decks/paylink_deck.pdf");
    expect(paylink?.decision).toBe("Accepted");
  });

  it("normalizes naira revenue on the bakery row", () => {
    const { applications } = parseIntakeCsv(fixture);
    const bakery = applications.find((a) => a.startupName.startsWith("Okafor"));
    expect(bakery?.revenue).toEqual({ amount: 2_500_000, currency: "NGN", raw: "₦2,500,000" });
  });

  it("treats missing deck as null, not empty string", () => {
    const { applications } = parseIntakeCsv(fixture);
    const grace = applications.find((a) => a.startupName === "Grace Event Planning");
    expect(grace?.deckFile).toBeNull();
    expect(grace?.revenue.amount).toBeNull();
  });

  it("reports rows missing required fields as errors without dropping the batch", () => {
    const broken =
      "Timestamp,Email Address,Startup name,Founder full name,Country of operation,Sector,Stage,Describe what your company does,Monthly revenue (USD),Is your revenue recurring?,Team size,Have you raised external funding?,What makes your business scalable?,Pitch deck file,Decision\n" +
      '2026/04/02 9:14:33 AM GMT+1,ok@x.com,GoodCo,Jane,Nigeria,Fintech,Seed,"Does things",100,Yes,2,No,,decks/a.pdf,Accepted\n' +
      "2026/04/02 9:15:00 AM GMT+1,,,,Nigeria,Fintech,Seed,,,,,,,,\n";
    const result = parseIntakeCsv(broken);
    expect(result.applications).toHaveLength(1);
    expect(result.errors).toHaveLength(1);
    expect(result.errors[0]?.row).toBe(3); // 1-indexed including header
    expect(result.errors[0]?.reasons.join(" ")).toMatch(/startup name/i);
  });

  it("rejects a CSV whose header is missing required columns", () => {
    expect(() => parseIntakeCsv("Foo,Bar\n1,2\n")).toThrow(/missing required column/i);
  });

  it("flags duplicate applicants (same email + startup) as errors on the later row", () => {
    const dup =
      "Timestamp,Email Address,Startup name,Founder full name,Country of operation,Sector,Stage,Describe what your company does,Monthly revenue (USD),Is your revenue recurring?,Team size,Have you raised external funding?,What makes your business scalable?,Pitch deck file,Decision\n" +
      "t1,a@x.com,SameCo,Jane,Nigeria,Fintech,Seed,desc,100,Yes,2,No,,decks/a.pdf,Accepted\n" +
      "t2,a@x.com,SameCo,Jane,Nigeria,Fintech,Seed,desc,100,Yes,2,No,,decks/a.pdf,Accepted\n";
    const result = parseIntakeCsv(dup);
    expect(result.applications).toHaveLength(1);
    expect(result.errors[0]?.reasons.join(" ")).toMatch(/duplicate/i);
  });
});
