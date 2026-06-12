# Bills Sort Order, Waiting Days, and Merge Detection Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Default the bills list to "most recently active first," redefine "已等待" as days-since-last-status-change (fixing the always-`未知` bug), and detect/surface 法律案 bills that look stuck but were actually resolved via 併案審查 merger.

**Architecture:** `lib/types.ts` drops the dead `proposalDate` field and gains a `mergedInto` field. `scripts/build-data.ts` recomputes `daysPending` from `最新進度日期` (null for finished stages) and adds a cached, incremental merge-check pass that fetches `/bills/{id}` for "stuck" 法律案 candidates and records whether they were folded into a committee report bill that's progressed further. The UI (`app/bills/page.tsx`, `components/BillCard.tsx`, `app/bills/[id]/page.tsx`) gets a sort-mode toggle and merge badges.

**Tech Stack:** Next.js 15 (App Router), TypeScript, Vitest, existing `v2.ly.govapi.tw` API client in `lib/ly-api.ts`.

Spec: `docs/superpowers/specs/2026-06-12-bills-waiting-days-and-merge-detection-design.md`

---

### Task 1: Add `isFinishedStage` helper to `lib/stage.ts`

**Files:**
- Modify: `lib/stage.ts:67` (end of file)
- Test: `tests/stage.test.ts`

- [ ] **Step 1: Write the failing test**

Add a new `describe` block at the end of `tests/stage.test.ts` (after the existing `describe("daysPending", ...)` block), and add `isFinishedStage` to the import on line 2:

```ts
import { STAGES, daysPending, normalizeStage, isFinishedStage } from "../lib/stage";
```

```ts
describe("isFinishedStage", () => {
  it("returns true for closed (0) and third-reading (5)", () => {
    expect(isFinishedStage(0)).toBe(true);
    expect(isFinishedStage(5)).toBe(true);
  });

  it("returns false for in-progress stages (1-4)", () => {
    expect(isFinishedStage(1)).toBe(false);
    expect(isFinishedStage(2)).toBe(false);
    expect(isFinishedStage(3)).toBe(false);
    expect(isFinishedStage(4)).toBe(false);
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run tests/stage.test.ts`
Expected: FAIL — `isFinishedStage` is not exported from `../lib/stage`.

- [ ] **Step 3: Implement `isFinishedStage`**

Append to `lib/stage.ts`:

```ts

export function isFinishedStage(stageOrder: number): boolean {
  return stageOrder === 0 || stageOrder === 5;
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npx vitest run tests/stage.test.ts`
Expected: PASS (all tests in the file).

- [ ] **Step 5: Commit**

```bash
git add lib/stage.ts tests/stage.test.ts
git commit -m "feat: add isFinishedStage helper for stage 0/5"
```

---

### Task 2: Redefine `ProcessedBill` fields and update `processBill`

This removes the dead `proposalDate` field (the bulk API never returns
`提案日期`), adds `mergedInto`, and recomputes `daysPending` from
`最新進度日期`, returning `null` for finished stages.

**Files:**
- Modify: `lib/types.ts:15-32`
- Modify: `lib/ly-api.ts:3-16` and `lib/ly-api.ts:36-44`
- Modify: `scripts/build-data.ts:17-43`
- Test: `tests/build-data.test.ts`

- [ ] **Step 1: Write the failing tests**

In `tests/build-data.test.ts`, update the first `processBill` test (the
委員提案 law-amendment case). Remove the `提案日期: "2026-01-01"` line from
the raw bill fixture (it's not a real API field), and update/add
expectations:

```ts
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
```

Update the second `processBill` test (政府提案, closed) — remove the
`expect(result.proposalDate).toBeNull();` line (the field no longer
exists):

```ts
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
```

Add a third `processBill` test for a finished bill that *does* have a
`最新進度日期` — `daysPending` must still be `null` because the stage is
finished:

```ts
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
```

In the `buildMeta` test, remove the `提案日期: "2026-01-01"` and
`提案日期: "2025-01-01"` lines from both raw bill fixtures (they're no
longer part of `RawBill`).

- [ ] **Step 2: Run tests to verify they fail**

Run: `npx vitest run tests/build-data.test.ts`
Expected: FAIL — `result.mergedInto` is `undefined` (not `null`), and the
third test's `daysPending` is `null` already by coincidence today (current
code always returns `null`), but the first test's
`expect(result.daysPending).not.toBeNull()` will FAIL since current code
computes it from the now-removed `提案日期` (always `null`).

