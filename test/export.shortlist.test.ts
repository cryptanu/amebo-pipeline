import { describe, expect, it } from "vitest";
import { buildShortlistCsv } from "@/core/export/shortlistCsv";
import { parse } from "csv-parse/sync";

const rows = [
  {
    startupName: "PayLink",
    founder: "Funke Adebayo",
    email: "funke@paylink.africa",
    country: "Nigeria",
    sector: "Fintech",
    label: "venture_scalable" as const,
    confidence: 0.93,
    rationale: 'Merchant API, "recurring" take-rate, 18% m/m growth',
    evidence: [{ source: "csv:Describe what your company does", excerpt: "1,200 merchants onboarded" }],
  },
];

describe("buildShortlistCsv", () => {
  it("round-trips through a CSV parser despite quotes and commas in fields", () => {
    const csv = buildShortlistCsv(rows);
    const parsed: Record<string, string>[] = parse(csv, { columns: true });
    expect(parsed).toHaveLength(1);
    expect(parsed[0]!["Startup"]).toBe("PayLink");
    expect(parsed[0]!["Rationale"]).toContain('"recurring"');
    expect(parsed[0]!["Evidence"]).toContain("1,200 merchants");
  });

  it("emits a header-only file for an empty shortlist rather than an empty string", () => {
    const csv = buildShortlistCsv([]);
    expect(csv.trim().split("\n")).toHaveLength(1);
    expect(csv).toContain("Startup");
  });
});
