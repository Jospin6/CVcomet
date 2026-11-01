import { getCareerProfile } from "@/lib/career-profile/service";
import type { CareerProfile } from "@/lib/career-profile/schema";
import type { AgentRunIdentity } from "../../../core/contracts.ts";
import { AgenticError } from "../../../core/errors.ts";
import { assertRunIdentity } from "../../../core/policies/identity.ts";

/** DB query is always scoped to the authenticated actor, never a model-provided ID. */
export async function loadProfileTool(
  identity: AgentRunIdentity,
  read: (actorId: string) => Promise<CareerProfile> = getCareerProfile,
): Promise<CareerProfile> {
  assertRunIdentity(identity);
  if (identity.agentId !== "profile" || identity.access.kind !== "authenticated") {
    throw new AgenticError("AGENT_ACCESS_DENIED", 403);
  }
  return read(identity.access.actorId);
}
