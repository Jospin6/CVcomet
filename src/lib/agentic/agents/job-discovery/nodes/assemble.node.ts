import type { JobDiscoveryState } from "../agent/state";
export function assembleDiscoveryNode(state: typeof JobDiscoveryState.State) {
  const count = state.checked.length;
  const checked = state.verifiedCount;
  const eligible = state.deepMatchCount;
  const matchingStatus = count === 0 ? "empty" as const
    : checked === 0 ? "unavailable" as const
    : checked === count ? "verified" as const : "partial" as const;
  return { result: {
    jobs: [...state.checked].sort((a, b) => (b.match.score ?? -1) - (a.match.score ?? -1)),
    countries: state.countries,
    totalConsidered: state.filtered.length,
    warnings: state.pool.warnings,
    verifiedCount: checked,
    deepMatchCount: eligible,
    matchingStatus,
    warningCode: state.warningCode ?? null,
    ...(count === 0 ? { reason: "NO_MATCHING_OFFERS" as const } : {}),
  } };
}
