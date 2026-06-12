import { describe, expect, it } from "vitest";
import {
  buildMeta,
  findUnmatchedProposers,
  processBill,
  selectMergeCandidates,
  shouldFetchMergeCheck,
} from "../scripts/build-data";
import type { MergeCheckEntry, MergeCheckCache } from "../scripts/build-data";
import type { RawBill, RawLegislator } from "../lib/ly-api";
import type { ProcessedBill } from "../lib/types";

const legislators: RawLegislator[] = [
  { 屆: 11, 委員姓名: "王委員", 黨籍: "民主進步黨", 黨團: "民主進步黨" },
  { 屆: 11, 委員姓名: "林委員", 黨籍: "中國國民黨", 黨團: "中國國民黨" },
];

function makeBill(overrides: Partial<ProcessedBill> = {}): ProcessedBill {
  return {
    id: "1",
    name: "測試案",
    billType: "法律案",
    source: "委員提案",
    proposerUnit: "本院委員",
    proposers: [],
    party: "其他",
    categories: [],
    stageId: "committee-review",
    stageLabel: "委員會審查",
    stageOrder: 2,
    rawStatus: "交付審查",
    lastUpdateDate: "2025-01-01",
    daysPending: 100,
    mergedInto: null,
    url: "u",
    ...overrides,
  };
}

describe("processBill", () => {
  it("processes a 委員提案 law-amendment bill", () => {
    const raw: RawBill = {
      屆: 11,
      議案編號: "202110000000000",
      議案名稱: "勞動基準法第32條條文修正草案",
      議案類別: "法律案",
      提案來源: "委員提案",
      "提案單位/提案委員": "本院委員王委員等18人",
      提案人: ["王委員"],
      議案狀態: "交付審查",
      最新進度日期: "2026-01-05",
      "法律編號:str": ["勞動基準法"],
      url: "https://ppg.ly.gov.tw/ppg/bills/202110000000000/details",
    };

    const result = processBill(raw, legislators);

    expect(result.id).toBe("202110000000000");
    expect(result.party).toBe("民主進步黨");
    expect(result.categories).toEqual(["labor"]);
    expect(result.stageId).toBe("committee-review");
    expect(result.stageLabel).toBe("委員會審查");
    expect(result.rawStatus).toBe("交付審查");
    expect(result.lastUpdateDate).toBe("2026-01-05");
    expect(result.daysPending).not.toBeNull();
    expect(result.mergedInto).toBeNull();
  });

  it("processes a 政府提案 with no proposers", () => {
    const raw: RawBill = {
      屆: 11,
      議案編號: "202110000000001",
      議案名稱: "函送某報告，請查照案。",
      議案類別: "院內單位來文",
      提案來源: "政府提案",
      "提案單位/提案委員": "內政部",
      提案人: null,
      議案狀態: "交付查照",
      url: "https://ppg.ly.gov.tw/ppg/bills/202110000000001/details",
    };

    const result = processBill(raw, legislators);

    expect(result.party).toBe("民主進步黨"); // CURRENT_RULING_PARTY
    expect(result.proposers).toEqual([]);
    expect(result.categories).toEqual(["uncategorized"]);
    expect(result.stageId).toBe("closed");
    expect(result.daysPending).toBeNull();
    expect(result.mergedInto).toBeNull();
  });

  it("returns null daysPending for a finished bill even with a recent lastUpdateDate", () => {
    const raw: RawBill = {
      屆: 11,
      議案編號: "202110000000002",
      議案名稱: "某法部分條文修正草案",
      議案類別: "法律案",
      提案來源: "委員提案",
      "提案單位/提案委員": "本院委員王委員等18人",
      提案人: ["王委員"],
      議案狀態: "三讀",
      最新進度日期: "2026-06-01",
      "法律編號:str": ["某法"],
      url: "https://ppg.ly.gov.tw/ppg/bills/202110000000002/details",
    };

    const result = processBill(raw, legislators);

    expect(result.stageId).toBe("third-reading");
    expect(result.lastUpdateDate).toBe("2026-06-01");
    expect(result.daysPending).toBeNull();
  });
});

