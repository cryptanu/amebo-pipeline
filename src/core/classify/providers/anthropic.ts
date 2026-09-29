import type { ModelProvider, ModelReply } from "@/core/classify/types";

export function anthropicProvider(opts: { apiKey: string; model?: string }): ModelProvider {
  const model = opts.model ?? "claude-sonnet-4-6";
  return {
    id: `anthropic:${model}`,
    async complete({ system, user, maxTokens = 1024 }): Promise<ModelReply> {
      const res = await fetch("https://api.anthropic.com/v1/messages", {
        method: "POST",
        headers: {
          "content-type": "application/json",
          "x-api-key": opts.apiKey,
          "anthropic-version": "2023-06-01",
        },
        body: JSON.stringify({
          model,
          max_tokens: maxTokens,
          system,
          messages: [{ role: "user", content: user }],
        }),
      });
      if (!res.ok) throw new Error(`anthropic ${res.status}: ${await res.text()}`);
      const data = await res.json();
      const text = (data.content ?? [])
        .filter((b: { type: string }) => b.type === "text")
        .map((b: { text: string }) => b.text)
        .join("");
      return {
        rawText: text,
        usage: {
          inputTokens: data.usage?.input_tokens ?? 0,
          outputTokens: data.usage?.output_tokens ?? 0,
        },
      };
    },
  };
}
