import type { ModelProvider, ModelReply } from "@/core/classify/types";

/**
 * Deterministic test double. Scripted replies keyed by a substring of the
 * user prompt (usually the startup name); falls back to a default reply.
 */
export function mockProvider(opts: {
  replies?: Map<string, string>;
  defaultReply?: string;
  usage?: { inputTokens: number; outputTokens: number };
}): ModelProvider & { calls: { system: string; user: string }[] } {
  const calls: { system: string; user: string }[] = [];
  return {
    id: "mock:test-model",
    calls,
    async complete({ system, user }): Promise<ModelReply> {
      calls.push({ system, user });
      let rawText = opts.defaultReply ?? "";
      for (const [needle, reply] of opts.replies ?? []) {
        if (user.includes(needle)) {
          rawText = reply;
          break;
        }
      }
      return { rawText, usage: opts.usage ?? { inputTokens: 1000, outputTokens: 200 } };
    },
  };
}
