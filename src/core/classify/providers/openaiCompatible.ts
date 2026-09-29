import type { ModelProvider, ModelReply } from "@/core/classify/types";

/**
 * One adapter, three vendors: OpenAI, DeepSeek, and GLM all speak the
 * chat-completions dialect. Vendor identity lives in config, not code.
 */
export function openAiCompatibleProvider(opts: {
  vendor: "openai" | "deepseek" | "glm";
  baseUrl: string;
  apiKey: string;
  model: string;
}): ModelProvider {
  return {
    id: `${opts.vendor}:${opts.model}`,
    async complete({ system, user, maxTokens = 1024 }): Promise<ModelReply> {
      const res = await fetch(`${opts.baseUrl}/chat/completions`, {
        method: "POST",
        headers: {
          "content-type": "application/json",
          authorization: `Bearer ${opts.apiKey}`,
        },
        body: JSON.stringify({
          model: opts.model,
          max_tokens: maxTokens,
          messages: [
            { role: "system", content: system },
            { role: "user", content: user },
          ],
        }),
      });
      if (!res.ok) throw new Error(`${opts.vendor} ${res.status}: ${await res.text()}`);
      const data = await res.json();
      return {
        rawText: data.choices?.[0]?.message?.content ?? "",
        usage: {
          inputTokens: data.usage?.prompt_tokens ?? 0,
          outputTokens: data.usage?.completion_tokens ?? 0,
        },
      };
    },
  };
}
