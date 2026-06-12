import { describe, expect, it } from "vitest";
import {
  CATEGORIES,
  UNCATEGORIZED,
  UNCATEGORIZED_LABEL,
  categorizeBill,
  categoryLabel,
} from "../lib/categories";

describe("categorizeBill", () => {
  it("matches by law name", () => {
    expect(categorizeBill("勞動基準法第32條條文修正草案", ["勞動基準法"])).toEqual([
      "labor",
    ]);
  });

  it("matches by title keyword when law name list is empty", () => {
    expect(categorizeBill("住宅租賃定型化契約應記載事項", [])).toEqual([
      "housing",
    ]);
  });

  it("can match multiple categories", () => {
    const result = categorizeBill("性別平等與勞動權益促進條例修正草案", [
      "性別平等工作法",
    ]);
    expect(result).toContain("labor");
    expect(result).toContain("gender-equality");
  });

  it("falls back to uncategorized when nothing matches", () => {
    expect(categorizeBill("某某不相關法案修正草案", ["某某法"])).toEqual([
      UNCATEGORIZED,
    ]);
  });
});

describe("categoryLabel", () => {
  it("returns the label for a known category id", () => {
    expect(categoryLabel("labor")).toBe("勞工權益");
  });

  it("returns the uncategorized label for unknown ids", () => {
    expect(categoryLabel(UNCATEGORIZED)).toBe(UNCATEGORIZED_LABEL);
    expect(categoryLabel("not-a-real-id")).toBe(UNCATEGORIZED_LABEL);
  });
});

describe("CATEGORIES", () => {
  it("has unique ids", () => {
    const ids = CATEGORIES.map((c) => c.id);
    expect(new Set(ids).size).toBe(ids.length);
  });
});
