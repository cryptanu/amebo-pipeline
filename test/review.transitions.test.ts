import { describe, expect, it } from "vitest";
import { applyReviewAction } from "@/core/review/transitions";

const reviewer = { userId: "u1", role: "reviewer" as const };
const admin = { userId: "u2", role: "admin" as const };

describe("applyReviewAction", () => {
  it("accept moves a queued application to SHORTLIST with an audit event", () => {
    const out = applyReviewAction({ bucket: "REVIEW_QUEUE", label: "needs_review" }, { type: "accept", actor: reviewer, note: "strong traction" });
    expect(out.next.bucket).toBe("SHORTLIST");
    expect(out.audit.action).toBe("accept");
    expect(out.audit.actorId).toBe("u1");
    expect(out.audit.note).toBe("strong traction");
    expect(out.audit.at).toMatch(/^\d{4}-\d{2}-\d{2}T/);
  });

  it("reject moves a queued application to AUTO_FILTERED equivalent (REJECTED)", () => {
    const out = applyReviewAction({ bucket: "REVIEW_QUEUE", label: "sme_lifestyle" }, { type: "reject", actor: reviewer });
    expect(out.next.bucket).toBe("REJECTED");
  });

  it("relabel keeps the application queued but records old and new labels as an override", () => {
    const out = applyReviewAction({ bucket: "REVIEW_QUEUE", label: "out_of_mandate" }, { type: "relabel", actor: reviewer, newLabel: "venture_scalable" });
    expect(out.next.bucket).toBe("REVIEW_QUEUE");
    expect(out.next.label).toBe("venture_scalable");
    expect(out.audit.override).toEqual({ from: "out_of_mandate", to: "venture_scalable" });
  });

  it("admins can overturn an AUTO_FILTERED decision back to the queue", () => {
    const out = applyReviewAction({ bucket: "AUTO_FILTERED", label: "sme_lifestyle" }, { type: "reopen", actor: admin });
    expect(out.next.bucket).toBe("REVIEW_QUEUE");
  });

  it("reviewers cannot reopen auto-filtered applications", () => {
    expect(() => applyReviewAction({ bucket: "AUTO_FILTERED", label: "sme_lifestyle" }, { type: "reopen", actor: reviewer })).toThrow(/admin/i);
  });

  it("rejects actions on terminal states", () => {
    expect(() => applyReviewAction({ bucket: "REJECTED", label: "sme_lifestyle" }, { type: "accept", actor: reviewer })).toThrow(/terminal|invalid/i);
  });

  it("relabel without a newLabel is invalid", () => {
    // @ts-expect-error — deliberately malformed action
    expect(() => applyReviewAction({ bucket: "REVIEW_QUEUE", label: "sme_lifestyle" }, { type: "relabel", actor: reviewer })).toThrow(/newLabel/i);
  });
});
