# Taiwan Legislative Yuan Bills Tracker Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Build a Next.js web app that lets anyone browse 11th-term Legislative Yuan
bills, filter by topic category and proposing party, see the current legislative stage
and how long each bill has been pending, with a homepage stats overview — deployable to
Vercel from GitHub with a scheduled data-refresh pipeline.

**Architecture:** A standalone data pipeline script (`scripts/build-data.ts`) fetches
bills + legislators from the public `v2.ly.govapi.tw` API, derives each bill's
proposing party, topic category tags, and normalized legislative stage using shared
logic in `lib/`, and writes `public/data/bills.json` + `public/data/meta.json`. The
Next.js app reads this static data (homepage stats server-side, browse page
client-side) and additionally fetches live per-bill detail (timeline, co-signers) for
the detail page with ISR caching. A GitHub Actions workflow re-runs the pipeline daily.

**Tech Stack:** Next.js 15 (App Router) + React 19 + TypeScript, Tailwind CSS 3,
Vitest for unit tests, `tsx` for running the pipeline script, GitHub Actions for
scheduled data refresh, Vercel for deployment.

**Reference spec:** `docs/superpowers/specs/2026-06-12-bills-tracker-design.md`

---

## Key API facts (already verified — no further research needed)

- `GET https://v2.ly.govapi.tw/bills?屆=11&limit=100&page=N` → `{ total, total_page,
  page, limit, bills: [...] }`. Max useful `limit` is 100. Term 11 has ~21,500 bills
  total across ~216 pages.
- Each bill (list endpoint) has: `議案編號`, `議案名稱`, `議案類別`, `提案來源`
  (委員提案 / 政府提案 / 審查報告 / 請願案), `提案單位/提案委員`, `提案人`
  (`string[] | null`), `議案狀態`, `提案日期`, `最新進度日期`, `法律編號:str`
  (`string[]`, law names as Chinese text), `url`.
- `GET https://v2.ly.govapi.tw/bills/{議案編號}` → `{ data: { ...same fields...,
  案由, 說明, 連署人 (string[]), 議案流程 (array of {狀態, 日期: string[],
  "院會/委員會"?}), 相關附件 (array of {名稱, 網址}) } }`.
- `GET https://v2.ly.govapi.tw/legislators?屆=11&limit=200` → `{ total, legislators:
  [...] }`. Each legislator has `委員姓名`, `黨籍` (民主進步黨/中國國民黨/台灣民眾黨/
  無黨籍), `黨團` (民主進步黨/中國國民黨/台灣民眾黨, absent for 無黨籍 unless they
  caucus with a party — e.g. 高金素梅 has `黨籍="無黨籍"` but `黨團="中國國民黨"`).
- Observed `議案狀態` values: `排入院會`, `排入院會(討論事項)`, `交付審查`, `交付協商`,
  `逕付二讀(交付協商)`, `委員會抽出逕付二讀(交付協商)`, `審查完畢`,
  `審查完畢(逾審查期限)`, `審查完畢(三讀)`, `三讀`, `撤案`, `交付查照`, `交付處理`,
  `函復請願人`, `復請查照`.
- Observed `議案類別` values: `法律案`, `中央政府總預算案`, `法人預(決)算案`,
  `預(決) 算決議案、定期報告`, `同意權案`, `請願案`, `臨時提案`, `一般提案`,
  `行政命令(層級)`, `院內單位來文`.
- For `提案來源 = 政府提案`, `提案人` is `null` and `提案單位/提案委員` holds the
  submitting agency name (e.g. `內政部`).

---

## File Structure

```
legislative_yuan/
├── package.json, tsconfig.json, next.config.mjs
├── tailwind.config.ts, postcss.config.mjs
├── vitest.config.ts
├── .gitignore
├── .github/workflows/refresh-data.yml
├── README.md
├── app/
│   ├── layout.tsx, globals.css
│   ├── page.tsx                  # homepage — stats overview
│   └── bills/
│       ├── page.tsx               # browse page (client-side filter/search)
│       └── [id]/page.tsx          # detail page
├── components/
│   ├── PartyBadge.tsx
│   ├── CategoryTag.tsx
│   ├── BillCard.tsx
│   ├── FilterSidebar.tsx
│   └── StageTimeline.tsx
├── lib/
│   ├── types.ts
│   ├── parties.ts
│   ├── categories.ts
│   ├── stage.ts
│   └── ly-api.ts
├── scripts/
│   └── build-data.ts
├── data/
│   └── unmatched-proposers.json   # generated
├── public/data/
│   ├── bills.json                  # generated
│   └── meta.json                   # generated
└── tests/
    ├── smoke.test.ts
    ├── parties.test.ts
    ├── categories.test.ts
    ├── stage.test.ts
    ├── ly-api.test.ts
    └── build-data.test.ts
```

---

## Task 1: Project Scaffolding (Next.js + TypeScript + Tailwind + Vitest)

**Files:**
- Create: `package.json`
- Create: `tsconfig.json`
- Create: `next.config.mjs`
- Create: `tailwind.config.ts`
- Create: `postcss.config.mjs`
- Create: `vitest.config.ts`
- Create: `app/globals.css`
- Create: `app/layout.tsx`
- Create: `app/page.tsx`
- Create: `.gitignore`
- Create: `tests/smoke.test.ts`

- [ ] **Step 1: Create `package.json`**

```json
{
  "name": "legislative-yuan-tracker",
  "version": "0.1.0",
  "private": true,
  "scripts": {
    "dev": "next dev",
    "build": "next build",
    "start": "next start",
    "lint": "eslint .",
    "test": "vitest run",
    "build:data": "tsx scripts/build-data.ts"
  },
  "dependencies": {
    "next": "^15.1.0",
    "react": "^19.0.0",
    "react-dom": "^19.0.0"
  },
  "devDependencies": {
    "@types/node": "^22.10.0",
    "@types/react": "^19.0.0",
    "@types/react-dom": "^19.0.0",
    "typescript": "^5.7.0",
    "tailwindcss": "^3.4.0",
    "postcss": "^8.4.0",
    "autoprefixer": "^10.4.0",
    "vitest": "^2.1.0",
    "tsx": "^4.19.0",
    "eslint": "^9.0.0",
    "eslint-config-next": "^15.1.0"
  }
}
```

- [ ] **Step 2: Create `tsconfig.json`**

```json
{
  "compilerOptions": {
    "target": "ES2020",
    "lib": ["dom", "dom.iterable", "esnext"],
    "allowJs": false,
    "skipLibCheck": true,
    "strict": true,
    "noEmit": true,
    "esModuleInterop": true,
    "module": "esnext",
    "moduleResolution": "bundler",
    "resolveJsonModule": true,
    "isolatedModules": true,
    "jsx": "preserve",
    "incremental": true,
    "plugins": [{ "name": "next" }],
    "paths": {
      "@/*": ["./*"]
    }
  },
  "include": ["next-env.d.ts", "**/*.ts", "**/*.tsx", ".next/types/**/*.ts"],
  "exclude": ["node_modules"]
}
```

- [ ] **Step 3: Create `next.config.mjs`**

```js
/** @type {import('next').NextConfig} */
const nextConfig = {};

export default nextConfig;
```

- [ ] **Step 4: Create `tailwind.config.ts` and `postcss.config.mjs`**

`tailwind.config.ts`:
```ts
import type { Config } from "tailwindcss";

export default {
  content: ["./app/**/*.{ts,tsx}", "./components/**/*.{ts,tsx}"],
  theme: {
    extend: {},
  },
  plugins: [],
} satisfies Config;
```

`postcss.config.mjs`:
```js
export default {
  plugins: {
    tailwindcss: {},
    autoprefixer: {},
  },
};
```

- [ ] **Step 5: Create `app/globals.css`**

```css
@tailwind base;
@tailwind components;
@tailwind utilities;
```

- [ ] **Step 6: Create `app/layout.tsx`**

```tsx
import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "立法院議案追蹤",
  description: "追蹤立法院議案進度、提案政黨與跨黨派支持狀況",
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="zh-TW">
      <body className="min-h-screen bg-gray-50 text-gray-900">
        <header className="border-b bg-white px-4 py-3">
          <a href="/" className="text-lg font-bold">
            立法院議案追蹤
          </a>
        </header>
        <main className="mx-auto max-w-6xl px-4 py-6">{children}</main>
      </body>
    </html>
  );
}
```

