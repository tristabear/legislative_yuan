# Bills List: Sort Order, Waiting Days, and Merge Detection

## Background

The bills list (`/bills`) currently defaults to sorting by `daysPending`
descending, and shows "已等待 X 天" on each card. Two problems:

1. **`daysPending` is always `null`.** `processBill` computes it from
   `bill.提案日期`, but the bulk `/bills` API endpoint never returns a
   `提案日期` field (confirmed against a live response) — only the per-bill
   detail endpoint (`/bills/{id}`) has it. So every one of the 21,554 bills
   has `proposalDate: null` and `daysPending: null`, and the "依等待天數排序"
   default sort is effectively a no-op.

2. **"Stuck" bills may not actually be stuck.** Bills go through
   "併案審查" (combined committee review): several related bills get bundled
   into a new committee report bill (`source: "審查報告"`, billType `法律案`,
   id prefix `203...`), linked via `關連議案` on the original bills' detail
   endpoint. The report bill can reach 三讀通過 (passed) while the original
   bill's own `議案狀態`/`stageLabel` still shows "審查完畢" (looks stuck).
   Confirmed example: bill `202110061230000` (審查完畢 since 2025-05-20) has
   a `關連議案` entry pointing to report bill `203110129350000`, which is
   already at `三讀通過` (stageOrder 5) as of 2025-06-03.

What *is* reliably present in the bulk data is `最新進度日期`
(`lastUpdateDate`, ~99.4% coverage) — the date of the bill's most recent
status change.

## Goals

1. Default sort = most recently active bills first.
2. Redefine "已等待" as "days since the last status change"
   (`today - lastUpdateDate`), eliminating the `未知` placeholder for nearly
   all bills.
3. Detect and surface cases where a "stuck" 法律案 has actually been
   resolved via 併案審查 merger into a report bill that has progressed
   further.

## Non-goals

- Fetching true `提案日期` for all 21,554 bills to support a "newest
  proposed" sort (would require ~21.5k extra detail fetches in the daily
  refresh — too costly).
- Merge detection for non-法律案 bill types, or for bills that have only
  recently gone quiet (<90 days).

## Part 1: Data model & sort changes

- **`lib/types.ts`**:
  - Remove `proposalDate` (always `null`, dead field).
  - Add `mergedInto: { id: string; name: string; stageLabel: string; stageOrder: number } | null`.
- **`lib/stage.ts`**:
  - `daysPending(date, now)` keeps its current signature/shape but is now
    called with `lastUpdateDate` instead of `proposalDate`.
  - `tests/stage.test.ts` updated for the new semantics, including a case
    asserting `null` for finished stages.
- **`scripts/build-data.ts`** (`processBill`):
  - `daysPending` = `today - lastUpdateDate`.
  - Set to `null` when `stageOrder === 0` (已結案) or `stageOrder === 5`
    (三讀通過) — finished bills show no day count.
- **`app/bills/page.tsx`**:
  - Replace the single "依等待天數排序" checkbox with a sort-mode toggle:
    - **最新動態優先** (default) — sort by `lastUpdateDate` descending.
    - **等待最久優先** — sort by `daysPending` descending, `null` values
      sort last.
- **`components/BillCard.tsx`**:
  - In-progress bills: keep "已等待 X 天" (red), now using the redefined
    value.
  - Finished bills: stage label only, no day count.

## Part 2: Merge detection (併案處理)

### Cache file

New `data/merge-checks.json` (committed to repo, alongside
`unmatched-proposers.json`), keyed by bill ID:

```json
{
  "202110061230000": {
    "checkedAt": "2026-06-12",
    "mergedInto": {
      "id": "203110129350000",
      "name": "報告併案審查...",
      "stageOrder": 5,
      "stageLabel": "三讀通過"
    }
  },
  "202110058870000": {
    "checkedAt": "2026-06-12",
    "mergedInto": null
  }
}
```

### Candidate selection

In `build-data.ts`, after the main `bills` array is built, select candidates
where:

- `stageOrder` is 1–4 (first-reading through second-reading; excludes
  closed=0 and third-reading=5), AND
- `billType === "法律案"`, AND
- `lastUpdateDate` is more than 90 days before the build date.

(Estimated ~4,700 candidates as of 2026-06-12.)

### Per-candidate logic

Build an `id -> ProcessedBill` map from the bills array first. For each
candidate, consult `data/merge-checks.json`:

- If a cached entry has `mergedInto !== null` → reuse it, skip fetching
  (a confirmed merge is permanent).
- Else if `checkedAt` is within the last 30 days → skip fetching (avoid
  re-polling bills that aren't merged yet).
- Else → fetch `/bills/{id}`, read `關連議案`. For each related bill ID,
  look it up in the `id -> ProcessedBill` map. If any related bill has a
  `stageOrder` higher than the candidate's, pick the one with the highest
  `stageOrder` as `mergedInto`. Write `{ checkedAt: <today>, mergedInto }`
  back to the cache (whether or not a merge was found).

After processing, apply each candidate's resulting `mergedInto` (from the
updated cache) onto its `ProcessedBill` record.

### Workflow changes

`.github/workflows/refresh-data.yml`: add `data/merge-checks.json` to the
`git add` step so the cache persists across scheduled runs.

### Rollout

The first run after this ships will process ~4,700 candidates (one-time
catch-up cost; no GH Actions timeout is configured, default 6h limit is
ample). Subsequent daily runs only process newly-stuck bills plus ~1/30th of
the previously-unmerged pool (periodic re-checks). Recommend running
`npm run build:data` locally once before merging to warm the cache so the PR
ships with results already populated — not required.

## Part 3: UI presentation

- **`components/BillCard.tsx`**: if `bill.mergedInto !== null`, show a small
  informational badge under the stage line, e.g.
  `已併案處理 · 相關報告：三讀通過` (not a link — the card itself links to
  this bill's own detail page).
- **`app/bills/[id]/page.tsx`**:
  - Same badge, but as a link to `/bills/{mergedInto.id}` (the combined
    committee-report bill).
  - One-line explanation: "此案已與其他議案併入委員會審查報告，該報告目前進度為「{stageLabel}」。"
- **Bonus**: the detail page already calls `fetchBillDetail(id)`, which
  *does* return real `提案日期` on the detail endpoint. Add
  `提案日期?: string` to the `BillDetail` interface in `lib/ly-api.ts` and
  display it on the detail page (e.g., "提案日期：2026-06-12") when present.
  Not used for bulk sorting — informational only.

## Testing

- `tests/stage.test.ts`: update `daysPending` tests for "days since last
  update" semantics; add a case for finished-stage bills returning `null`.
- `tests/build-data.test.ts`: extract candidate-selection and
  cache-decision logic (skip-if-merged, skip-if-recently-checked-and-unmerged)
  into small pure functions, unit tested against fixture data — no real
  network calls in tests.
