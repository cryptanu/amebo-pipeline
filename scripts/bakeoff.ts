/**
 * Bake-off harness — internal script, not a product surface.
 *
 * Runs a labeled past-cycle export through every provider that has an API
 * key in the environment and prints precision / false-negative rate /
 * cost per application. The winning model is then set per org in config.
 *
 * Usage: npm run bakeoff [path/to/labeled-export.csv]
 * With no provider keys set, it runs the deterministic mock so the
 * plumbing itself can be exercised end-to-end.
 */
import { readFileSync } from "node:fs";
import { parseIntakeCsv } from "@/core/ingest/parseIntakeCsv";
import { compileRubric } from "@/core/mandate/rubric";
import { classifyApplication } from "@/core/classify/pipeline";
import { decisionToGroundTruth, scoreRun, type ScoredCase } from "@/core/classify/bakeoffScoring";
import { anthropicProvider } from "@/core/classify/providers/anthropic";
import { openAiCompatibleProvider } from "@/core/classify/providers/openaiCompatible";
import { mockProvider } from "@/core/classify/providers/mock";
import type { ModelProvider } from "@/core/classify/types";

const CSV_PATH = process.argv[2] ?? "test/fixtures/mock_catapult_intake_export.csv";
const THRESHOLD = Number(process.env.BAKEOFF_THRESHOLD ?? "0.85");

const rubric = compileRubric({
  programName: process.env.BAKEOFF_PROGRAM ?? "Catapult (bake-off)",
  stages: ["pre_seed", "seed", "idea"],
  sectors: ["Fintech", "Healthtech", "Agritech", "Logistics", "Design/Software"],
  geographies: ["Nigeria", "Ghana", "Kenya"],
  additionalCriteria: "",
});

function configuredProviders(): ModelProvider[] {
  const providers: ModelProvider[] = [];
  if (process.env.ANTHROPIC_API_KEY) {
    providers.push(anthropicProvider({ apiKey: process.env.ANTHROPIC_API_KEY }));
  }
  if (process.env.OPENAI_API_KEY) {
    providers.push(
      openAiCompatibleProvider({ vendor: "openai", baseUrl: "https://api.openai.com/v1", apiKey: process.env.OPENAI_API_KEY, model: "gpt-5.6" }),
    );
  }
  if (process.env.DEEPSEEK_API_KEY) {
    providers.push(
      openAiCompatibleProvider({ vendor: "deepseek", baseUrl: "https://api.deepseek.com/v1", apiKey: process.env.DEEPSEEK_API_KEY, model: "deepseek-chat" }),
    );
  }
  if (process.env.GLM_API_KEY) {
    providers.push(
      openAiCompatibleProvider({ vendor: "glm", baseUrl: "https://open.bigmodel.cn/api/paas/v4", apiKey: process.env.GLM_API_KEY, model: "glm-5" }),
    );
  }
  if (providers.length === 0) {
    console.log("No provider API keys set — running the deterministic mock.\n");
    providers.push(
      mockProvider({
        defaultReply: JSON.stringify({
          label: "needs_review",
          confidence: 0.5,
          rationale: "mock",
          evidence: [],
          criteriaFailed: [],
        }),
      }),
    );
  }
  return providers;
}

const { applications, errors } = parseIntakeCsv(readFileSync(CSV_PATH, "utf8"));
if (errors.length > 0) {
  console.log(`Skipping ${errors.length} malformed row(s):`, errors.map((e) => e.row).join(", "), "\n");
}

for (const provider of configuredProviders()) {
  const cases: ScoredCase[] = [];
  for (const app of applications) {
    const outcome = await classifyApplication({
      provider,
      rubric,
      app,
      deckText: null, // deck text extraction plugs in here once decks flow
      threshold: THRESHOLD,
      price: provider.id.startsWith("mock:") ? () => 0 : undefined,
    });
    cases.push({ truth: decisionToGroundTruth(app.decision), bucket: outcome.bucket, costUsd: outcome.costUsd });
  }
  const score = scoreRun(cases);
  console.log(`── ${provider.id} ──`);
  console.log(`   scored:            ${score.scored} (of ${applications.length})`);
  console.log(`   auto-filtered:     ${score.autoFiltered}`);
  console.log(`   filter precision:  ${score.filterPrecision === null ? "n/a (nothing auto-filtered)" : (score.filterPrecision * 100).toFixed(1) + "%"}`);
  console.log(`   false-neg rate:    ${(score.falseNegativeRate * 100).toFixed(1)}%  ← the metric that matters`);
  console.log(`   cost/application:  $${score.costPerApplicationUsd.toFixed(5)}`);
  console.log("");
}
