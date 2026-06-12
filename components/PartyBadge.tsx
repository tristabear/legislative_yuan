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