- [ ] **Step 7: Create a minimal placeholder `app/page.tsx`**

This will be replaced with the real homepage in Task 11. For now it just needs to make
the build succeed.

```tsx
export default function HomePage() {
  return <p>立法院議案追蹤 — 建置中</p>;
}
```

- [ ] **Step 8: Create `vitest.config.ts`**

```ts
import { defineConfig } from "vitest/config";

export default defineConfig({
  test: {
    environment: "node",
    include: ["tests/**/*.test.ts"],
  },
});
```

- [ ] **Step 9: Create `.gitignore`**

```
node_modules
.next
.superpowers
*.tsbuildinfo
next-env.d.ts
```

- [ ] **Step 10: Create a smoke test `tests/smoke.test.ts`**

```ts
import { describe, expect, it } from "vitest";

describe("smoke", () => {
  it("runs", () => {
    expect(1 + 1).toBe(2);
  });
});
```

- [ ] **Step 11: Install dependencies**

Run: `npm install`
Expected: completes without errors, creates `node_modules/` and `package-lock.json`.

- [ ] **Step 12: Run the smoke test**

Run: `npx vitest run`
Expected: `tests/smoke.test.ts` passes (1 test).

- [ ] **Step 13: Run the build**

Run: `npm run build`
Expected: Next.js build succeeds and reports the `/` route.

- [ ] **Step 14: Commit**

```bash
git add package.json package-lock.json tsconfig.json next.config.mjs \
  tailwind.config.ts postcss.config.mjs vitest.config.ts \
  app/globals.css app/layout.tsx app/page.tsx .gitignore tests/smoke.test.ts
git commit -m "chore: scaffold Next.js + TypeScript + Tailwind + Vitest project"
```

---

## Task 2: Shared Types

**Files:**
- Create: `lib/types.ts`

- [ ] **Step 1: Create `lib/types.ts`**

```ts
export interface CategoryDef {
  id: string;
  label: string;
  lawNames: string[];
  titleKeywords: string[];
}

export interface StageDef {
  id: string;
  label: string;
  order: number;
  rawStatuses: string[];
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
  proposalDate: string | null;
  lastUpdateDate: string | null;
  daysPending: number | null;
  url: string;
}

export interface MetaStats {
  generatedAt: string;
  totalBills: number;
  byParty: Record<string, number>;
  byCategory: Record<string, number>;
  byStage: Record<string, number>;
}
```

- [ ] **Step 2: Commit**

```bash
git add lib/types.ts
git commit -m "feat: add shared TypeScript types for bills, categories, and stages"
```

---

## Task 3: Party Mapping (`lib/parties.ts`)

**Files:**
- Create: `lib/parties.ts`
- Test: `tests/parties.test.ts`

This module maps proposers to display parties and colors. 政府提案 (government
proposals from any body) are colored as `CURRENT_RULING_PARTY`. A
`legislatorOverrides` map lets us override 黨團/黨籍 lookups for specific legislators
(e.g. 高金素梅, who is officially 無黨籍 but caucuses with 中國國民黨).

- [ ] **Step 1: Write the failing tests**

Create `tests/parties.test.ts`:

```ts
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
```

- [ ] **Step 2: Run the tests to verify they fail**

Run: `npx vitest run tests/parties.test.ts`
Expected: FAIL — `../lib/parties` and `../lib/ly-api` do not exist yet.

- [ ] **Step 3: Create a minimal `lib/ly-api.ts` stub with just the type needed**

(The full implementation comes in Task 6 — for now we only need the `RawLegislator`
type so `parties.ts` and its tests can compile.)

```ts
export interface RawLegislator {
  屆: number;
  委員姓名: string;
  黨籍: string;
  黨團?: string;
}
```

- [ ] **Step 4: Create `lib/parties.ts`**

```ts
import type { RawLegislator } from "./ly-api";

export const PARTY_COLORS: Record<string, string> = {
  民主進步黨: "#1b9e3f",
  中國國民黨: "#1b4f9e",
  台灣民眾黨: "#0f9d8c",
  其他: "#6b7280",
};

export const DEFAULT_PARTY = "其他";

/** Updated to the current administration's party when control changes. */
export const CURRENT_RULING_PARTY = "民主進步黨";

/**
 * Overrides for legislators whose official 黨籍/黨團 doesn't reflect their
 * actual caucus alignment, or as a safeguard if 黨團 data is missing.
 */
export const legislatorOverrides: Record<string, string> = {
  高金素梅: "中國國民黨",
};

export function partyColor(party: string): string {
  return PARTY_COLORS[party] ?? PARTY_COLORS[DEFAULT_PARTY];
}

export function partyForLegislator(
  name: string,
  legislators: RawLegislator[]
): string {
  if (legislatorOverrides[name]) return legislatorOverrides[name];

  const match = legislators.find((l) => l.委員姓名 === name);
  if (!match) return DEFAULT_PARTY;
  if (match.黨團) return match.黨團;
  if (match.黨籍 && match.黨籍 !== "無黨籍") return match.黨籍;
  return DEFAULT_PARTY;
}

export function partyForBill(params: {
  source: string;
  proposers: string[];
  legislators: RawLegislator[];
}): string {
  const { source, proposers, legislators } = params;
  if (source === "政府提案") return CURRENT_RULING_PARTY;
  if (proposers.length === 0) return DEFAULT_PARTY;
  return partyForLegislator(proposers[0], legislators);
}
```

- [ ] **Step 5: Run the tests to verify they pass**

Run: `npx vitest run tests/parties.test.ts`
Expected: PASS — 8 tests.

- [ ] **Step 6: Commit**

```bash
git add lib/parties.ts lib/ly-api.ts tests/parties.test.ts
git commit -m "feat: add party mapping with ruling-party and legislator overrides"
```

---

## Task 4: Category Taxonomy (`lib/categories.ts`)

**Files:**
- Create: `lib/categories.ts`
- Test: `tests/categories.test.ts`

Categories are matched against a bill's `法律編號:str` (law name strings) and its
`議案名稱` (title). A bill can match multiple categories; no match falls back to
`uncategorized` (其他/未分類).

- [ ] **Step 1: Write the failing tests**

Create `tests/categories.test.ts`:

```ts
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
```

- [ ] **Step 2: Run the tests to verify they fail**

Run: `npx vitest run tests/categories.test.ts`
Expected: FAIL — `../lib/categories` does not exist yet.

- [ ] **Step 3: Create `lib/categories.ts`**

