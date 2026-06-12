import { describe, expect, it } from "vitest";
import {
  CURRENT_RULING_PARTY,
  DEFAULT_PARTY,
  partyColor,
  partyForBill,
  partyForLegislator,
} from "../lib/parties";
import type { RawLegislator } from "../lib/ly-api";

const legislators: RawLegislator[] = [
  { 屆: 11, 委員姓名: "王委員", 黨籍: "民主進步黨", 黨團: "民主進步黨" },
  { 屆: 11, 委員姓名: "林委員", 黨籍: "無黨籍" },
  { 屆: 11, 委員姓名: "高金素梅", 黨籍: "無黨籍", 黨團: "中國國民黨" },
];

describe("partyColor", () => {
  it("returns a color for known parties", () => {
    expect(partyColor("民主進步黨")).toBe("#1b9e3f");
    expect(partyColor("中國國民黨")).toBe("#1b4f9e");
    expect(partyColor("台灣民眾黨")).toBe("#0f9d8c");
  });

  it("falls back to the default color for unknown parties", () => {
    expect(partyColor("某政黨")).toBe(partyColor(DEFAULT_PARTY));
  });
});

describe("partyForLegislator", () => {
  it("uses 黨團 when present", () => {
    expect(partyForLegislator("王委員", legislators)).toBe("民主進步黨");
  });

  it("falls back to 其他 when 無黨籍 with no 黨團", () => {
    expect(partyForLegislator("林委員", legislators)).toBe(DEFAULT_PARTY);
  });

  it("returns 其他 for unknown names", () => {
    expect(partyForLegislator("不存在的人", legislators)).toBe(DEFAULT_PARTY);
  });

  it("applies legislatorOverrides even if roster data disagrees", () => {
    // 高金素梅 already resolves to 中國國民黨 via 黨團, but the override
    // must take precedence regardless, as a safeguard for missing 黨團 data.
    const noCaucusRoster: RawLegislator[] = [
      { 屆: 11, 委員姓名: "高金素梅", 黨籍: "無黨籍" },
    ];
    expect(partyForLegislator("高金素梅", noCaucusRoster)).toBe("中國國民黨");
  });
});

describe("partyForBill", () => {
  it("returns the ruling party for 政府提案 regardless of body", () => {
    expect(
      partyForBill({ source: "政府提案", proposers: [], legislators })
    ).toBe(CURRENT_RULING_PARTY);
  });

  it("returns the first proposer's party for 委員提案", () => {
    expect(
      partyForBill({
        source: "委員提案",
        proposers: ["王委員", "林委員"],
        legislators,
      })
    ).toBe("民主進步黨");
  });

  it("returns 其他 when there are no proposers", () => {
    expect(
      partyForBill({ source: "委員提案", proposers: [], legislators })
    ).toBe(DEFAULT_PARTY);
  });
});
