# Taiwan Legislative Yuan Bills Tracker — v1 Design

## Purpose

Legislative Yuan bill data is technically public but practically inaccessible to most
people. This project builds a web app that lets anyone browse current-term (11th term)
bills, see what topic they relate to (勞工權益, 租客權益, 兒少福利, etc.), which party
proposed them, what stage of the legislative process they're at, and how long they've
been sitting there — without needing to navigate the official 議事網.

v1 scope is the **core bill browser + filters + a lightweight stats overview**. Party
comparison dashboards, "who's blocking what" analysis, and news links with media-bias
labels are explicitly out of scope for v1 but the data model is designed not to block
them later (see "Future Extensions").

## Data Source

[`v2.ly.govapi.tw`](https://v2.ly.govapi.tw) — the public Legislative Yuan open-data API.

- `GET /bills?屆=11&...` — paginated bill records. Term 11 (since Feb 2024) has ~21,500
  records across all 議案類別 (法律案, 預(決)算案, 法人預(決)算案, etc.). v1 includes
  **all bill types** (per user decision), with a 議案類別 filter to narrow to 法律案
  where topic categorization is richest.
- `GET /bills/{id}` — full bill detail: 案由, 說明, 對照表 (law diff), 議案流程
  (process/stage history with dates), 連署人 (co-signers), attachments.
- `GET /legislators?屆=11` — legislator roster with 黨籍/黨團, used to map proposer
  names to parties.

Each bill record's key raw fields: `議案編號`, `議案名稱`, `議案類別`, `提案來源`
(委員提案 / 政府提案 / 審查報告), `提案單位/提案委員`, `提案人` (proposer names),
`連署人` (co-signer names), `議案狀態`, `議案流程`, `法律編號`/`法律編號:str`,
`提案日期`, `最新進度日期`.

Note: the API returns one record per `議案編號`, including committee review reports
(`提案來源 = 審查報告`) as their own entries. v1 treats every record as its own
browsable item, labeled with its actual `提案來源` — it does not attempt to merge a
bill with its related review-report records. De-duplicating/linking related 議案編號
into a single "bill story" is a candidate v2 refinement.

## Architecture

**Stack**: Next.js (App Router) + TypeScript + Tailwind CSS, deployed on Vercel from a
GitHub repo.

**Data pipeline** (`scripts/build-data.ts`, run via `tsx`):

1. Fetch all term-11 bills (paginated) and all term-11 legislators from
   `v2.ly.govapi.tw`.
2. For each bill, derive and attach:
   - **Proposing party** (see "Party Mapping" below).
   - **Category tags** — rule-based mapping from `法律編號`/title keywords to topic
     categories (see "Category Taxonomy"). Multiple tags allowed; no match →
     `其他/未分類`.
   - **Current stage** — normalize the `議案流程` history into a standard stage
     sequence (一讀 → 委員會審查 → 黨團協商 → 二讀/排入院會 → 三讀 → 完成). Unmappable
     raw statuses fall into an `其他程序` bucket but retain the raw label for display.
   - **Days pending** — `today - 提案日期` (or earliest `議案流程` date if `提案日期`
     is missing).
   - **Co-signer party breakdown** — counts of co-signers per party, for cross-party
     visibility on the detail page.
3. Write:
   - `public/data/bills.json` — lean summary records (all fields needed for browse,
     filter, search, and stats; excludes long-form text like 案由/說明/對照表).
   - `public/data/meta.json` — last-updated timestamp + precomputed stats (counts by
     party / category / stage) for the homepage overview.

**Refresh mechanism**: `.github/workflows/refresh-data.yml` runs the pipeline script on
a daily schedule, commits updated `public/data/*.json` if changed (using
`GITHUB_TOKEN` with `contents: write`), which triggers Vercel's auto-redeploy via its
GitHub integration. The script exits non-zero on API errors without writing partial
data, so a failed run never overwrites good data with broken/empty output.

**Runtime data flow**:
- Browse page (`/bills`) fetches `bills.json` once client-side and performs all
  filtering, sorting, and search client-side (dataset is ~8-10MB, acceptable as a
  single cached fetch for a civic-data site of this scope).
- Detail page (`/bills/[id]`) is a dynamic route: it looks up the bill's summary from
  the same dataset, and additionally does a live, ISR-cached
  (`export const revalidate = 86400`) fetch to `v2.ly.govapi.tw/bills/{id}` for the
  full 案由/說明/對照表 text and attachment links — keeping the committed dataset lean.

## Category Taxonomy

Defined in `lib/categories.ts` as a list of `{ id, label, lawIds: string[], keywords:
string[] }` entries, easy to extend over time. Initial categories:

勞工權益 · 居住/租客權益 · 兒少福利 · 性別平等 · 長照/老人福利 · 健保/醫療 · 教育 ·
環境/能源 · 動物保護 · 交通安全 · 財政/稅制 · 司法/人權 · 兩岸/國防/外交 · 農漁業 ·
政府治理/選制 · 其他/未分類

Matching: a bill matches a category if its `法律編號` is in that category's `lawIds`,
or its `議案名稱` contains one of its `keywords`. A bill may match multiple categories.
No match → `其他/未分類` (still browsable/filterable, never hidden).

A separate **議案類別 filter** (法律案 / 預(決)算案 / 人事案 / 其他) lets users narrow
to law-amendment bills specifically, since topic tags are richest there.

## Party Mapping

Defined in `lib/parties.ts`:

- **Colors**: 民主進步黨 (DPP) → green, 中國國民黨 (KMT) → blue, 台灣民眾黨 (TPP) →
  teal, 時代力量/無黨籍/other → gray.
- **Proposing party for 委員提案**: look up the primary proposer's 黨籍/黨團 from the
  term-11 legislator roster.
- **Legislator overrides** (`legislatorOverrides` map): for cases where official 黨籍
  doesn't reflect actual caucus alignment (e.g. 高金素梅 is officially 無黨籍 but
  caucuses with KMT) — override entries take precedence over the roster lookup.