```ts
import type { CategoryDef } from "./types";

export const UNCATEGORIZED = "uncategorized";
export const UNCATEGORIZED_LABEL = "其他/未分類";

export const CATEGORIES: CategoryDef[] = [
  {
    id: "labor",
    label: "勞工權益",
    lawNames: [
      "勞動基準法",
      "勞工保險條例",
      "職業安全衛生法",
      "就業服務法",
      "勞資爭議處理法",
      "工會法",
      "大量解僱勞工保護法",
      "職業災害勞工保護法",
      "勞工退休金條例",
    ],
    titleKeywords: ["勞工", "勞動", "職災", "工會"],
  },
  {
    id: "housing",
    label: "居住權益",
    lawNames: [
      "住宅租賃市場發展及管理條例",
      "住宅法",
      "公寓大廈管理條例",
      "平均地權條例",
      "國民住宅條例",
    ],
    titleKeywords: ["租賃", "房東", "囤房"],
  },
  {
    id: "child-welfare",
    label: "兒少福利",
    lawNames: [
      "兒童及少年福利與權益保障法",
      "兒童及少年性剝削防制條例",
      "幼兒教育及照顧法",
      "兒童權利公約施行法",
    ],
    titleKeywords: ["兒童", "少年", "幼兒", "托育"],
  },
  {
    id: "gender-equality",
    label: "性別平等",
    lawNames: [
      "性別平等工作法",
      "性別平等教育法",
      "性騷擾防治法",
      "家庭暴力防治法",
      "跟蹤騷擾防制法",
    ],
    titleKeywords: ["性別平等", "性騷擾", "家暴", "跟蹤騷擾"],
  },
  {
    id: "elder-care",
    label: "長照/老人福利",
    lawNames: [
      "老人福利法",
      "長期照顧服務法",
      "長期照顧服務機構法人條例",
    ],
    titleKeywords: ["長照", "老人", "高齡"],
  },
  {
    id: "health",
    label: "健保/醫療",
    lawNames: [
      "全民健康保險法",
      "醫療法",
      "藥事法",
      "醫師法",
      "護理人員法",
      "精神衛生法",
    ],
    titleKeywords: ["健保", "醫療", "醫院", "藥品"],
  },
  {
    id: "education",
    label: "教育",
    lawNames: [
      "教育基本法",
      "國民教育法",
      "高等教育法",
      "私立學校法",
      "師資培育法",
      "國民體育法",
      "學位授予法",
    ],
    titleKeywords: ["教育", "學校", "師資", "大學"],
  },
  {
    id: "environment",
    label: "環境/能源",
    lawNames: [
      "環境基本法",
      "氣候變遷因應法",
      "電業法",
      "再生能源發展條例",
      "空氣污染防制法",
      "廢棄物清理法",
      "水污染防治法",
      "國家公園法",
    ],
    titleKeywords: ["環境", "空污", "氣候", "能源", "碳排"],
  },
  {
    id: "animal-welfare",
    label: "動物保護",
    lawNames: ["動物保護法", "野生動物保育法", "動物用藥品管理法"],
    titleKeywords: ["動物", "流浪犬", "野生動物"],
  },
  {
    id: "transport-safety",
    label: "交通安全",
    lawNames: [
      "道路交通管理處罰條例",
      "道路交通安全規則",
      "公路法",
      "鐵路法",
      "大眾捷運法",
    ],
    titleKeywords: ["交通", "道路", "行人", "酒駕"],
  },
  {
    id: "fiscal-tax",
    label: "財政/稅制",
    lawNames: [
      "所得稅法",
      "稅捐稽徵法",
      "加值型及非加值型營業稅法",
      "遺產及贈與稅法",
      "房屋稅條例",
      "土地稅法",
      "關稅法",
    ],
    titleKeywords: ["稅法", "關稅", "財政"],
  },
  {
    id: "judicial-rights",
    label: "司法/人權",
    lawNames: [
      "刑法",
      "刑事訴訟法",
      "民法",
      "民事訴訟法",
      "公民與政治權利國際公約及經濟社會文化權利國際公約施行法",
      "國家賠償法",
      "個人資料保護法",
      "法律扶助法",
    ],
    titleKeywords: ["刑法", "人權", "司法", "個資"],
  },
  {
    id: "cross-strait-defense",
    label: "兩岸/國防/外交",
    lawNames: [
      "臺灣地區與大陸地區人民關係條例",
      "國防法",
      "兵役法",
      "全民防衛動員準備法",
      "國家機密保護法",
      "護照條例",
      "入出國及移民法",
    ],
    titleKeywords: ["兩岸", "大陸地區", "國防", "兵役", "移民"],
  },
  {
    id: "agriculture",
    label: "農漁業",
    lawNames: [
      "農業發展條例",
      "漁業法",
      "農會法",
      "漁會法",
      "農產品市場交易法",
      "植物防疫檢疫法",
    ],
    titleKeywords: ["農業", "漁業", "農會", "漁會"],
  },
  {
    id: "governance-electoral",
    label: "政府治理/選制",
    lawNames: [
      "公務人員任用法",
      "公職人員選舉罷免法",
      "政黨法",
      "公民投票法",
      "地方制度法",
      "公務員服務法",
      "政治獻金法",
    ],
    titleKeywords: ["選舉", "罷免", "公投", "政黨", "地方制度"],
  },
];

export function categorizeBill(billName: string, lawNames: string[]): string[] {
  const matches = new Set<string>();
  for (const cat of CATEGORIES) {
    const lawMatch = lawNames.some((ln) => cat.lawNames.includes(ln));
    const keywordMatch = cat.titleKeywords.some((kw) => billName.includes(kw));
    if (lawMatch || keywordMatch) {
      matches.add(cat.id);
    }
  }
  return matches.size > 0 ? Array.from(matches) : [UNCATEGORIZED];
}

export function categoryLabel(id: string): string {
  if (id === UNCATEGORIZED) return UNCATEGORIZED_LABEL;
  return CATEGORIES.find((c) => c.id === id)?.label ?? UNCATEGORIZED_LABEL;
}
```

- [ ] **Step 4: Run the tests to verify they pass**

Run: `npx vitest run tests/categories.test.ts`
Expected: PASS — 6 tests.

- [ ] **Step 5: Commit**

```bash
git add lib/categories.ts tests/categories.test.ts
git commit -m "feat: add rule-based topic category taxonomy and matcher"
```

---

## Task 5: Stage Normalization & Days Pending (`lib/stage.ts`)

**Files:**
- Create: `lib/stage.ts`
- Test: `tests/stage.test.ts`

