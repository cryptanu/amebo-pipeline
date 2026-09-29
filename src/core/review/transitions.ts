import type { Label } from "@/core/classify/types";

export type ReviewBucket = "SHORTLIST" | "REVIEW_QUEUE" | "AUTO_FILTERED" | "REJECTED";

export interface ReviewState {
  bucket: ReviewBucket;
  label: Label;
}

export interface Actor {
  userId: string;
  role: "admin" | "reviewer";
}

export type ReviewAction =
  | { type: "accept"; actor: Actor; note?: string }
  | { type: "reject"; actor: Actor; note?: string }
  | { type: "relabel"; actor: Actor; newLabel: Label; note?: string }
  | { type: "reopen"; actor: Actor; note?: string };

export interface AuditEvent {
  action: ReviewAction["type"];
  actorId: string;
  at: string; // ISO timestamp
  note?: string;
  override?: { from: Label; to: Label };
}

/**
 * Explicit state machine for review decisions. Transitions not listed
 * here do not exist; every allowed transition emits an audit event.
 * Overrides (relabels) are the training signal the retention decision
 * exists to collect, so they carry from→to explicitly.
 */
export function applyReviewAction(state: ReviewState, action: ReviewAction): { next: ReviewState; audit: AuditEvent } {
  const at = new Date().toISOString();
  const base = { action: action.type, actorId: action.actor.userId, at, note: action.note };

  if (state.bucket === "REJECTED") {
    throw new Error(`invalid action "${action.type}" on terminal state REJECTED`);
  }

  switch (action.type) {
    case "accept": {
      assertBucket(state, ["REVIEW_QUEUE"], action.type);
      return { next: { ...state, bucket: "SHORTLIST" }, audit: base };
    }
    case "reject": {
      assertBucket(state, ["REVIEW_QUEUE", "SHORTLIST"], action.type);
      return { next: { ...state, bucket: "REJECTED" }, audit: base };
    }
    case "relabel": {
      assertBucket(state, ["REVIEW_QUEUE"], action.type);
      if (!("newLabel" in action) || !action.newLabel) {
        throw new Error("relabel requires a newLabel");
      }
      return {
        next: { bucket: "REVIEW_QUEUE", label: action.newLabel },
        audit: { ...base, override: { from: state.label, to: action.newLabel } },
      };
    }
    case "reopen": {
      assertBucket(state, ["AUTO_FILTERED"], action.type);
      if (action.actor.role !== "admin") {
        throw new Error("only an admin may reopen an auto-filtered application");
      }
      return { next: { ...state, bucket: "REVIEW_QUEUE" }, audit: base };
    }
  }
}

function assertBucket(state: ReviewState, allowed: ReviewBucket[], action: string): void {
  if (!allowed.includes(state.bucket)) {
    throw new Error(`invalid action "${action}" from bucket ${state.bucket}`);
  }
}
