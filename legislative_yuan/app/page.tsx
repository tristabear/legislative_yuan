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