Maps the raw `議案狀態` string (and each `議案流程` entry's `狀態`) to a normalized
stage with a display order, and computes days-pending from `提案日期`.

- [ ] **Step 1: Write the failing tests**

Create `tests/stage.test.ts`:

```ts
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
```

- [ ] **Step 2: Run the tests to verify they fail**

Run: `npx vitest run tests/stage.test.ts`
Expected: FAIL — `../lib/stage` does not exist yet.

- [ ] **Step 3: Create `lib/stage.ts`**

```ts
import type { StageDef } from "./types";

export const STAGES: StageDef[] = [
  {
    id: "closed",
    label: "已結案",
    order: 0,
    rawStatuses: ["撤案", "交付查照", "交付處理", "函復請願人", "復請查照"],
  },
  {
    id: "first-reading",
    label: "一讀/排入院會",
    order: 1,
    rawStatuses: ["排入院會"],
  },
  {
    id: "committee-review",
    label: "委員會審查",
    order: 2,
    rawStatuses: ["交付審查"],
  },
  {
    id: "negotiation",
    label: "黨團協商",
    order: 3,
    rawStatuses: [
      "交付協商",
      "逕付二讀(交付協商)",
      "委員會抽出逕付二讀(交付協商)",
    ],
  },
  {
    id: "second-reading",
    label: "二讀/院會討論",
    order: 4,
    rawStatuses: ["排入院會(討論事項)", "審查完畢", "審查完畢(逾審查期限)"],
  },
  {
    id: "third-reading",
    label: "三讀通過",
    order: 5,
    rawStatuses: ["三讀", "審查完畢(三讀)"],
  },
];

export function normalizeStage(rawStatus: string): StageDef {
  for (const stage of STAGES) {
    if (stage.rawStatuses.includes(rawStatus)) return stage;
  }
  return {
    id: "other",
    label: `其他程序（${rawStatus}）`,
    order: 0,
    rawStatuses: [],
  };
}

export function daysPending(
  proposalDate: string | null,
  now: Date = new Date()
): number | null {
  if (!proposalDate) return null;
  const proposed = new Date(proposalDate);
  if (Number.isNaN(proposed.getTime())) return null;
  const diffMs = now.getTime() - proposed.getTime();
  return Math.max(0, Math.floor(diffMs / (1000 * 60 * 60 * 24)));
}
```

- [ ] **Step 4: Run the tests to verify they pass**

Run: `npx vitest run tests/stage.test.ts`
Expected: PASS — 13 tests.

- [ ] **Step 5: Commit**

```bash
git add lib/stage.ts tests/stage.test.ts
git commit -m "feat: add legislative stage normalization and days-pending calc"
```

---

## Task 6: LY Open Data API Client (`lib/ly-api.ts`)

**Files:**
- Modify: `lib/ly-api.ts` (currently just has `RawLegislator` from Task 3)
- Test: `tests/ly-api.test.ts`

Adds `fetchAllBills` (paginates through `/bills` until `total_page` is reached),
`fetchAllLegislators`, and `fetchBillDetail` (for the bill detail page). Tests mock
`global.fetch`.

- [ ] **Step 1: Write the failing tests**

Create `tests/ly-api.test.ts`:

```ts
import { afterEach, describe, expect, it, vi } from "vitest";
import { fetchAllBills, fetchAllLegislators, fetchBillDetail } from "../lib/ly-api";

afterEach(() => {
  vi.unstubAllGlobals();
});

describe("fetchAllBills", () => {
  it("paginates until total_page is reached", async () => {
    const page1 = {
      total: 3,
      total_page: 2,
      page: 1,
      limit: 2,
      bills: [{ 議案編號: "1" }, { 議案編號: "2" }],
    };
    const page2 = {
      total: 3,
      total_page: 2,
      page: 2,
      limit: 2,
      bills: [{ 議案編號: "3" }],
    };

    const fetchMock = vi
      .fn()
      .mockResolvedValueOnce({ ok: true, json: async () => page1 })
      .mockResolvedValueOnce({ ok: true, json: async () => page2 });
    vi.stubGlobal("fetch", fetchMock);

    const bills = await fetchAllBills(11, 2);

    expect(bills.map((b) => b.議案編號)).toEqual(["1", "2", "3"]);
    expect(fetchMock).toHaveBeenCalledTimes(2);

    const firstUrl = new URL(fetchMock.mock.calls[0][0] as string);
    expect(firstUrl.searchParams.get("屆")).toBe("11");
    expect(firstUrl.searchParams.get("limit")).toBe("2");
    expect(firstUrl.searchParams.get("page")).toBe("1");
  });

  it("throws on a non-OK response", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn().mockResolvedValue({ ok: false, status: 500 })
    );
    await expect(fetchAllBills(11)).rejects.toThrow(/500/);
  });
});

describe("fetchAllLegislators", () => {
  it("returns the legislators array", async () => {
    const response = {
      total: 1,
      legislators: [{ 屆: 11, 委員姓名: "王委員", 黨籍: "民主進步黨" }],
    };
    vi.stubGlobal(
      "fetch",
      vi.fn().mockResolvedValue({ ok: true, json: async () => response })
    );
    const legislators = await fetchAllLegislators(11);
    expect(legislators).toEqual(response.legislators);
  });
});

describe("fetchBillDetail", () => {
  it("returns the data field from the response", async () => {
    const response = { error: false, data: { 議案編號: "123", 案由: "測試" } };
    vi.stubGlobal(
      "fetch",
      vi.fn().mockResolvedValue({ ok: true, json: async () => response })
    );
    const detail = await fetchBillDetail("123");
    expect(detail.議案編號).toBe("123");
    expect(detail.案由).toBe("測試");
  });
});
```

- [ ] **Step 2: Run the tests to verify they fail**

Run: `npx vitest run tests/ly-api.test.ts`
Expected: FAIL — `fetchAllBills`, `fetchAllLegislators`, `fetchBillDetail` are not
exported yet.

- [ ] **Step 3: Replace `lib/ly-api.ts` with the full implementation**

```ts
const BASE_URL = "https://v2.ly.govapi.tw";

export interface RawBill {
  屆: number;
  議案編號: string;
  議案名稱: string;
  議案類別: string;
  提案來源: string;
  "提案單位/提案委員": string;
  提案人: string[] | null;
  議案狀態: string;
  提案日期?: string;
  最新進度日期?: string;
  "法律編號:str"?: string[];
  url: string;
}

export interface RawLegislator {
  屆: number;
  委員姓名: string;
  黨籍: string;
  黨團?: string;
}

export interface BillProcessEntry {
  狀態: string;
  日期: string[];
  "院會/委員會"?: string;
}

export interface BillAttachment {
  名稱: string;
  網址: string;
}

export interface BillDetail {
  議案編號: string;
  案由?: string;
  說明?: string;
  連署人?: string[];
  議案流程?: BillProcessEntry[];
  相關附件?: BillAttachment[];
  url: string;
}

interface BillsResponse {
  total: number;
  total_page: number;
  page: number;
  limit: number;
  bills: RawBill[];
}

interface LegislatorsResponse {
  total: number;
  legislators: RawLegislator[];
}

interface BillDetailResponse {
  error: boolean;
  data: BillDetail;
}

export async function fetchAllBills(
  term: number,
  pageSize = 100
): Promise<RawBill[]> {
  const all: RawBill[] = [];
  let page = 1;

  while (true) {
    const params = new URLSearchParams({
      屆: String(term),
      limit: String(pageSize),
      page: String(page),
    });
    const res = await fetch(`${BASE_URL}/bills?${params.toString()}`);
    if (!res.ok) {
      throw new Error(`LY API error ${res.status} on bills page ${page}`);
    }
    const data = (await res.json()) as BillsResponse;
    all.push(...data.bills);

    if (page >= data.total_page || data.bills.length === 0) break;
    page += 1;
  }

  return all;
}

export async function fetchAllLegislators(term: number): Promise<RawLegislator[]> {
  const params = new URLSearchParams({ 屆: String(term), limit: "200" });
  const res = await fetch(`${BASE_URL}/legislators?${params.toString()}`);
  if (!res.ok) {
    throw new Error(`LY API error ${res.status} on legislators`);
  }
  const data = (await res.json()) as LegislatorsResponse;
  return data.legislators;
}

export async function fetchBillDetail(id: string): Promise<BillDetail> {
  const res = await fetch(`${BASE_URL}/bills/${id}`);
  if (!res.ok) {
    throw new Error(`LY API error ${res.status} on bill detail ${id}`);
  }
  const data = (await res.json()) as BillDetailResponse;
  return data.data;
}
```

- [ ] **Step 4: Run the tests to verify they pass**

Run: `npx vitest run tests/ly-api.test.ts`
Expected: PASS — 4 tests.

- [ ] **Step 5: Run the full test suite so far**

Run: `npx vitest run`
Expected: PASS — all tests across `tests/smoke.test.ts`, `tests/parties.test.ts`,
`tests/categories.test.ts`, `tests/stage.test.ts`, `tests/ly-api.test.ts`.

- [ ] **Step 6: Commit**

```bash
git add lib/ly-api.ts tests/ly-api.test.ts
git commit -m "feat: add LY open data API client with pagination"
```

---

## Task 7: Data Pipeline Script (`scripts/build-data.ts`)

**Files:**
- Create: `scripts/build-data.ts`
- Test: `tests/build-data.test.ts`

The pipeline has two parts: pure transform functions (`processBill`, `buildMeta`,
`findUnmatchedProposers`) that are unit-tested with fixture data, and a `main()`
orchestration function that fetches from the API and writes files — guarded so it only
runs when the script is executed directly, not when imported by tests.

- [ ] **Step 1: Write the failing tests**

Create `tests/build-data.test.ts`:

```ts
import { describe, expect, it } from "vitest";
import {
  buildMeta,
  findUnmatchedProposers,
  processBill,
} from "../scripts/build-data";
import type { RawBill, RawLegislator } from "../lib/ly-api";

const legislators: RawLegislator[] = [
  { 屆: 11, 委員姓名: "王委員", 黨籍: "民主進步黨", 黨團: "民主進步黨" },
  { 屆: 11, 委員姓名: "林委員", 黨籍: "中國國民黨", 黨團: "中國國民黨" },
];

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
      提案日期: "2026-01-01",
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
    expect(result.proposalDate).toBe("2026-01-01");
    expect(result.daysPending).not.toBeNull();
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
    expect(result.proposalDate).toBeNull();
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
          提案日期: "2026-01-01",
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
          提案日期: "2025-01-01",
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
```

- [ ] **Step 2: Run the tests to verify they fail**

Run: `npx vitest run tests/build-data.test.ts`
Expected: FAIL — `../scripts/build-data` does not exist yet.

- [ ] **Step 3: Create `scripts/build-data.ts`**

```ts
import { mkdirSync, writeFileSync } from "fs";
import path from "path";
import {
  fetchAllBills,
  fetchAllLegislators,
  type RawBill,
  type RawLegislator,
} from "../lib/ly-api";
import { partyForBill } from "../lib/parties";
import { categorizeBill } from "../lib/categories";
import { daysPending, normalizeStage } from "../lib/stage";
import type { MetaStats, ProcessedBill } from "../lib/types";

const TERM = 11;

export function processBill(
  bill: RawBill,
  legislators: RawLegislator[]
): ProcessedBill {
  const proposers = bill.提案人 ?? [];
  const lawNames = bill["法律編號:str"] ?? [];
  const stage = normalizeStage(bill.議案狀態);
  const proposalDate = bill.提案日期 ?? null;

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
    proposalDate,
    lastUpdateDate: bill.最新進度日期 ?? null,
    daysPending: daysPending(proposalDate),
    url: bill.url,
  };
}

export function buildMeta(bills: ProcessedBill[]): MetaStats {
  const byParty: Record<string, number> = {};
  const byCategory: Record<string, number> = {};
  const byStage: Record<string, number> = {};

  for (const bill of bills) {
    byParty[bill.party] = (byParty[bill.party] ?? 0) + 1;
    byStage[bill.stageLabel] = (byStage[bill.stageLabel] ?? 0) + 1;
    for (const category of bill.categories) {
      byCategory[category] = (byCategory[category] ?? 0) + 1;
    }
  }

  return {
    generatedAt: new Date().toISOString(),
    totalBills: bills.length,
    byParty,
    byCategory,
    byStage,
  };
}

export function findUnmatchedProposers(
  bills: RawBill[],
  legislators: RawLegislator[]
): string[] {
  const knownNames = new Set(legislators.map((l) => l.委員姓名));
  const unmatched = new Set<string>();

  for (const bill of bills) {
    if (bill.提案來源 !== "委員提案") continue;
    for (const proposer of bill.提案人 ?? []) {
      if (!knownNames.has(proposer)) unmatched.add(proposer);
    }
  }

  return Array.from(unmatched).sort();
}

async function main() {
  console.log(`Fetching term ${TERM} legislators...`);
  const legislators = await fetchAllLegislators(TERM);
  console.log(`Fetched ${legislators.length} legislators`);

  console.log(`Fetching term ${TERM} bills (this takes a few minutes)...`);
  const rawBills = await fetchAllBills(TERM);
  console.log(`Fetched ${rawBills.length} bills`);

  const bills = rawBills.map((bill) => processBill(bill, legislators));
  const meta = buildMeta(bills);
  const unmatched = findUnmatchedProposers(rawBills, legislators);

  const publicDataDir = path.join(process.cwd(), "public", "data");
  const dataDir = path.join(process.cwd(), "data");
  mkdirSync(publicDataDir, { recursive: true });
  mkdirSync(dataDir, { recursive: true });

  writeFileSync(path.join(publicDataDir, "bills.json"), JSON.stringify(bills));
  writeFileSync(
    path.join(publicDataDir, "meta.json"),
    JSON.stringify(meta, null, 2)
  );
  writeFileSync(
    path.join(dataDir, "unmatched-proposers.json"),
    JSON.stringify(unmatched, null, 2)
  );

  console.log(`Wrote ${bills.length} bills to public/data/bills.json`);
  console.log(`Unmatched proposers: ${unmatched.length}`);
}

if (import.meta.url === `file://${process.argv[1]}`) {
  main().catch((err) => {
    console.error(err);
    process.exit(1);
  });
}
```

- [ ] **Step 4: Run the tests to verify they pass**

Run: `npx vitest run tests/build-data.test.ts`
Expected: PASS — 4 tests.

- [ ] **Step 5: Run the full test suite**

Run: `npx vitest run`
Expected: PASS — all tests across all `tests/*.test.ts` files.

- [ ] **Step 6: Commit**

```bash
git add scripts/build-data.ts tests/build-data.test.ts
git commit -m "feat: add data pipeline to build processed bills.json and meta.json"
```

---

## Task 8: Generate Real Data

**Files:**
- Generate: `public/data/bills.json`
- Generate: `public/data/meta.json`
- Generate: `data/unmatched-proposers.json`

This runs the pipeline against the live API. It takes a few minutes (~216 pages of
bills at 100/page, plus one legislators request).

- [ ] **Step 1: Run the pipeline**

Run: `npm run build:data`
Expected: Logs showing legislator count (~123), bill count (~21,000+), and a final
"Wrote N bills..." / "Unmatched proposers: M" line. `public/data/bills.json`,
`public/data/meta.json`, and `data/unmatched-proposers.json` are created.

- [ ] **Step 2: Spot-check the output**

Run: `node -e "const b = require('./public/data/bills.json'); console.log(b.length, b[0])"`
Expected: Prints the total bill count and a sample `ProcessedBill` object with
`party`, `categories`, `stageLabel`, `daysPending`, etc. all populated.

Run: `cat public/data/meta.json`
Expected: JSON with `generatedAt`, `totalBills`, and non-empty `byParty`, `byCategory`,
`byStage` maps.

- [ ] **Step 3: Review unmatched proposers**

Run: `cat data/unmatched-proposers.json`
Expected: A (possibly empty) JSON array of legislator names that didn't match the
term-11 roster. If non-empty, these are likely legislators from other terms who
co-sign term-11 bills, or name-formatting mismatches (e.g. with/without English
aboriginal names) — note them for a future `legislatorOverrides` addition, but don't
block on it for v1 since unmatched proposers just fall back to the `其他` party badge.

- [ ] **Step 4: Commit the generated data**

```bash
git add public/data/bills.json public/data/meta.json data/unmatched-proposers.json
git commit -m "data: generate initial term-11 bills dataset"
```

---

## Task 9: Homepage with Stats Overview

**Files:**
- Create: `components/PartyBadge.tsx`
- Modify: `app/page.tsx` (replace placeholder from Task 1)

- [ ] **Step 1: Create `components/PartyBadge.tsx`**

```tsx
import { partyColor } from "@/lib/parties";

export function PartyBadge({ party, label }: { party: string; label?: string }) {
  return (
    <span
      className="inline-block rounded px-2 py-0.5 text-xs font-medium text-white"
      style={{ backgroundColor: partyColor(party) }}
    >
      {label ?? party}
    </span>
  );
}
```

- [ ] **Step 2: Replace `app/page.tsx` with the homepage**

```tsx
import fs from "fs";
import path from "path";
import Link from "next/link";
import type { MetaStats } from "@/lib/types";
import { CATEGORIES, UNCATEGORIZED, categoryLabel } from "@/lib/categories";
import { PartyBadge } from "@/components/PartyBadge";

function loadMeta(): MetaStats {
  const file = path.join(process.cwd(), "public", "data", "meta.json");
  return JSON.parse(fs.readFileSync(file, "utf-8"));
}

export default function HomePage() {
  const meta = loadMeta();

  return (
    <div className="space-y-8">
      <section>
        <h1 className="text-2xl font-bold">立法院議案追蹤</h1>
        <p className="mt-2 text-gray-600">
          追蹤本屆（第11屆）立法院議案進度、提案政黨與跨黨派支持狀況。資料來源：
          <a
            className="underline"
            href="https://v2.ly.govapi.tw"
            target="_blank"
            rel="noreferrer"
          >
            立法院開放資料 API
          </a>
          。最後更新：{new Date(meta.generatedAt).toLocaleString("zh-TW")}
        </p>
        <Link
          href="/bills"
          className="mt-4 inline-block rounded bg-gray-900 px-4 py-2 text-white"
        >
          瀏覽所有議案 →
        </Link>
      </section>

      <section>
        <h2 className="mb-2 text-lg font-semibold">提案政黨分布</h2>
        <div className="flex flex-wrap gap-2">
          {Object.entries(meta.byParty).map(([party, count]) => (
            <div
              key={party}
              className="flex items-center gap-2 rounded border bg-white px-3 py-2"
            >
              <PartyBadge party={party} />
              <span>{count} 件</span>
            </div>
          ))}
        </div>
      </section>

      <section>
        <h2 className="mb-2 text-lg font-semibold">議案類別分布</h2>
        <div className="grid grid-cols-2 gap-2 sm:grid-cols-3 md:grid-cols-4">
          {CATEGORIES.map((cat) => (
            <Link
              key={cat.id}
              href={`/bills?category=${cat.id}`}
              className="rounded border bg-white p-3 hover:border-gray-400"
            >
              <div className="font-medium">{cat.label}</div>
              <div className="text-sm text-gray-500">
                {meta.byCategory[cat.id] ?? 0} 件
              </div>
            </Link>
          ))}
          <Link
            href={`/bills?category=${UNCATEGORIZED}`}
            className="rounded border bg-white p-3 hover:border-gray-400"
          >
            <div className="font-medium">{categoryLabel(UNCATEGORIZED)}</div>
            <div className="text-sm text-gray-500">
              {meta.byCategory[UNCATEGORIZED] ?? 0} 件
            </div>
          </Link>
        </div>
      </section>

      <section>
        <h2 className="mb-2 text-lg font-semibold">議案階段分布</h2>
        <div className="flex flex-wrap gap-2">
          {Object.entries(meta.byStage).map(([stage, count]) => (
            <div key={stage} className="rounded border bg-white px-3 py-2 text-sm">
              {stage}：{count} 件
            </div>
          ))}
        </div>
      </section>
    </div>
  );
}
```

- [ ] **Step 3: Build and smoke-check the homepage**

Run: `npm run build`
Expected: build succeeds, `/` listed as a static/server route.

Run the dev server in the background, then check the rendered HTML:

```bash
npm run dev &
sleep 3
curl -s http://localhost:3000 | grep -o "立法院議案追蹤"
curl -s http://localhost:3000 | grep -o "提案政黨分布"
kill %1
```

Expected: both `grep` commands print a match.

- [ ] **Step 4: Commit**

```bash
git add components/PartyBadge.tsx app/page.tsx
git commit -m "feat: add homepage with party/category/stage stats overview"
```

---

## Task 10: Browse Page with Filters

**Files:**
- Create: `components/CategoryTag.tsx`
- Create: `components/BillCard.tsx`
- Create: `components/FilterSidebar.tsx`
- Create: `app/bills/page.tsx`

- [ ] **Step 1: Create `components/CategoryTag.tsx`**

```tsx
import { categoryLabel } from "@/lib/categories";

export function CategoryTag({ categoryId }: { categoryId: string }) {
  return (
    <span className="inline-block rounded bg-gray-100 px-2 py-0.5 text-xs text-gray-700">
      {categoryLabel(categoryId)}
    </span>
  );
}
```

- [ ] **Step 2: Create `components/BillCard.tsx`**

```tsx
import Link from "next/link";
import type { ProcessedBill } from "@/lib/types";
import { PartyBadge } from "@/components/PartyBadge";
import { CategoryTag } from "@/components/CategoryTag";

export function BillCard({ bill }: { bill: ProcessedBill }) {
  return (
    <Link
      href={`/bills/${bill.id}`}
      className="block rounded border bg-white p-3 hover:border-gray-400"
    >
      <div className="mb-1 flex flex-wrap gap-1">
        <PartyBadge party={bill.party} />
        {bill.categories.map((cat) => (
          <CategoryTag key={cat} categoryId={cat} />
        ))}
      </div>
      <div className="font-medium">{bill.name}</div>
      <div className="mt-1 text-sm text-gray-500">
        目前階段：{bill.stageLabel}
        {bill.daysPending !== null && <> · 已等待 {bill.daysPending} 天</>}
      </div>
    </Link>
  );
}
```

- [ ] **Step 3: Create `components/FilterSidebar.tsx`**

```tsx
"use client";

export interface FilterOption {
  id: string;
  label: string;
  count: number;
}

export interface FilterGroup {
  title: string;
  options: FilterOption[];
  selected: Set<string>;
  onToggle: (id: string) => void;
}

function FilterGroupSection({ title, options, selected, onToggle }: FilterGroup) {
  if (options.length === 0) return null;
  return (
    <div className="mb-4">
      <div className="mb-1 text-sm font-semibold text-gray-700">{title}</div>
      <div className="space-y-1">
        {options.map((opt) => (
          <label key={opt.id} className="flex items-center gap-2 text-sm">
            <input
              type="checkbox"
              checked={selected.has(opt.id)}
              onChange={() => onToggle(opt.id)}
            />
            <span>
              {opt.label} ({opt.count})
            </span>
          </label>
        ))}
      </div>
    </div>
  );
}

export function FilterSidebar({ groups }: { groups: FilterGroup[] }) {
  return (
    <aside className="w-full shrink-0 md:w-56">
      {groups.map((g) => (
        <FilterGroupSection key={g.title} {...g} />
      ))}
    </aside>
  );
}
```

- [ ] **Step 4: Create `app/bills/page.tsx`**

```tsx
"use client";

import { useEffect, useMemo, useState, Suspense } from "react";
import { useSearchParams } from "next/navigation";
import type { ProcessedBill } from "@/lib/types";
import { CATEGORIES, UNCATEGORIZED, categoryLabel } from "@/lib/categories";
import { STAGES } from "@/lib/stage";
import { BillCard } from "@/components/BillCard";
import { FilterSidebar, type FilterGroup } from "@/components/FilterSidebar";

function BillsPageInner() {
  const searchParams = useSearchParams();
  const [bills, setBills] = useState<ProcessedBill[] | null>(null);
  const [error, setError] = useState(false);
  const [selectedCategories, setSelectedCategories] = useState<Set<string>>(new Set());
  const [selectedParties, setSelectedParties] = useState<Set<string>>(new Set());
  const [selectedStages, setSelectedStages] = useState<Set<string>>(new Set());
  const [selectedBillTypes, setSelectedBillTypes] = useState<Set<string>>(new Set());
  const [search, setSearch] = useState("");
  const [sortByDays, setSortByDays] = useState(true);

  useEffect(() => {
    const initialCategory = searchParams.get("category");
    if (initialCategory) {
      setSelectedCategories(new Set([initialCategory]));
    }
  }, [searchParams]);

  const loadBills = () => {
    setError(false);
    fetch("/data/bills.json")
      .then((res) => {
        if (!res.ok) throw new Error("failed to load");
        return res.json();
      })
      .then((data: ProcessedBill[]) => setBills(data))
      .catch(() => setError(true));
  };

  useEffect(() => {
    loadBills();
  }, []);

  const toggle = (set: Set<string>, setSet: (s: Set<string>) => void, id: string) => {
    const next = new Set(set);
    if (next.has(id)) next.delete(id);
    else next.add(id);
    setSet(next);
  };

  const filtered = useMemo(() => {
    if (!bills) return [];
    let result = bills.filter((bill) => {
      if (
        selectedCategories.size > 0 &&
        !bill.categories.some((c) => selectedCategories.has(c))
      ) {
        return false;
      }
      if (selectedParties.size > 0 && !selectedParties.has(bill.party)) {
        return false;
      }
      if (selectedStages.size > 0 && !selectedStages.has(bill.stageId)) {
        return false;
      }
      if (selectedBillTypes.size > 0 && !selectedBillTypes.has(bill.billType)) {
        return false;
      }
      if (search.trim() && !bill.name.includes(search.trim())) {
        return false;
      }
      return true;
    });
    if (sortByDays) {
      result = [...result].sort((a, b) => (b.daysPending ?? -1) - (a.daysPending ?? -1));
    }
    return result;
  }, [bills, selectedCategories, selectedParties, selectedStages, selectedBillTypes, search, sortByDays]);

  if (error) {
    return (
      <div className="rounded border border-red-300 bg-red-50 p-4 text-red-700">
        <p>無法載入議案資料，請稍後重試。</p>
        <button
          type="button"
          onClick={loadBills}
          className="mt-2 rounded bg-red-700 px-3 py-1 text-sm text-white"
        >
          重試
        </button>
      </div>
    );
  }

  if (!bills) {
    return <div className="text-gray-500">載入中...</div>;
  }

  const partyOptions = Array.from(new Set(bills.map((b) => b.party)))
    .sort()
    .map((party) => ({
      id: party,
      label: party,
      count: bills.filter((b) => b.party === party).length,
    }));

  const categoryOptions = [...CATEGORIES.map((c) => c.id), UNCATEGORIZED]
    .map((id) => ({
      id,
      label: categoryLabel(id),
      count: bills.filter((b) => b.categories.includes(id)).length,
    }))
    .filter((opt) => opt.count > 0);

  const stageOptions = STAGES.map((s) => ({
    id: s.id,
    label: s.label,
    count: bills.filter((b) => b.stageId === s.id).length,
  })).filter((opt) => opt.count > 0);

  const billTypeOptions = Array.from(new Set(bills.map((b) => b.billType)))
    .sort()
    .map((type) => ({
      id: type,
      label: type,
      count: bills.filter((b) => b.billType === type).length,
    }));

  const filterGroups: FilterGroup[] = [
    {
      title: "類別",
      options: categoryOptions,
      selected: selectedCategories,
      onToggle: (id) => toggle(selectedCategories, setSelectedCategories, id),
    },
    {
      title: "提案政黨",
      options: partyOptions,
      selected: selectedParties,
      onToggle: (id) => toggle(selectedParties, setSelectedParties, id),
    },
    {
      title: "進度階段",
      options: stageOptions,
      selected: selectedStages,
      onToggle: (id) => toggle(selectedStages, setSelectedStages, id),
    },
    {
      title: "議案類別",
      options: billTypeOptions,
      selected: selectedBillTypes,
      onToggle: (id) => toggle(selectedBillTypes, setSelectedBillTypes, id),
    },
  ];

  return (
    <div className="flex flex-col gap-4 md:flex-row">
      <FilterSidebar groups={filterGroups} />
      <div className="flex-1">
        <div className="mb-3 flex flex-wrap items-center gap-3">
          <input
            type="text"
            placeholder="搜尋議案名稱..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="rounded border px-3 py-1.5 text-sm"
          />
          <label className="flex items-center gap-1 text-sm">
            <input
              type="checkbox"
              checked={sortByDays}
              onChange={(e) => setSortByDays(e.target.checked)}
            />
            依等待天數排序
          </label>
          <span className="text-sm text-gray-500">共 {filtered.length} 件</span>
        </div>
        <div className="space-y-2">
          {filtered.map((bill) => (
            <BillCard key={bill.id} bill={bill} />
          ))}
        </div>
      </div>
    </div>
  );
}

export default function BillsPage() {
  return (
    <Suspense fallback={<div className="text-gray-500">載入中...</div>}>
      <BillsPageInner />
    </Suspense>
  );
}
```

- [ ] **Step 5: Build and smoke-check the browse page**

Run: `npm run build`
Expected: build succeeds, `/bills` listed as a route (it will be a client-rendered page, so the prerendered HTML shows the Suspense fallback).

```bash
npm run dev &
sleep 3
curl -s http://localhost:3000/bills | grep -o "載入中"
curl -s http://localhost:3000/data/bills.json | head -c 200
kill %1
```

Expected: first command prints `載入中` (server-rendered fallback before client hydration fetches data); second command prints the start of the `bills.json` array (confirms the static data file is served from `public/data/`).

- [ ] **Step 6: Commit**

```bash
git add components/CategoryTag.tsx components/BillCard.tsx components/FilterSidebar.tsx app/bills/page.tsx
git commit -m "feat: add bills browse page with sidebar filters and search"
```

---

## Task 11: Bill Detail Page

**Files:**
- Create: `components/StageTimeline.tsx`
- Create: `app/bills/[id]/page.tsx`

- [ ] **Step 1: Create `components/StageTimeline.tsx`**

```tsx
import { STAGES, normalizeStage } from "@/lib/stage";
import type { BillProcessEntry } from "@/lib/ly-api";

const PIPELINE_STAGES = STAGES.filter((s) => s.id !== "closed");

export function StageTimeline({
  currentStageOrder,
  processEntries,
}: {
  currentStageOrder: number;
  processEntries: BillProcessEntry[];
}) {
  const stageDates: Record<string, string> = {};
  for (const entry of processEntries) {
    const normalized = normalizeStage(entry.狀態);
    if (!stageDates[normalized.id] && entry.日期.length > 0) {
      stageDates[normalized.id] = entry.日期[0];
    }
  }

  return (
    <div className="flex items-start text-xs">
      {PIPELINE_STAGES.map((stage, index) => {
        let dot = "bg-gray-300";
        let text = "text-gray-400";
        if (stage.order < currentStageOrder) {
          dot = "bg-green-700";
          text = "text-gray-700";
        } else if (stage.order === currentStageOrder) {
          dot = "bg-red-700";
          text = "text-gray-900 font-medium";
        }
        return (
          <div key={stage.id} className="flex flex-1 items-start">
            <div className={`flex-1 text-center ${text}`}>
              <div className={`mx-auto h-3 w-3 rounded-full ${dot}`} />
              <div className="mt-1">{stage.label}</div>
              <div className="text-gray-400">{stageDates[stage.id] ?? ""}</div>
            </div>
            {index < PIPELINE_STAGES.length - 1 && (
              <div
                className={`mt-1.5 h-0.5 flex-1 ${
                  stage.order < currentStageOrder ? "bg-green-700" : "bg-gray-200"
                }`}
              />
            )}
          </div>
        );
      })}
    </div>
  );
}
```

- [ ] **Step 2: Create `app/bills/[id]/page.tsx`**

```tsx
import fs from "fs";
import path from "path";
import Link from "next/link";
import { notFound } from "next/navigation";
import type { ProcessedBill } from "@/lib/types";
import { fetchBillDetail, fetchAllLegislators } from "@/lib/ly-api";
import { partyForLegislator, CURRENT_RULING_PARTY } from "@/lib/parties";
import { CategoryTag } from "@/components/CategoryTag";
import { PartyBadge } from "@/components/PartyBadge";
import { StageTimeline } from "@/components/StageTimeline";

export const revalidate = 86400;

function loadBills(): ProcessedBill[] {
  const file = path.join(process.cwd(), "public", "data", "bills.json");
  return JSON.parse(fs.readFileSync(file, "utf-8"));
}

export default async function BillDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const bills = loadBills();
  const bill = bills.find((b) => b.id === id);
  if (!bill) notFound();

  const [detail, legislators] = await Promise.all([
    fetchBillDetail(id).catch(() => null),
    fetchAllLegislators(11).catch(() => []),
  ]);

  const cosignerCounts: Record<string, number> = {};
  for (const name of detail?.連署人 ?? []) {
    const party =
      bill.source === "政府提案"
        ? CURRENT_RULING_PARTY
        : partyForLegislator(name, legislators);
    cosignerCounts[party] = (cosignerCounts[party] ?? 0) + 1;
  }

  return (
    <div className="space-y-4">
      <div>
        <div className="mb-2 flex flex-wrap gap-1">
          {bill.categories.map((cat) => (
            <CategoryTag key={cat} categoryId={cat} />
          ))}
        </div>
        <h1 className="text-xl font-bold">{bill.name}</h1>
        {detail?.案由 && <p className="mt-1 text-sm text-gray-600">{detail.案由}</p>}
      </div>

      <div className="flex flex-wrap gap-6 rounded border bg-white p-4">
        <div>
          <div className="text-xs text-gray-500">提案方</div>
          <div className="mt-1 flex items-center gap-2">
            <PartyBadge party={bill.party} />
            <span className="text-sm">
              {bill.proposerUnit}
              {bill.proposers.length > 0 && ` ${bill.proposers.join("、")}`}
            </span>
          </div>
        </div>
        <div>
          <div className="text-xs text-gray-500">提案日期</div>
          <div className="mt-1 text-sm">{bill.proposalDate ?? "未提供"}</div>
        </div>
        <div>
          <div className="text-xs text-gray-500">目前階段</div>
          <div className="mt-1 text-sm">{bill.stageLabel}</div>
        </div>
        <div>
          <div className="text-xs text-gray-500">已等待</div>
          <div className="mt-1 text-sm font-bold text-red-700">
            {bill.daysPending !== null ? `${bill.daysPending} 天` : "未知"}
          </div>
        </div>
      </div>

      {Object.keys(cosignerCounts).length > 0 && (
        <div className="rounded border bg-white p-4">
          <div className="mb-1 text-xs text-gray-500">連署 / 跨黨派支持狀況</div>
          <div className="flex flex-wrap gap-1">
            {Object.entries(cosignerCounts).map(([party, count]) => (
              <PartyBadge key={party} party={party} label={`${party} ×${count}`} />
            ))}
          </div>
        </div>
      )}

      <div className="rounded border bg-white p-4">
        <div className="mb-2 text-xs text-gray-500">審議時間軸</div>
        {bill.stageOrder > 0 ? (
          <>
            <StageTimeline
              currentStageOrder={bill.stageOrder}
              processEntries={detail?.議案流程 ?? []}
            />
            <p className="mt-2 text-xs text-gray-400">紅點 = 目前卡關的階段。</p>
          </>
        ) : (
          <p className="text-sm text-gray-600">
            此議案目前狀態為「{bill.stageLabel}」，不適用標準時間軸。
          </p>
        )}
      </div>

      <div className="rounded border bg-white p-4">
        <div className="mb-1 text-xs text-gray-500">原始資料</div>
        <p className="text-sm">
          <a className="underline" href={bill.url} target="_blank" rel="noreferrer">
            在立法院議事網查看完整議案 →
          </a>
          {detail?.相關附件?.map((att) => (
            <span key={att.網址}>
              {" "}
              ・{" "}
              <a className="underline" href={att.網址} target="_blank" rel="noreferrer">
                {att.名稱}
              </a>
            </span>
          ))}
        </p>
      </div>

      <div className="rounded border border-dashed bg-white p-4">
        <div className="mb-1 text-xs text-gray-500">相關新聞（規劃中）</div>
        <p className="text-xs text-gray-400">
          未來版本將顯示相關新聞報導，並標示媒體傾向（偏綠／偏藍／偏白／中立等）。
        </p>
      </div>

      <Link href="/bills" className="inline-block text-sm underline">
        ← 返回議案列表
      </Link>
    </div>
  );
}
```

- [ ] **Step 3: Build and smoke-check the detail page**

Run: `npm run build`
Expected: build succeeds.

Find a real bill id from the generated dataset and check the rendered page:

```bash
npm run dev &
sleep 3
BILL_ID=$(node -e "console.log(require('./public/data/bills.json')[0].id)")
curl -s "http://localhost:3000/bills/$BILL_ID" | grep -o "審議時間軸"
curl -s "http://localhost:3000/bills/does-not-exist-id" -o /dev/null -w "%{http_code}\n"
kill %1
```

Expected: first command prints `審議時間軸`; second command prints `404`.

- [ ] **Step 4: Commit**

```bash
git add components/StageTimeline.tsx "app/bills/[id]/page.tsx"
git commit -m "feat: add bill detail page with stage timeline and co-signer breakdown"
```

---

## Task 12: Scheduled Data Refresh Workflow

**Files:**
- Create: `.github/workflows/refresh-data.yml`

- [ ] **Step 1: Create `.github/workflows/refresh-data.yml`**

```yaml
name: Refresh Bills Data

on:
  schedule:
    - cron: "0 18 * * *"
  workflow_dispatch:

permissions:
  contents: write

jobs:
  refresh:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4

      - uses: actions/setup-node@v4
        with:
          node-version: 20

      - run: npm ci

      - run: npm run build:data

      - name: Commit updated data
        run: |
          git config user.name "github-actions[bot]"
          git config user.email "github-actions[bot]@users.noreply.github.com"
          git add public/data/bills.json public/data/meta.json data/unmatched-proposers.json
          if git diff --cached --quiet; then
            echo "No data changes"
          else
            git commit -m "data: scheduled refresh of bills dataset"
            git push
          fi
```

The `0 18 * * *` cron runs daily at 18:00 UTC (02:00 Taiwan time). The `build:data`
script (Task 7/8) exits non-zero on API failure without writing partial output, so a
failed run leaves `public/data/*.json` untouched and this job has nothing to commit.

- [ ] **Step 2: Verify the workflow file is valid YAML and references the right script**

```bash
grep -n "cron:\|build:data\|contents: write\|permissions" .github/workflows/refresh-data.yml
```

Expected: all four lines are found, confirming the schedule, the pipeline command, and
write permissions are wired up.

- [ ] **Step 3: Commit**

```bash
git add .github/workflows/refresh-data.yml
git commit -m "ci: add scheduled daily bills data refresh workflow"
```

---

## Task 13: README

**Files:**
- Create: `README.md`

- [ ] **Step 1: Create `README.md`**

````markdown
# 立法院議案追蹤 (Legislative Yuan Bills Tracker)

追蹤台灣第11屆立法院議案進度、提案政黨與跨黨派支持狀況。資料來源為立法院開放資料 API
（[v2.ly.govapi.tw](https://v2.ly.govapi.tw)）。

## Features (v1)

- 瀏覽所有第11屆議案（含法律案、預決算案、人事案等所有類型）。
- 依類別（勞工權益、居住權益、兒少福利等）、提案政黨、進度階段、議案類別篩選與搜尋。
- 每個議案顯示提案政黨、目前審議階段、已等待天數、跨黨派連署情況。
- 首頁提供政黨/類別/階段統計總覽。

詳細設計請見 [`docs/superpowers/specs/2026-06-12-bills-tracker-design.md`](docs/superpowers/specs/2026-06-12-bills-tracker-design.md)。

## Local Development

```bash
npm install
npm run dev
```

Open [http://localhost:3000](http://localhost:3000).

## Running Tests

```bash
npm test
```

## Data Pipeline

`public/data/bills.json` and `public/data/meta.json` are generated by
`scripts/build-data.ts`, which fetches all term-11 bills and legislators from
`v2.ly.govapi.tw`, derives each bill's proposing party, topic categories, and
normalized legislative stage, and writes the resulting summary + stats files.

To regenerate the data locally:

```bash
npm run build:data
```

This also writes `data/unmatched-proposers.json`, a list of proposer names that
couldn't be matched to a legislator in the term-11 roster (used to extend
`legislatorOverrides` in `lib/parties.ts`).

## Automated Data Refresh

[`.github/workflows/refresh-data.yml`](.github/workflows/refresh-data.yml) runs the
data pipeline daily and commits any changes to `public/data/*.json`. Pushes to the
default branch trigger Vercel's auto-redeploy, so the live site stays up to date
without manual intervention.

## Deployment

1. Push this repository to GitHub.
2. Import the repository into [Vercel](https://vercel.com/new) — no configuration or
   environment variables are required (Next.js is auto-detected).
3. Every push to the default branch (including the scheduled data-refresh commits)
   triggers a new deployment.

## Future Extensions

See the "Future Extensions" section of the
[design doc](docs/superpowers/specs/2026-06-12-bills-tracker-design.md) for planned
v2+ features: party-comparison dashboards, "who's blocking what" analysis, and
news links labeled by media political leaning.
````

- [ ] **Step 2: Verify the README renders the key sections**

```bash
grep -c "^## " README.md
```

Expected: `7` (one for each `##` section header above).

- [ ] **Step 3: Commit**

```bash
git add README.md
git commit -m "docs: add project README"
```

---

## Task 14: Final Verification

**Files:** none (verification only)

- [ ] **Step 1: Run the full test suite**

```bash
npx vitest run
```

Expected: all tests across `tests/parties.test.ts`, `tests/categories.test.ts`,
`tests/stage.test.ts`, `tests/ly-api.test.ts`, `tests/build-data.test.ts`,
`tests/smoke.test.ts` pass.

- [ ] **Step 2: Run lint**

```bash
npm run lint
```

Expected: no errors. Fix any reported issues before continuing.

- [ ] **Step 3: Run a full production build**

```bash
npm run build
```

Expected: build completes successfully, listing `/`, `/bills`, and `/bills/[id]` as
routes.

- [ ] **Step 4: Smoke-check all three pages against the dev server**

```bash
npm run dev &
sleep 3
curl -s http://localhost:3000 | grep -o "立法院議案追蹤"
curl -s http://localhost:3000/bills | grep -o "載入中"
BILL_ID=$(node -e "console.log(require('./public/data/bills.json')[0].id)")
curl -s "http://localhost:3000/bills/$BILL_ID" | grep -o "審議時間軸"
kill %1
```

Expected: each `grep` prints the matched text, confirming the homepage, browse page,
and a detail page all render without errors.

- [ ] **Step 5: Confirm working tree is clean**

```bash
git status
```

Expected: `nothing to commit, working tree clean` — every task's changes have been
committed.

---
