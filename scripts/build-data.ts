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
import { daysPending, isFinishedStage, normalizeStage } from "../lib/stage";
import type { MetaStats, ProcessedBill } from "../lib/types";

const TERM = 11;

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

async function fetchAllTermBills(term: number): Promise<RawBill[]> {
  const seen = new Map<string, RawBill>();

  for (let session = 1; session <= 8; session++) {
    const bills = await fetchAllBills(term, 100, { 會期: String(session) });
    for (const bill of bills) {
      seen.set(bill.議案編號, bill);
    }
  }

  return Array.from(seen.values());
}

async function main() {
  console.log(`Fetching term ${TERM} legislators...`);
  const legislators = await fetchAllLegislators(TERM);
  console.log(`Fetched ${legislators.length} legislators`);

  console.log(`Fetching term ${TERM} bills (this takes a few minutes)...`);
  const rawBills = await fetchAllTermBills(TERM);
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
