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
      {bill.mergedInto && (
        <div className="mt-1 text-xs text-gray-500">
          已併案處理 · 相關報告：{bill.mergedInto.stageLabel}
        </div>
      )}
    </Link>
  );
}