- [ ] **Step 3: Update `lib/types.ts`**

Replace the `ProcessedBill` interface (lines 15-32):

```ts
export interface MergedInto {
  id: string;
  name: string;
  stageLabel: string;
  stageOrder: number;
}

export interface ProcessedBill {
  id: string;
  name: string;
  billType: string;
  source: string;
  proposerUnit: string;
  proposers: string[];
  party: string;
  categories: string[];
  stageId: string;
  stageLabel: string;
  stageOrder: number;
  rawStatus: string;
  lastUpdateDate: string | null;
  daysPending: number | null;
  mergedInto: MergedInto | null;
  url: string;
}
```

- [ ] **Step 4: Update `lib/ly-api.ts`**

Remove the `提案日期?: string;` line from `RawBill` (line 12), so it reads:

```ts
export interface RawBill {
  屆: number;
  議案編號: string;
  議案名稱: string;
  議案類別: string;
  提案來源: string;
  "提案單位/提案委員": string;
  提案人: string[] | null;
  議案狀態: string;
  最新進度日期?: string;
  "法律編號:str"?: string[];
  url: string;
}
```

Replace the `BillDetail` interface (lines 36-44) and add a new
`BillRelatedBill` interface:

```ts
export interface BillRelatedBill {
  議案編號: string;
  議案名稱: string;
}

export interface BillDetail {
  議案編號: string;
  案由?: string;
  提案日期?: string;
  說明?: string;
  連署人?: string[];
  議案流程?: BillProcessEntry[];
  關連議案?: BillRelatedBill[];
  相關附件?: BillAttachment[];
  url: string;
}
```

- [ ] **Step 5: Update `processBill` in `scripts/build-data.ts`**

Add `isFinishedStage` to the import from `../lib/stage` (currently line
11):

```ts
import { daysPending, isFinishedStage, normalizeStage } from "../lib/stage";
```

Replace the `processBill` function (lines 17-43):

```ts
export function processBill(
  bill: RawBill,
  legislators: RawLegislator[]
): ProcessedBill {
  const proposers = bill.提案人 ?? [];
  const lawNames = bill["法律編號:str"] ?? [];
  const stage = normalizeStage(bill.議案狀態);
  const lastUpdateDate = bill.最新進度日期 ?? null;

  return {
    id: bill.議案編號,
    name: bill.議案名稱,
    billType: bill.議案類別,
    source: bill.提案來源,
    proposerUnit: bill["提案單位/提案委員"],
    proposers,
    party: partyForBill({ source: bill.提案來源, proposers, legislators }),
    categories: categorizeBill(bill.議案名稱, lawNames),
    stageId: stage.id,
    stageLabel: stage.label,
    stageOrder: stage.order,
    rawStatus: bill.議案狀態,
    lastUpdateDate,
    daysPending: isFinishedStage(stage.order) ? null : daysPending(lastUpdateDate),
    mergedInto: null,
    url: bill.url,
  };
}
```

- [ ] **Step 6: Run tests to verify they pass**

Run: `npx vitest run tests/build-data.test.ts`
Expected: PASS (all tests in the file).

- [ ] **Step 7: Commit**

```bash
git add lib/types.ts lib/ly-api.ts scripts/build-data.ts tests/build-data.test.ts
git commit -m "feat: redefine daysPending from lastUpdateDate, drop dead proposalDate field"
```

---

### Task 3: Add merge-check candidate selection and cache-decision logic

These are pure functions, unit-tested without any network calls.

**Files:**
- Modify: `scripts/build-data.ts`
- Test: `tests/build-data.test.ts`

- [ ] **Step 1: Write the failing tests**

In `tests/build-data.test.ts`, add `MergedInto` and `ProcessedBill` to the
type import from `../lib/types`, and add a `makeBill` fixture helper plus
new `describe` blocks. Add near the top of the file (after the existing
imports):

