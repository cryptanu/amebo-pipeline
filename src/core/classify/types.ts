export const LABELS = ["venture_scalable", "sme_lifestyle", "out_of_mandate", "needs_review"] as const;
export type Label = (typeof LABELS)[number];

export const BUCKETS = ["SHORTLIST", "REVIEW_QUEUE", "AUTO_FILTERED"] as const;
export type Bucket = (typeof BUCKETS)[number];

export interface EvidenceLink {
  source: string; // e.g. "csv:Describe what your company does" or "deck:p.4"
  excerpt: string;
}

export interface ClassificationResult {
  label: Label;
  confidence: number; // 0..1
  rationale: string;
  evidence: EvidenceLink[];
  criteriaFailed: string[]; // criterion kinds that failed, empty for venture_scalable
}

export interface TokenUsage {
  inputTokens: number;
  outputTokens: number;
}

export interface ModelReply {
  rawText: string;
  usage: TokenUsage;
}

/** Ports-and-adapters seam: the app depends on this interface, never on a vendor SDK. */
export interface ModelProvider {
  readonly id: string; // e.g. "anthropic:claude-sonnet-4-6"
  complete(input: { system: string; user: string; maxTokens?: number }): Promise<ModelReply>;
}
