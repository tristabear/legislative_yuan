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
  const [sortMode, setSortMode] = useState<"recent" | "waiting">("recent");

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
    result = [...result].sort((a, b) => {
      if (sortMode === "waiting") {
        return (b.daysPending ?? -1) - (a.daysPending ?? -1);
      }
      return (b.lastUpdateDate ?? "").localeCompare(a.lastUpdateDate ?? "");
    });
    return result;
  }, [bills, selectedCategories, selectedParties, selectedStages, selectedBillTypes, search, sortMode]);

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
