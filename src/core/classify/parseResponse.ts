import { z } from "zod";
import { LABELS, type ClassificationResult } from "./types";

const schema = z.object({
  label: z.enum(LABELS),
  confidence: z.number().min(0).max(1),
  rationale: z.string().min(1),
  evidence: z.array(z.object({ source: z.string(), excerpt: z.string() })).default([]),
  criteriaFailed: z.array(z.string()).default([]),
});

export type ParseOutcome =
  | { ok: true; result: ClassificationResult }
  | { ok: false; error: string };

/**
 * Parse-don't-validate: model output crosses this boundary exactly once,
 * and everything past it is a typed ClassificationResult. Malformed output
 * is an error value, never an exception and never a silent default label.
 */
export function parseClassificationReply(rawText: string): ParseOutcome {
  const stripped = rawText
    .trim()
    .replace(/^```(?:json)?\s*/i, "")
    .replace(/\s*```$/, "");

  let parsed: unknown;
  try {
    parsed = JSON.parse(stripped);
  } catch {
    return { ok: false, error: "model reply was not valid JSON" };
  }

  const checked = schema.safeParse(parsed);
  if (!checked.success) {
    return { ok: false, error: `model reply failed schema: ${checked.error.issues[0]?.message}` };
  }
  return { ok: true, result: checked.data };
}
