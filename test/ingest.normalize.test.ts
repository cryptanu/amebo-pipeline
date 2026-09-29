import { describe, expect, it } from "vitest";
import { parseMoney, normalizeRecurring, normalizeStage } from "@/core/ingest/normalize";

describe("parseMoney", () => {
  it("parses plain integers as USD by default", () => {
    expect(parseMoney("3000")).toEqual({ amount: 3000, currency: "USD", raw: "3000" });
  });

  it("parses naira with symbol and thousands separators", () => {
    expect(parseMoney("₦2,500,000")).toEqual({ amount: 2_500_000, currency: "NGN", raw: "₦2,500,000" });
  });

  it("parses N-prefixed naira", () => {
    expect(parseMoney("N450,000")).toEqual({ amount: 450_000, currency: "NGN", raw: "N450,000" });
  });

  it("parses dollar-symbol values", () => {
    expect(parseMoney("$4,200")).toEqual({ amount: 4200, currency: "USD", raw: "$4,200" });
  });

  it("returns null amount for N/A, empty, and whitespace", () => {
    for (const raw of ["N/A", "", "   ", "n/a", "NA"]) {
      expect(parseMoney(raw)).toEqual({ amount: null, currency: null, raw });
    }
  });

  it("returns null amount for non-numeric garbage without throwing", () => {
    expect(parseMoney("call me")).toEqual({ amount: null, currency: null, raw: "call me" });
  });

  it("handles decimals", () => {
    expect(parseMoney("$1,234.56")).toEqual({ amount: 1234.56, currency: "USD", raw: "$1,234.56" });
  });
});

describe("normalizeRecurring", () => {
  it("maps yes/no/partially case-insensitively", () => {
    expect(normalizeRecurring("Yes")).toBe("yes");
    expect(normalizeRecurring("no")).toBe("no");
    expect(normalizeRecurring("Partially")).toBe("partial");
  });
  it("maps unknown or empty to unknown", () => {
    expect(normalizeRecurring("")).toBe("unknown");
    expect(normalizeRecurring("maybe")).toBe("unknown");
  });
});

describe("normalizeStage", () => {
  it("maps known stages", () => {
    expect(normalizeStage("Pre-seed")).toBe("pre_seed");
    expect(normalizeStage("Seed")).toBe("seed");
    expect(normalizeStage("Idea")).toBe("idea");
    expect(normalizeStage("Revenue")).toBe("revenue");
  });
  it("maps unknown to other", () => {
    expect(normalizeStage("Series Z")).toBe("other");
  });
});
