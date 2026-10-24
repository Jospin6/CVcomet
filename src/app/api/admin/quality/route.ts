import { requireAIAdmin, aiAdminError, aiAdminResponse } from "@/lib/ai/admin-http";
import { getCareerQualityOverview } from "@/lib/quality/agent-observations";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
/** Aggregated metrics only, never actor identifiers, prompts, replies or tool payloads. */
export async function GET(req: Request) {
  try {
    await requireAIAdmin(req);
    return aiAdminResponse(await getCareerQualityOverview());
  } catch (error) {
    return aiAdminError(error);
  }
}
