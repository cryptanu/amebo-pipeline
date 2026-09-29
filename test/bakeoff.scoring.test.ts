import { describe, expect, it } from "vitest";
import { decisionToGroundTruth, scoreRun } from "@/core/classify/bakeoffScoring";

describe("decisionToGroundTruth", () => {
  it("maps accepted and interviewed to KEEP", () => {
    expect(decisionToGroundTruth("Accepted")).toBe("KEEP");
    expect(decisionToGroundTruth("Interviewed")).toBe("KEEP");
  });
  it("maps any rejection to FILTER", () => {
    expect(decisionToGroundTruth("Rejected - out of mandate")).toBe("FILTER");
    expect(decisionToGroundTruth("Rejected - outside geography focus")).toBe("FILTER");
  });
  it("maps missing/unknown decisions to UNKNOWN (excluded from scoring)", () => {
    expect(decisionToGroundTruth(null)).toBe("UNKNOWN");
    expect(decisionToGroundTruth("Waitlisted")).toBe("UNKNOWN");
  });
});

describe("scoreRun", () => {
  it("computes precision, false-negative rate, and cost", () => {
    const score = scoreRun([
      { truth: "FILTER", bucket: "AUTO_FILTERED", costUsd: 0.001 }, // true filter
      { truth: "FILTER", bucket: "AUTO_FILTERED", costUsd: 0.001 }, // true filter
      { truth: "KEEP", bucket: "AUTO_FILTERED", costUsd: 0.001 },   // FALSE NEGATIVE
      { truth: "KEEP", bucket: "SHORTLIST", costUsd: 0.001 },
      { truth: "KEEP", bucket: "REVIEW_QUEUE", costUsd: 0.001 },    // queue is safe, not an FN
      { truth: "UNKNOWN", bucket: "REVIEW_QUEUE", costUsd: 0.001 }, // excluded
    ]);
    expect(score.scored).toBe(5);
    expect(score.autoFiltered).toBe(3);
    expect(score.filterPrecision).toBeCloseTo(2 / 3);
    expect(score.falseNegativeRate).toBeCloseTo(1 / 3); // 1 FN of 3 KEEPs
    expect(score.totalCostUsd).toBeCloseTo(0.006);
    expect(score.costPerApplicationUsd).toBeCloseTo(0.001);
  });

  it("handles a run with no auto-filters without dividing by zero", () => {
    const score = scoreRun([{ truth: "KEEP", bucket: "SHORTLIST", costUsd: 0.002 }]);
    expect(score.filterPrecision).toBeNull();
    expect(score.falseNegativeRate).toBe(0);
  });
});
