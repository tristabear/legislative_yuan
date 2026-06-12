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

export function isFinishedStage(stageOrder: number): boolean {
  return stageOrder === 0 || stageOrder === 5;
}