Also update the value import from `../scripts/build-data` (currently
`buildMeta, findUnmatchedProposers, processBill`) to:

```ts
import {
  buildMeta,
  findUnmatchedProposers,
  processBill,
  selectMergeCandidates,
  shouldFetchMergeCheck,
} from "../scripts/build-data";
import type { MergeCheckEntry, MergeCheckCache } from "../scripts/build-data";
import type { ProcessedBill } from "../lib/types";

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
```

Then add these `describe` blocks (e.g. at the end of the file):

```ts
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
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `npx vitest run tests/build-data.test.ts`
Expected: FAIL — `selectMergeCandidates`, `shouldFetchMergeCheck`,
`MergeCheckEntry`, `MergeCheckCache` are not exported from
`../scripts/build-data`.

- [ ] **Step 3: Implement the candidate/cache logic**

In `scripts/build-data.ts`, add `MergedInto` to the type import from
`../lib/types` (so it reads
`import type { MergedInto, MetaStats, ProcessedBill } from "../lib/types";`),
and add this block after the `processBill` function:

```ts
const MERGE_CHECK_BILL_TYPE = "法律案";
const MERGE_CHECK_STAGE_ORDERS = [1, 2, 3, 4];
const MERGE_CHECK_MIN_AGE_DAYS = 90;
const MERGE_CHECK_RECHECK_DAYS = 30;

export interface MergeCheckEntry {
  checkedAt: string;
  mergedInto: MergedInto | null;
}

export type MergeCheckCache = Record<string, MergeCheckEntry>;

function isoDateDaysAgo(today: Date, days: number): string {
  const d = new Date(today);
  d.setDate(d.getDate() - days);
  return d.toISOString().slice(0, 10);
}

export function selectMergeCandidates(
  bills: ProcessedBill[],
  today: Date = new Date()
): ProcessedBill[] {
  const cutoff = isoDateDaysAgo(today, MERGE_CHECK_MIN_AGE_DAYS);
  return bills.filter(
    (bill) =>
      bill.billType === MERGE_CHECK_BILL_TYPE &&
      MERGE_CHECK_STAGE_ORDERS.includes(bill.stageOrder) &&
      bill.lastUpdateDate !== null &&
      bill.lastUpdateDate < cutoff
  );
}

export function shouldFetchMergeCheck(
  entry: MergeCheckEntry | undefined,
  today: Date = new Date()
): boolean {
  if (!entry) return true;
  if (entry.mergedInto !== null) return false;
  const cutoff = isoDateDaysAgo(today, MERGE_CHECK_RECHECK_DAYS);
  return entry.checkedAt < cutoff;
}
```

- [ ] **Step 4: Run tests to verify they pass**

Run: `npx vitest run tests/build-data.test.ts`
Expected: PASS (all tests in the file).

- [ ] **Step 5: Commit**

```bash
git add scripts/build-data.ts tests/build-data.test.ts
git commit -m "feat: add merge-check candidate selection and cache-decision logic"
```

---

### Task 4: Add `checkMergeStatus` and `applyMergeChecks`

These call `fetchBillDetail` (mocked via `vi.stubGlobal("fetch", ...)` in
tests, following the existing pattern in `tests/ly-api.test.ts`).

**Files:**
- Modify: `scripts/build-data.ts`
- Test: `tests/build-data.test.ts`

- [ ] **Step 1: Write the failing tests**

Add `afterEach` and `vi` to the vitest import at the top of
`tests/build-data.test.ts` (currently
`import { describe, expect, it } from "vitest";`):

```ts
import { afterEach, describe, expect, it, vi } from "vitest";
```

Update the value import from `../scripts/build-data` added in Task 3 to
also include `checkMergeStatus` and `applyMergeChecks`:

```ts
import {
  buildMeta,
  findUnmatchedProposers,
  processBill,
  selectMergeCandidates,
  shouldFetchMergeCheck,
  checkMergeStatus,
  applyMergeChecks,
} from "../scripts/build-data";
```

Then add:

```ts
describe("checkMergeStatus", () => {
  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it("returns the related bill with the highest stageOrder above the candidate's", async () => {
    const bill = makeBill({ id: "1", stageOrder: 4 });
    const report = makeBill({
      id: "2",
      name: "審查報告",
      stageOrder: 5,
      stageLabel: "三讀通過",
    });
    const billsById = new Map([
      ["1", bill],
      ["2", report],
    ]);

    const response = {
      error: false,
      data: {
        議案編號: "1",
        關連議案: [{ 議案編號: "2", 議案名稱: "審查報告" }],
        url: "u",
      },
    };
    vi.stubGlobal(
      "fetch",
      vi.fn().mockResolvedValue({ ok: true, json: async () => response })
    );

    const result = await checkMergeStatus(bill, billsById);

    expect(result).toEqual({
      id: "2",
      name: "審查報告",
      stageLabel: "三讀通過",
      stageOrder: 5,
    });
  });

  it("returns null when no related bill has progressed further", async () => {
    const bill = makeBill({ id: "1", stageOrder: 4 });
    const other = makeBill({ id: "3", stageOrder: 2 });
    const billsById = new Map([
      ["1", bill],
      ["3", other],
    ]);

    const response = {
      error: false,
      data: {
        議案編號: "1",
        關連議案: [{ 議案編號: "3", 議案名稱: "其他案" }],
        url: "u",
      },
    };
    vi.stubGlobal(
      "fetch",
      vi.fn().mockResolvedValue({ ok: true, json: async () => response })
    );

    const result = await checkMergeStatus(bill, billsById);

    expect(result).toBeNull();
  });

  it("returns null when the detail fetch fails", async () => {
    const bill = makeBill({ id: "1", stageOrder: 4 });
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue({ ok: false, status: 500 }));

    const result = await checkMergeStatus(bill, new Map());

    expect(result).toBeNull();
  });
});

