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
