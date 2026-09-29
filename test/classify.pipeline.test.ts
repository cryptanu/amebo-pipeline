import { describe, expect, it } from "vitest";
import { classifyApplication } from "@/core/classify/pipeline";
import { mockProvider } from "@/core/classify/providers/mock";
import { compileRubric } from "@/core/mandate/rubric";
import { parseIntakeCsv } from "@/core/ingest/parseIntakeCsv";
import { readFileSync } from "node:fs";

const rubric = compileRubric({
  programName: "Catapult 2027",
  stages: ["pre_seed", "seed"],
  sectors: ["Fintech", "Healthtech", "Agritech", "Logistics", "Design/Software"],
  geographies: ["Nigeria", "Ghana", "Kenya"],
  additionalCriteria: "",
});

const apps = parseIntakeCsv(readFileSync("test/fixtures/mock_catapult_intake_export.csv", "utf8")).applications;
const paylink = apps.find((a) => a.startupName === "PayLink")!;

const flatPrice = () => 0.0005; // tests price every call at a flat rate

const reply = (label: string, confidence: number) =>
  JSON.stringify({ label, confidence, rationale: "test", evidence: [], criteriaFailed: [] });

describe("classifyApplication", () => {
  it("returns a routed, costed outcome on a clean reply", async () => {
    const provider = mockProvider({ defaultReply: reply("venture_scalable", 0.93) });
    const outcome = await classifyApplication({ provider, rubric, app: paylink, deckText: null, threshold: 0.85, price: flatPrice });
    expect(outcome.ok).toBe(true);
    if (outcome.ok) {
      expect(outcome.bucket).toBe("SHORTLIST");
      expect(outcome.costUsd).toBeGreaterThan(0);
      expect(outcome.modelId).toBe("mock:test-model");
    }
  });

  it("retries once on malformed output, then fails safe to REVIEW_QUEUE", async () => {
    let call = 0;
    const provider = {
      id: "mock:flaky",
      async complete() {
        call += 1;
        return { rawText: "not json at all", usage: { inputTokens: 10, outputTokens: 5 } };
      },
    };
    const outcome = await classifyApplication({ provider, rubric, app: paylink, deckText: null, threshold: 0.85, price: flatPrice });
    expect(call).toBe(2);
    expect(outcome.ok).toBe(false);
    if (!outcome.ok) {
      expect(outcome.bucket).toBe("REVIEW_QUEUE"); // parse failure never auto-filters
      expect(outcome.costUsd).toBeGreaterThan(0); // failed calls still cost money
    }
  });

  it("recovers when the retry returns valid JSON", async () => {
    let call = 0;
    const provider = {
      id: "mock:recovers",
      async complete() {
        call += 1;
        return {
          rawText: call === 1 ? "garbage" : reply("sme_lifestyle", 0.95),
          usage: { inputTokens: 10, outputTokens: 5 },
        };
      },
    };
    const outcome = await classifyApplication({ provider, rubric, app: paylink, deckText: null, threshold: 0.85, price: flatPrice });
    expect(outcome.ok).toBe(true);
    if (outcome.ok) expect(outcome.bucket).toBe("AUTO_FILTERED");
  });
});
