import type { IntakeApplication } from "@/core/ingest/parseIntakeCsv";
import type { Rubric } from "@/core/mandate/rubric";
import { buildClassificationPrompt } from "./prompt";
import { parseClassificationReply } from "./parseResponse";
import { routeToBucket } from "./gate";
import { computeCostUsd } from "./cost";
import type { TokenUsage } from "./types";
import type { Bucket, ClassificationResult, ModelProvider } from "./types";

export type ClassifyOutcome =
  | { ok: true; result: ClassificationResult; bucket: Bucket; costUsd: number; modelId: string }
  | { ok: false; error: string; bucket: "REVIEW_QUEUE"; costUsd: number; modelId: string };

/**
 * One application through one model: prompt → call → parse (retry once)
 * → gate → cost. Failure is a value, and it fails SAFE: anything the
 * system cannot read routes to humans, never to the auto-filtered pile.
 */
export async function classifyApplication(input: {
  provider: ModelProvider;
  rubric: Rubric;
  app: IntakeApplication;
  deckText: string | null;
  threshold: number;
  /** Injected so tests and the bake-off can price mock or novel models. */
  price?: (modelId: string, usage: TokenUsage) => number;
}): Promise<ClassifyOutcome> {
  const { provider, rubric, app, deckText, threshold } = input;
  const price = input.price ?? computeCostUsd;
  const prompt = buildClassificationPrompt(rubric, app, deckText);

  let costUsd = 0;
  let lastError = "";

  for (let attempt = 1; attempt <= 2; attempt += 1) {
    const reply = await provider.complete({ system: prompt.system, user: prompt.user });
    costUsd += price(provider.id, reply.usage);

    const parsed = parseClassificationReply(reply.rawText);
    if (parsed.ok) {
      return {
        ok: true,
        result: parsed.result,
        bucket: routeToBucket(parsed.result, threshold),
        costUsd,
        modelId: provider.id,
      };
    }
    lastError = parsed.error;
  }

  return { ok: false, error: lastError, bucket: "REVIEW_QUEUE", costUsd, modelId: provider.id };
}

