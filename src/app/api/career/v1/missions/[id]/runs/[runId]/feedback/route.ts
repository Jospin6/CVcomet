import { z } from "zod";
import { getSessionUser } from "@/lib/auth";
import { CareerContractError } from "@/lib/career-os/contracts";
import { withCareerHttp } from "@/lib/career-os/http";
import { profileJson } from "@/lib/career-profile/http";
import { assertTrustedWriteOrigin } from "@/lib/security/request-origin";
import { setCareerMissionRunFeedback } from "@/lib/quality/feedback-service";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
type Context = { params: Promise<{ id: string; runId: string }> };
const bodySchema = z.object({ apiVersion: z.literal("v1"), rating: z.enum(["HELPFUL", "NOT_HELPFUL", "CLEAR"]) }).strict();
/** Feedback only on the authenticated account's own completed mission run. */
export async function POST(req: Request, context: Context) {
  return withCareerHttp("mission.run.feedback", async () => {
    assertTrustedWriteOrigin(req);
    const actor = await getSessionUser();
    if (!actor) throw new CareerContractError(401, "UNAUTHORIZED");
    const { id, runId } = await context.params;
    const missionId = z.string().uuid().parse(id);
    const ownedRunId = z.string().uuid().parse(runId);
    const { rating } = bodySchema.parse(await profileJson(req, 512));
    return setCareerMissionRunFeedback(actor, missionId, ownedRunId, rating);
  });
}
