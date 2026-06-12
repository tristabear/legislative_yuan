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
          <div className="mt-1 text-sm">{detail?.提案日期 ?? "未提供"}</div>
        </div>
        <div>
          <div className="text-xs text-gray-500">目前階段</div>
          <div className="mt-1 text-sm">{bill.stageLabel}</div>
        </div>
        {bill.daysPending !== null && (
          <div>
            <div className="text-xs text-gray-500">已等待</div>
            <div className="mt-1 text-sm font-bold text-red-700">
              {bill.daysPending} 天
            </div>
          </div>
        )}
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