- **政府提案 (government proposals)**: colored using a configurable
  `currentRulingParty` value (currently `"民主進步黨"`), applied to **all** 政府提案
  regardless of which government body (行政院/考試院/司法院/監察院/總統府) submitted
  it. This is a single config value to update if the ruling party changes after a
  future election.
- **Co-signer breakdown** on the detail page uses the same roster + overrides, shown as
  small per-party counts (e.g. 民進黨×17 · 國民黨×2 · 無黨籍×1).
- **Unmatched proposer names** (no roster match, not in overrides) → gray "未知" badge;
  the pipeline writes `data/unmatched-proposers.json` listing these for maintainers to
  add to `legislatorOverrides`.

## Pages & UI

- **`/` Homepage**: brief intro, plus a stats overview (cards/strip) showing bill
  counts by party, by category, and by stage, sourced from `meta.json`, with a
  "資料更新時間" timestamp. Category cards link into `/bills?category=...`.
- **`/bills` Browse page** (layout confirmed: sidebar + card list):
  - Left sidebar with checkboxes: 類別 (topic), 提案政黨, 進度階段, 議案類別.
  - Search box for bill title.
  - Sort by 等待天數 (days pending).
  - Card list: each card shows category tag(s), party badge, bill name, current stage,
    and "已等待 N 天". All filtering/sorting/search happens client-side against the
    loaded dataset, no page reload.
- **`/bills/[id]` Detail page**:
  - Category tags, bill title + 案由 summary.
  - Proposer + party badge, proposal date, current stage, days pending.
  - Cross-party co-signer breakdown.
  - Stage timeline — horizontal step indicator through the normalized stage sequence,
    highlighting the current/stuck stage in red, with raw dates per stage.
  - Links to the original LY documents (議事網 page, 關係文書 PDF/DOC).
  - Placeholder section "相關新聞（規劃中）" — reserved for the future news/bias-label
    feature, shown with explanatory text for now.

## Testing

Vitest unit tests covering:
- Category-matching rules (given a 法律編號/title, returns expected tags).
- Party lookup + override resolution (including the 高金素梅-style override case and
  政府提案 → ruling-party mapping).
- Stage normalization (raw `議案流程` entries → normalized stage sequence + current
  stage).
- Days-pending calculation.

## Error Handling

- Pipeline script validates API responses and retries transient failures; on
  persistent failure it exits non-zero without writing to `public/data/`, so the
  GitHub Action skips the commit and the site keeps serving last-known-good data.
- Frontend shows the `meta.json` last-updated timestamp; if `bills.json` fails to load
  client-side, the browse page shows an error state with a retry option.
- Unmatched proposers/categories degrade gracefully (gray "未知" badge / 其他/未分類)
  rather than breaking rendering.

## Repo Structure

```
legislative_yuan/
├── app/
│   ├── page.tsx                 # homepage — stats overview
│   ├── bills/
│   │   ├── page.tsx              # browse page (client-side filter/search)
│   │   └── [id]/page.tsx         # detail page
│   └── layout.tsx, globals.css
├── components/
│   ├── BillCard.tsx, FilterSidebar.tsx, PartyBadge.tsx,
│   ├── CategoryTag.tsx, StageTimeline.tsx, StatsOverview.tsx
├── lib/
│   ├── categories.ts             # topic taxonomy + matching rules
│   ├── parties.ts                 # colors, ruling-party config, legislator overrides
│   ├── stage.ts                    # stage normalization
│   └── types.ts
├── scripts/
│   └── build-data.ts              # data pipeline (fetch + categorize + write JSON)
├── public/data/
│   ├── bills.json
│   └── meta.json
├── .github/workflows/refresh-data.yml   # scheduled daily refresh
├── tests/                          # vitest unit tests
├── package.json, tsconfig.json, tailwind.config.ts, next.config.js
└── README.md
```

## Deployment

- New GitHub repo, imported directly into Vercel (zero-config Next.js detection).
- No environment variables or API keys required for v1 — the LY API is public.
- The GitHub Actions refresh workflow commits updated `public/data/*.json` on a
  schedule; pushes to the default branch trigger Vercel's auto-redeploy.

## Future Extensions (v2+)

Not built in v1, but the data model (per-bill party, co-signer breakdown, category
tags, normalized stage history) is designed to support these without rework:

- Full party-comparison dashboard (proposal/pass/block rates by party × category).
- "Who's blocking what" — surfacing bills stuck longest in 黨團協商/committee, and
  whose objections appear in negotiation records.
- News links per bill, each tagged with the outlet's commonly-perceived political
  leaning (偏綠/偏藍/偏白/中立/etc.), with a disclaimer about the subjectivity of such
  labels.
- Full-text search across 案由/說明.
- Bilingual (English) UI.
