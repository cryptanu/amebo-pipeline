import type { TokenUsage } from "./types";

export interface ModelPricing {
  inputPerMTokUsd: number;
  outputPerMTokUsd: number;
}

/**
 * CONFIG, not truth: rates drift. Update from the provider price pages
 * before every cycle; the bake-off report prints which table version it used.
 * Values below are placeholders in realistic ranges, marked for review.
 */
export const PRICING: Record<string, ModelPricing> = {
  "anthropic:claude-sonnet-4-6": { inputPerMTokUsd: 3.0, outputPerMTokUsd: 15.0 },
  "openai:gpt-5.6": { inputPerMTokUsd: 2.5, outputPerMTokUsd: 10.0 },
  "deepseek:deepseek-chat": { inputPerMTokUsd: 0.3, outputPerMTokUsd: 1.2 },
  "glm:glm-5": { inputPerMTokUsd: 0.6, outputPerMTokUsd: 2.2 },
  "mock:heuristic": { inputPerMTokUsd: 0.3, outputPerMTokUsd: 1.2 }, // LOCAL TESTING ONLY
};

export function computeCostUsd(modelId: string, usage: TokenUsage): number {
  const pricing = PRICING[modelId];
  if (!pricing) {
    throw new Error(`No pricing entry for model "${modelId}" — add it to PRICING before running.`);
  }
  return (
    (usage.inputTokens / 1_000_000) * pricing.inputPerMTokUsd +
    (usage.outputTokens / 1_000_000) * pricing.outputPerMTokUsd
  );
}
