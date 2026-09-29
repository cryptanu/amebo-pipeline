import type { Bucket, ClassificationResult } from "./types";

/**
 * Confidence gating. Design rule: the gate may only auto-remove an
 * application when the model is BOTH confident AND rejecting. Every other
 * combination costs human attention rather than risking a false negative.
 */
export function routeToBucket(result: ClassificationResult, threshold: number): Bucket {
  if (!(threshold >= 0 && threshold <= 1)) {
    throw new Error(`threshold must be within 0..1, got ${threshold}`);
  }

  if (result.label === "needs_review") return "REVIEW_QUEUE";

  const confident = result.confidence >= threshold;
  if (!confident) return "REVIEW_QUEUE";

  switch (result.label) {
    case "venture_scalable":
      return "SHORTLIST";
    case "sme_lifestyle":
    case "out_of_mandate":
      return "AUTO_FILTERED";
  }
}
