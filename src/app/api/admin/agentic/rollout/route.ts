import { requireAIAdmin, aiAdminError, aiAdminResponse } from "@/lib/ai/admin-http";
import { readCareerRolloutComparison } from "@/lib/agentic/agents/evaluation/tools/rollout-read.tool";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
/** Read-only admin metrics. No per-user identities, prompts or content. */
export async function GET(req: Request) {
  try {
    await requireAIAdmin(req); // Gate BEFORE Prisma reads / any rollout inspection.
    return aiAdminResponse(await readCareerRolloutComparison());
  } catch (error) { return aiAdminError(error); }
}