describe("applyMergeChecks", () => {
  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it("skips bills with a cached confirmed merge without fetching", async () => {
    const bill = makeBill({
      id: "1",
      billType: "法律案",
      stageOrder: 2,
      lastUpdateDate: "2026-01-01",
    });
    const cache: MergeCheckCache = {
      "1": {
        checkedAt: "2020-01-01",
        mergedInto: { id: "9", name: "報告", stageLabel: "三讀通過", stageOrder: 5 },
      },
    };
    const fetchMock = vi.fn();
    vi.stubGlobal("fetch", fetchMock);

    const result = await applyMergeChecks([bill], cache, new Date("2026-06-12T00:00:00Z"));

    expect(fetchMock).not.toHaveBeenCalled();
    expect(bill.mergedInto).toEqual(cache["1"].mergedInto);
    expect(result["1"]).toEqual(cache["1"]);
  });

  it("fetches and caches a new candidate with no prior entry", async () => {
    const bill = makeBill({
      id: "1",
      billType: "法律案",
      stageOrder: 2,
      lastUpdateDate: "2026-01-01",
    });
    const response = {
      error: false,
      data: { 議案編號: "1", 關連議案: [], url: "u" },
    };
    vi.stubGlobal(
      "fetch",
      vi.fn().mockResolvedValue({ ok: true, json: async () => response })
    );

    const result = await applyMergeChecks([bill], {}, new Date("2026-06-12T00:00:00Z"));

    expect(bill.mergedInto).toBeNull();
    expect(result["1"]).toEqual({ checkedAt: "2026-06-12", mergedInto: null });
  });
});
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `npx vitest run tests/build-data.test.ts`
Expected: FAIL — `checkMergeStatus` and `applyMergeChecks` are not exported
from `../scripts/build-data`.

- [ ] **Step 3: Implement `checkMergeStatus` and `applyMergeChecks`**

Add `fetchBillDetail` to the import from `../lib/ly-api` (currently
`fetchAllBills, fetchAllLegislators, type RawBill, type RawLegislator`), so
it reads:

```ts
import {
  fetchAllBills,
  fetchAllLegislators,
  fetchBillDetail,
  type RawBill,
  type RawLegislator,
} from "../lib/ly-api";
```

Append after `shouldFetchMergeCheck`:

