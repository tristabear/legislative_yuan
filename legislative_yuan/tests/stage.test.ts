import { describe, expect, it } from "vitest";
import { STAGES, daysPending, normalizeStage } from "../lib/stage";

describe("normalizeStage", () => {
  it("maps 排入院會 to first-reading", () => {
    expect(normalizeStage("排入院會").id).toBe("first-reading");
  });

  it("maps 交付審查 to committee-review", () => {
    expect(normalizeStage("交付審查").id).toBe("committee-review");
  });

  it("maps negotiation-related statuses to negotiation", () => {
    expect(normalizeStage("交付協商").id).toBe("negotiation");
    expect(normalizeStage("逕付二讀(交付協商)").id).toBe("negotiation");
    expect(normalizeStage("委員會抽出逕付二讀(交付協商)").id).toBe("negotiation");
  });

  it("maps 排入院會(討論事項) and 審查完畢 variants to second-reading", () => {
    expect(normalizeStage("排入院會(討論事項)").id).toBe("second-reading");
    expect(normalizeStage("審查完畢").id).toBe("second-reading");
    expect(normalizeStage("審查完畢(逾審查期限)").id).toBe("second-reading");
  });

  it("maps 三讀 and 審查完畢(三讀) to third-reading", () => {
    expect(normalizeStage("三讀").id).toBe("third-reading");
    expect(normalizeStage("審查完畢(三讀)").id).toBe("third-reading");
  });

  it("maps closing statuses to closed", () => {
    for (const status of ["撤案", "交付查照", "交付處理", "函復請願人", "復請查照"]) {
      expect(normalizeStage(status).id).toBe("closed");
    }
  });

  it("falls back to an 'other' stage with the raw status in the label", () => {
    const stage = normalizeStage("從未見過的狀態");
    expect(stage.id).toBe("other");
    expect(stage.label).toContain("從未見過的狀態");
  });
});

describe("STAGES", () => {
  it("has unique ids", () => {
    const ids = STAGES.map((s) => s.id);
    expect(new Set(ids).size).toBe(ids.length);
  });
});

describe("daysPending", () => {
  it("computes whole days between proposal date and now", () => {
    const now = new Date("2026-06-12T00:00:00Z");
    expect(daysPending("2026-06-02", now)).toBe(10);
  });

  it("returns null when proposalDate is null", () => {
    expect(daysPending(null)).toBeNull();
  });

  it("returns null for an unparseable date", () => {
    expect(daysPending("not-a-date")).toBeNull();
  });

  it("never returns a negative number", () => {
    const now = new Date("2026-06-12T00:00:00Z");
    expect(daysPending("2026-06-20", now)).toBe(0);
  });
});
