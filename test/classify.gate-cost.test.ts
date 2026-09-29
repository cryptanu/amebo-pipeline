import { describe, expect, it } from "vitest";
import { routeToBucket } from "@/core/classify/gate";
import { computeCostUsd, PRICING } from "@/core/classify/cost";
import type { ClassificationResult } from "@/core/classify/types";

const base: Omit<ClassificationResult, "label" | "confidence"> = {
  rationale: "r",
  evidence: [],
  criteriaFailed: [],
};

describe("routeToBucket", () => {
  const threshold = 0.85;

  it("auto-filters only high-confidence rejects", () => {
    expect(routeToBucket({ ...base, label: "sme_lifestyle", confidence: 0.95 }, threshold)).toBe("AUTO_FILTERED");
    expect(routeToBucket({ ...base, label: "out_of_mandate", confidence: 0.9 }, threshold)).toBe("AUTO_FILTERED");
  });

  it("routes low-confidence rejects to the queue — false negatives are the critical failure", () => {
    expect(routeToBucket({ ...base, label: "sme_lifestyle", confidence: 0.84 }, threshold)).toBe("REVIEW_QUEUE");
    expect(routeToBucket({ ...base, label: "out_of_mandate", confidence: 0.5 }, threshold)).toBe("REVIEW_QUEUE");
  });

  it("shortlists high-confidence venture_scalable, queues low-confidence", () => {
    expect(routeToBucket({ ...base, label: "venture_scalable", confidence: 0.9 }, threshold)).toBe("SHORTLIST");
    expect(routeToBucket({ ...base, label: "venture_scalable", confidence: 0.6 }, threshold)).toBe("REVIEW_QUEUE");
  });

  it("always queues needs_review regardless of confidence", () => {
    expect(routeToBucket({ ...base, label: "needs_review", confidence: 0.99 }, threshold)).toBe("REVIEW_QUEUE");
  });

  it("rejects thresholds outside 0..1", () => {
    expect(() => routeToBucket({ ...base, label: "sme_lifestyle", confidence: 0.9 }, 1.2)).toThrow(/threshold/i);
    expect(() => routeToBucket({ ...base, label: "sme_lifestyle", confidence: 0.9 }, -0.1)).toThrow(/threshold/i);
  });

  it("boundary: confidence exactly at threshold auto-filters (>= semantics)", () => {
    expect(routeToBucket({ ...base, label: "sme_lifestyle", confidence: threshold }, threshold)).toBe("AUTO_FILTERED");
  });
});

describe("computeCostUsd", () => {
  it("prices usage against the provider table", () => {
    const anyModel = Object.keys(PRICING)[0]!;
    const p = PRICING[anyModel]!;
    const cost = computeCostUsd(anyModel, { inputTokens: 1_000_000, outputTokens: 1_000_000 });
    expect(cost).toBeCloseTo(p.inputPerMTokUsd + p.outputPerMTokUsd, 10);
  });

  it("throws on an unknown model id instead of silently costing zero", () => {
    expect(() => computeCostUsd("vendor:mystery-model", { inputTokens: 1, outputTokens: 1 })).toThrow(/pricing/i);
  });
});