```ts
export async function checkMergeStatus(
  bill: ProcessedBill,
  billsById: Map<string, ProcessedBill>
): Promise<MergedInto | null> {
  const detail = await fetchBillDetail(bill.id).catch(() => null);
  if (!detail?.關連議案) return null;

  let best: MergedInto | null = null;
  for (const related of detail.關連議案) {
    const candidate = billsById.get(related.議案編號);
    if (!candidate) continue;
    if (candidate.stageOrder <= bill.stageOrder) continue;
    if (!best || candidate.stageOrder > best.stageOrder) {
      best = {
        id: candidate.id,
        name: candidate.name,
        stageLabel: candidate.stageLabel,
        stageOrder: candidate.stageOrder,
      };
    }
  }
  return best;
}

export async function applyMergeChecks(
  bills: ProcessedBill[],
  cache: MergeCheckCache,
  today: Date = new Date()
): Promise<MergeCheckCache> {
  const billsById = new Map(bills.map((b) => [b.id, b]));
  const candidates = selectMergeCandidates(bills, today);
  const todayStr = today.toISOString().slice(0, 10);
  const nextCache: MergeCheckCache = { ...cache };

  for (const bill of candidates) {
    const existing = nextCache[bill.id];
    if (!shouldFetchMergeCheck(existing, today)) {
      bill.mergedInto = existing?.mergedInto ?? null;
      continue;
    }
    const mergedInto = await checkMergeStatus(bill, billsById);
    nextCache[bill.id] = { checkedAt: todayStr, mergedInto };
    bill.mergedInto = mergedInto;
  }

  return nextCache;
}
```

- [ ] **Step 4: Run tests to verify they pass**

Run: `npx vitest run tests/build-data.test.ts`
Expected: PASS (all tests in the file).

- [ ] **Step 5: Commit**

```bash
git add scripts/build-data.ts tests/build-data.test.ts
git commit -m "feat: add checkMergeStatus and applyMergeChecks for merge detection"
```

---

### Task 5: Wire merge checks into `main()`, seed the cache file, update the workflow

**Files:**
- Modify: `scripts/build-data.ts` (the `main` function)
- Create: `data/merge-checks.json`
- Modify: `.github/workflows/refresh-data.yml:29`

- [ ] **Step 1: Seed the cache file**

Create `data/merge-checks.json` with:

```json
{}
```

- [ ] **Step 2: Update imports in `scripts/build-data.ts`**

Change the `fs` import (currently `import { mkdirSync, writeFileSync } from "fs";`) to:

```ts
import { existsSync, mkdirSync, readFileSync, writeFileSync } from "fs";
```

- [ ] **Step 3: Update `main()` to run the merge-check pass**

Replace the body of `main()` from the `const bills = ...` line through the
final `writeFileSync` calls with:

```ts
  const bills = rawBills.map((bill) => processBill(bill, legislators));
  const meta = buildMeta(bills);
  const unmatched = findUnmatchedProposers(rawBills, legislators);

  const publicDataDir = path.join(process.cwd(), "public", "data");
  const dataDir = path.join(process.cwd(), "data");
  mkdirSync(publicDataDir, { recursive: true });
  mkdirSync(dataDir, { recursive: true });

  const mergeChecksPath = path.join(dataDir, "merge-checks.json");
  const existingMergeCache: MergeCheckCache = existsSync(mergeChecksPath)
    ? JSON.parse(readFileSync(mergeChecksPath, "utf-8"))
    : {};
  const mergeCandidates = selectMergeCandidates(bills);
  console.log(`Checking ${mergeCandidates.length} possibly-merged bills...`);
  const updatedMergeCache = await applyMergeChecks(bills, existingMergeCache);

  writeFileSync(path.join(publicDataDir, "bills.json"), JSON.stringify(bills));
  writeFileSync(
    path.join(publicDataDir, "meta.json"),
    JSON.stringify(meta, null, 2)
  );
  writeFileSync(
    path.join(dataDir, "unmatched-proposers.json"),
    JSON.stringify(unmatched, null, 2)
  );
  writeFileSync(mergeChecksPath, JSON.stringify(updatedMergeCache, null, 2));

  console.log(`Wrote ${bills.length} bills to public/data/bills.json`);
  console.log(`Unmatched proposers: ${unmatched.length}`);
```

- [ ] **Step 4: Update the GitHub Actions workflow**

