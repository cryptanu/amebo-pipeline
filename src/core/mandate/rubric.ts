import type { Stage } from "@/core/ingest/normalize";

export interface MandateConfig {
  programName: string;
  stages: Stage[];
  sectors: string[];
  geographies: string[];
  additionalCriteria: string;
}

export type CriterionKind = "stage" | "sector" | "geography" | "venture_scalability" | "additional";

export interface Criterion {
  kind: CriterionKind;
  text: string;
}

export interface Rubric {
  programName: string;
  criteria: Criterion[];
  promptText: string;
}

/**
 * Compile the admin's structured mandate config into an ordered rubric.
 * venture_scalability is non-optional: the SME-vs-startup distinction is
 * the product, so it is asserted even when every other field is empty.
 */
export function compileRubric(config: MandateConfig): Rubric {
  const criteria: Criterion[] = [];

  if (config.stages.length > 0) {
    criteria.push({ kind: "stage", text: `Stage must be one of: ${config.stages.join(", ")}.` });
  }
  if (config.sectors.length > 0) {
    criteria.push({ kind: "sector", text: `Sector must fall within: ${config.sectors.join(", ")}.` });
  }
  if (config.geographies.length > 0) {
    criteria.push({ kind: "geography", text: `Country of operation must be within: ${config.geographies.join(", ")}.` });
  }
  criteria.push({
    kind: "venture_scalability",
    text: "The business must be venture-scalable: growth decoupled from linear headcount or physical capacity, a credible path to outsized returns. Lifestyle businesses and SMEs (shops, farms, agencies, event services) fail this criterion regardless of revenue.",
  });
  if (config.additionalCriteria.trim() !== "") {
    criteria.push({ kind: "additional", text: config.additionalCriteria.trim() });
  }

  const promptText = [
    `Program: ${config.programName}`,
    ...criteria.map((c, i) => `${i + 1}. [${c.kind}] ${c.text}`),
  ].join("\n");

  return { programName: config.programName, criteria, promptText };
}
