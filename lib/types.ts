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
