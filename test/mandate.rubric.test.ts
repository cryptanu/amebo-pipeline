import { describe, expect, it } from "vitest";
import { compileRubric, type MandateConfig } from "@/core/mandate/rubric";

const config: MandateConfig = {
  programName: "Catapult 2027",
  stages: ["pre_seed", "seed"],
  sectors: ["Fintech", "Healthtech", "Agritech", "Logistics"],
  geographies: ["Nigeria", "Ghana", "Kenya"],
  additionalCriteria: "Prefer post-revenue teams with recurring models.",
};

describe("compileRubric", () => {
  it("produces one criterion per structured dimension plus free text", () => {
    const rubric = compileRubric(config);
    const kinds = rubric.criteria.map((c) => c.kind);
    expect(kinds).toEqual(["stage", "sector", "geography", "venture_scalability", "additional"]);
  });

  it("always includes the venture-scalability criterion even with empty config", () => {
    const rubric = compileRubric({ programName: "X", stages: [], sectors: [], geographies: [], additionalCriteria: "" });
    expect(rubric.criteria.some((c) => c.kind === "venture_scalability")).toBe(true);
    expect(rubric.criteria.some((c) => c.kind === "additional")).toBe(false);
  });

  it("renders criteria into deterministic prompt text", () => {
    const rubric = compileRubric(config);
    expect(rubric.promptText).toContain("Catapult 2027");
    expect(rubric.promptText).toContain("Nigeria, Ghana, Kenya");
    expect(compileRubric(config).promptText).toBe(rubric.promptText);
  });
});