In `.github/workflows/refresh-data.yml`, the `git add` line (line 29)
currently reads:

```yaml
          git add public/data/bills.json public/data/meta.json data/unmatched-proposers.json
```

Change it to:

```yaml
          git add public/data/bills.json public/data/meta.json data/unmatched-proposers.json data/merge-checks.json
```

- [ ] **Step 5: Run the full test suite**

Run: `npm test`
Expected: PASS (all test files).

- [ ] **Step 6: Commit**

```bash
git add scripts/build-data.ts data/merge-checks.json .github/workflows/refresh-data.yml
git commit -m "feat: run merge-check pass in build-data and persist results"
```

---

### Task 6: Add sort-mode toggle to `app/bills/page.tsx`

Replaces the "依等待天數排序" checkbox (which, due to `daysPending` being
always `null` before this change, was a no-op) with a two-mode toggle:
"最新動態優先" (default — sort by `lastUpdateDate` descending) and
"等待最久優先" (sort by `daysPending` descending, `null` last).

**Files:**
- Modify: `app/bills/page.tsx`

- [ ] **Step 1: Replace the `sortByDays` state**

Replace:

```tsx
  const [search, setSearch] = useState("");
  const [sortByDays, setSortByDays] = useState(true);
```

with:

```tsx
  const [search, setSearch] = useState("");
  const [sortMode, setSortMode] = useState<"recent" | "waiting">("recent");
```

- [ ] **Step 2: Replace the sort logic in the `filtered` memo**

Replace:

```tsx
    if (sortByDays) {
      result = [...result].sort((a, b) => (b.daysPending ?? -1) - (a.daysPending ?? -1));
    }
    return result;
  }, [bills, selectedCategories, selectedParties, selectedStages, selectedBillTypes, search, sortByDays]);
```

with:

```tsx
    result = [...result].sort((a, b) => {
      if (sortMode === "waiting") {
        return (b.daysPending ?? -1) - (a.daysPending ?? -1);
      }
      return (b.lastUpdateDate ?? "").localeCompare(a.lastUpdateDate ?? "");
    });
    return result;
  }, [bills, selectedCategories, selectedParties, selectedStages, selectedBillTypes, search, sortMode]);
```

- [ ] **Step 3: Replace the checkbox with a select**

Replace:

```tsx
          <label className="flex items-center gap-1 text-sm">
            <input
              type="checkbox"
              checked={sortByDays}
              onChange={(e) => setSortByDays(e.target.checked)}
            />
            依等待天數排序
          </label>
```

with:

```tsx
          <label className="flex items-center gap-1 text-sm">
            排序：
            <select
              value={sortMode}
              onChange={(e) => setSortMode(e.target.value as "recent" | "waiting")}
              className="rounded border px-1.5 py-1 text-sm"
            >
              <option value="recent">最新動態優先</option>
              <option value="waiting">等待最久優先</option>
            </select>
          </label>
```

- [ ] **Step 4: Run the full test suite**

Run: `npm test`
Expected: PASS (no test directly covers this client component, but this
confirms nothing else broke).

- [ ] **Step 5: Commit**

```bash
git add app/bills/page.tsx
git commit -m "feat: default bills list sort to most recent activity"
```

---

### Task 7: Show merge badge on `components/BillCard.tsx`

**Files:**
- Modify: `components/BillCard.tsx`

- [ ] **Step 1: Add the merge badge**

Replace:

```tsx
      <div className="font-medium">{bill.name}</div>
      <div className="mt-1 text-sm text-gray-500">
        目前階段：{bill.stageLabel}
        {bill.daysPending !== null && <> · 已等待 {bill.daysPending} 天</>}
      </div>
    </Link>
  );
}
```

with:

```tsx
      <div className="font-medium">{bill.name}</div>
      <div className="mt-1 text-sm text-gray-500">
        目前階段：{bill.stageLabel}
        {bill.daysPending !== null && <> · 已等待 {bill.daysPending} 天</>}
      </div>
      {bill.mergedInto && (
        <div className="mt-1 text-xs text-gray-500">
          已併案處理 · 相關報告：{bill.mergedInto.stageLabel}
        </div>
      )}
    </Link>
  );
}
```

