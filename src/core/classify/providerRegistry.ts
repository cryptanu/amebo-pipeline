import type { ModelProvider } from "./types";
import { anthropicProvider } from "./providers/anthropic";
import { openAiCompatibleProvider } from "./providers/openaiCompatible";
import { devHeuristicProvider } from "./providers/devHeuristic";

/**
 * modelId ("vendor:model") → configured provider. The cycle stores the
 * modelId string; this registry is the only place vendor wiring lives.
 */
export function providerFor(modelId: string): ModelProvider {
  const [vendor, ...rest] = modelId.split(":");
  const model = rest.join(":");
  const key = (name: string): string => {
    const v = process.env[name];
    if (!v) throw new Error(`${name} is not set but cycle model is "${modelId}"`);
    return v;
  };

  switch (vendor) {
    case "mock": // LOCAL TESTING ONLY
      return devHeuristicProvider();
    case "anthropic":
      return anthropicProvider({ apiKey: key("ANTHROPIC_API_KEY"), model });
    case "openai":
      return openAiCompatibleProvider({ vendor: "openai", baseUrl: "https://api.openai.com/v1", apiKey: key("OPENAI_API_KEY"), model });
    case "deepseek":
      return openAiCompatibleProvider({ vendor: "deepseek", baseUrl: "https://api.deepseek.com/v1", apiKey: key("DEEPSEEK_API_KEY"), model });
    case "glm":
      return openAiCompatibleProvider({ vendor: "glm", baseUrl: "https://open.bigmodel.cn/api/paas/v4", apiKey: key("GLM_API_KEY"), model });
    default:
      throw new Error(`unknown model vendor in "${modelId}"`);
  }
}
