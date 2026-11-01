import { requireAIAdmin, aiAdminError, aiAdminResponse } from "@/lib/ai/admin-http";
import { runEvaluationAgent } from "@/lib/agentic/agents/evaluation/agent/evaluation.agent";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
/** Admin-only, read-only operational aggregates. No row-level or candidate information. */
export async function GET(req: Request) {
  try {
    const actor = await requireAIAdmin(req);
    return aiAdminResponse(await runEvaluationAgent({ adminId: actor.id, signal: req.signal }));
  } catch (error) { return aiAdminError(error); }
}