- [ ] **Step 2: Run the full test suite**

Run: `npm test`
Expected: PASS.

- [ ] **Step 3: Commit**

```bash
git add components/BillCard.tsx
git commit -m "feat: show merge badge on bill cards"
```

---

### Task 8: Update `app/bills/[id]/page.tsx` — real 提案日期, hide unknown 已等待, merge banner

**Files:**
- Modify: `app/bills/[id]/page.tsx`

- [ ] **Step 1: Show real 提案日期 from the detail fetch**

Replace:

```tsx
        <div>
          <div className="text-xs text-gray-500">提案日期</div>
          <div className="mt-1 text-sm">{bill.proposalDate ?? "未提供"}</div>
        </div>
```

with:

```tsx
        <div>
          <div className="text-xs text-gray-500">提案日期</div>
          <div className="mt-1 text-sm">{detail?.提案日期 ?? "未提供"}</div>
        </div>
```

- [ ] **Step 2: Hide the "已等待" stat when `daysPending` is null**

Replace:

```tsx
        <div>
          <div className="text-xs text-gray-500">已等待</div>
          <div className="mt-1 text-sm font-bold text-red-700">
            {bill.daysPending !== null ? `${bill.daysPending} 天` : "未知"}
          </div>
        </div>
```

with:

```tsx
        {bill.daysPending !== null && (
          <div>
            <div className="text-xs text-gray-500">已等待</div>
            <div className="mt-1 text-sm font-bold text-red-700">
              {bill.daysPending} 天
            </div>
          </div>
        )}
```

- [ ] **Step 3: Add a merge banner**

Replace:

```tsx
      <div className="rounded border bg-white p-4">
        <div className="mb-2 text-xs text-gray-500">審議時間軸</div>
```

with:

```tsx
      {bill.mergedInto && (
        <div className="rounded border border-yellow-300 bg-yellow-50 p-4 text-sm">
          此案已與其他議案併入委員會審查報告，該報告目前進度為「{bill.mergedInto.stageLabel}」。
          <Link href={`/bills/${bill.mergedInto.id}`} className="ml-1 underline">
            查看審查報告 →
          </Link>
        </div>
      )}

      <div className="rounded border bg-white p-4">
        <div className="mb-2 text-xs text-gray-500">審議時間軸</div>
```

- [ ] **Step 4: Run the full test suite**

Run: `npm test`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add app/bills/[id]/page.tsx
git commit -m "feat: show real proposal date, hide unknown waiting days, add merge banner"
```

---

### Task 9: Final verification

**Files:** none (verification only)

- [ ] **Step 1: Run the full test suite**

Run: `npm test`
Expected: PASS (all test files: `build-data`, `categories`, `ly-api`,
`parties`, `smoke`, `stage`).

- [ ] **Step 2: Run lint**

Run: `npm run lint`
Expected: No errors.

- [ ] **Step 3: Run the production build**

Run: `npm run build`
Expected: Build succeeds. `/bills/[id]` has no `generateStaticParams`, so
this does not make network calls — it only type-checks and builds the
static shell, `/`, and `/bills`.

- [ ] **Step 4: Spot-check the merge-detection example from the design doc**

The design doc identifies bill `202110061230000` (保險法 amendment, stuck
in "審查完畢" since 2025-05-20) as merged into report bill `203110129350000`
(已三讀通過). Confirm the logic would catch it:

Run:
```bash
node -e '
const bills = JSON.parse(require("fs").readFileSync("public/data/bills.json","utf-8"));
const bill = bills.find(b => b.id === "202110061230000");
console.log({ stageOrder: bill.stageOrder, billType: bill.billType, lastUpdateDate: bill.lastUpdateDate });
'
```

Expected output shows `billType: "法律案"`, `stageOrder: 4`, and
`lastUpdateDate` older than 90 days before today — confirming it would be
selected as a merge-check candidate by `selectMergeCandidates` on the next
`npm run build:data` run (which requires live network access and is not run
as part of this plan).

- [ ] **Step 5: No commit needed**

This task is verification-only. If any step fails, fix the issue in the
relevant earlier task's files, re-run the failing command, and commit the
fix with a `fix:` message before proceeding.
