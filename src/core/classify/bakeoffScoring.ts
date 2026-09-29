import type { Bucket } from "./types";

export type GroundTruth = "KEEP" | "FILTER" | "UNKNOWN";

export function decisionToGroundTruth(decision: string | null): GroundTruth {
  if (decision === null) return "UNKNOWN";
  const d = decision.trim().toLowerCase();
  if (d.startsWith("accepted") || d.startsWith("interviewed")) return "KEEP";
  if (d.startsWith("rejected")) return "FILTER";
  return "UNKNOWN";
}

export interface ScoredCase {
  truth: GroundTruth;
  bucket: Bucket;
  costUsd: number;
}

export interface RunScore {
  scored: number;
  autoFiltered: number;
  /** Of everything auto-filtered, how much truly deserved filtering. null when nothing was auto-filtered. */
  filterPrecision: number | null;
  /** Of every KEEP, how many were wrongly auto-filtered. THE metric — kills trust if high. */
  falseNegativeRate: number;
  totalCostUsd: number;
  costPerApplicationUsd: number;
}

export function scoreRun(cases: ScoredCase[]): RunScore {
  const totalCostUsd = cases.reduce((s, c) => s + c.costUsd, 0);
  const scoredCases = cases.filter((c) => c.truth !== "UNKNOWN");

  const auto = scoredCases.filter((c) => c.bucket === "AUTO_FILTERED");
  const trueFilters = auto.filter((c) => c.truth === "FILTER").length;
  const keeps = scoredCases.filter((c) => c.truth === "KEEP");
  const falseNegatives = keeps.filter((c) => c.bucket === "AUTO_FILTERED").length;

  return {
    scored: scoredCases.length,
    autoFiltered: auto.length,
    filterPrecision: auto.length === 0 ? null : trueFilters / auto.length,
    falseNegativeRate: keeps.length === 0 ? 0 : falseNegatives / keeps.length,
    totalCostUsd,
    costPerApplicationUsd: cases.length === 0 ? 0 : totalCostUsd / cases.length,
  };
}
