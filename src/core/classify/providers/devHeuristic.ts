import type { ModelProvider, ModelReply } from "@/core/classify/types";

/**
 * LOCAL TESTING ONLY: a keyless stand-in model ("mock:heuristic") so the
 * full UI flow can be exercised without API keys. Crude keyword rules that
 * land applications in all three buckets; not a real classifier.
 */
export function devHeuristicProvider(): ModelProvider {
  return {
    id: "mock:heuristic",
    async complete({ user }): Promise<ModelReply> {
      const t = user.toLowerCase();
      const r = (label: string, confidence: number, rationale: string, failed: string[] = []) =>
        JSON.stringify({ label, confidence, rationale, evidence: [], criteriaFailed: failed });
      let rawText: string;
      if (/united arab emirates|united states|united kingdom|india\b/.test(t))
        rawText = r("out_of_mandate", 0.92, "[mock] Operating outside the program's geographies.", ["geography"]);
      else if (/bakery|tailor|stitch|event planning|poultry|salon|restaurant|catering/.test(t))
        rawText = r("sme_lifestyle", 0.9, "[mock] Growth appears linear with locations/headcount.", ["venture_scalability"]);
      else if (/agency|consultanc/.test(t))
        rawText = r("needs_review", 0.55, "[mock] Service business today with a product in progress — ambiguous.");
      else if (/api|saas|platform|marketplace|software|network effect/.test(t))
        rawText = r("venture_scalable", /network effect|m\/m|subscription/.test(t) ? 0.91 : 0.74, "[mock] Software-led model with scalable unit economics.");
      else rawText = r("needs_review", 0.5, "[mock] Not enough signal to decide.");
      return { rawText, usage: { inputTokens: 1400, outputTokens: 180 } };
    },
  };
}
