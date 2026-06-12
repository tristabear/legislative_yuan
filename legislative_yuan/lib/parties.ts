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
