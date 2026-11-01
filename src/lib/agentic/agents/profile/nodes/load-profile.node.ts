import type { ExecutionScope } from "../../../core/execution/runner.ts";
import type { CareerProfile } from "@/lib/career-profile/schema";
import { loadProfileTool } from "../tools/load-profile.tool";

export function createLoadProfileNode(
  scope: ExecutionScope,
  read?: (actorId: string) => Promise<CareerProfile>,
) {
  return async () => ({ current: await loadProfileTool(scope.identity, read) });
}