describe("buildMeta", () => {
  it("aggregates counts by party, category, and stage", () => {
    const bills = [
      processBill(
        {
          屆: 11,
          議案編號: "1",
          議案名稱: "勞動基準法修正",
          議案類別: "法律案",
          提案來源: "委員提案",
          "提案單位/提案委員": "本院委員王委員等18人",
          提案人: ["王委員"],
          議案狀態: "交付審查",
          "法律編號:str": ["勞動基準法"],
          url: "u1",
        },
        legislators
      ),
      processBill(
        {
          屆: 11,
          議案編號: "2",
          議案名稱: "道路交通管理處罰條例修正",
          議案類別: "法律案",
          提案來源: "委員提案",
          "提案單位/提案委員": "本院委員林委員等18人",
          提案人: ["林委員"],
          議案狀態: "三讀",
          "法律編號:str": ["道路交通管理處罰條例"],
          url: "u2",
        },
        legislators
      ),
    ];

    const meta = buildMeta(bills);

    expect(meta.totalBills).toBe(2);
    expect(meta.byParty["民主進步黨"]).toBe(1);
    expect(meta.byParty["中國國民黨"]).toBe(1);
    expect(meta.byCategory["labor"]).toBe(1);
    expect(meta.byCategory["transport-safety"]).toBe(1);
    expect(meta.byStage["委員會審查"]).toBe(1);
    expect(meta.byStage["三讀通過"]).toBe(1);
    expect(typeof meta.generatedAt).toBe("string");
  });
});

describe("findUnmatchedProposers", () => {
  it("lists 委員提案 proposer names not found in the legislator roster", () => {
    const bills: RawBill[] = [
      {
        屆: 11,
        議案編號: "1",
        議案名稱: "某法修正",
        議案類別: "法律案",
        提案來源: "委員提案",
        "提案單位/提案委員": "本院委員王委員等18人",
        提案人: ["王委員", "未知委員"],
        議案狀態: "排入院會",
        url: "u1",
      },
      {
        屆: 11,
        議案編號: "2",
        議案名稱: "某報告",
        議案類別: "院內單位來文",
        提案來源: "政府提案",
        "提案單位/提案委員": "內政部",
        提案人: null,
        議案狀態: "交付查照",
        url: "u2",
      },
    ];

    expect(findUnmatchedProposers(bills, legislators)).toEqual(["未知委員"]);
  });
});

describe("selectMergeCandidates", () => {
  const today = new Date("2026-06-12T00:00:00Z");

  it("includes 法律案 in stageOrder 1-4 with lastUpdateDate older than 90 days", () => {
    const bill = makeBill({ lastUpdateDate: "2026-01-01" });
    expect(selectMergeCandidates([bill], today)).toEqual([bill]);
  });

  it("excludes bills updated within the last 90 days", () => {
    const bill = makeBill({ lastUpdateDate: "2026-06-01" });
    expect(selectMergeCandidates([bill], today)).toEqual([]);
  });

  it("excludes non-法律案 bill types", () => {
    const bill = makeBill({ billType: "預算案", lastUpdateDate: "2026-01-01" });
    expect(selectMergeCandidates([bill], today)).toEqual([]);
  });

  it("excludes finished stages (0 and 5)", () => {
    const closed = makeBill({ stageOrder: 0, lastUpdateDate: "2026-01-01" });
    const passed = makeBill({ stageOrder: 5, lastUpdateDate: "2026-01-01" });
    expect(selectMergeCandidates([closed, passed], today)).toEqual([]);
  });

  it("excludes bills with no lastUpdateDate", () => {
    const bill = makeBill({ lastUpdateDate: null });
    expect(selectMergeCandidates([bill], today)).toEqual([]);
  });
});

describe("shouldFetchMergeCheck", () => {
  const today = new Date("2026-06-12T00:00:00Z");

  it("returns true when there is no cache entry", () => {
    expect(shouldFetchMergeCheck(undefined, today)).toBe(true);
  });

  it("returns false when a merge was already found", () => {
    const entry: MergeCheckEntry = {
      checkedAt: "2020-01-01",
      mergedInto: { id: "2", name: "報告", stageLabel: "三讀通過", stageOrder: 5 },
    };
    expect(shouldFetchMergeCheck(entry, today)).toBe(false);
  });

  it("returns false when checked recently with no merge found", () => {
    const entry: MergeCheckEntry = { checkedAt: "2026-06-01", mergedInto: null };
    expect(shouldFetchMergeCheck(entry, today)).toBe(false);
  });

  it("returns true when last checked more than 30 days ago with no merge found", () => {
    const entry: MergeCheckEntry = { checkedAt: "2026-04-01", mergedInto: null };
    expect(shouldFetchMergeCheck(entry, today)).toBe(true);
  });
});
