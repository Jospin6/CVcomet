import { z } from "zod";
import { getSessionUser } from "@/lib/auth";
import { CareerContractError } from "@/lib/career-os/contracts";
import { withCareerHttp } from "@/lib/career-os/http";
import { profileJson } from "@/lib/career-profile/http";
import { assertTrustedWriteOrigin } from "@/lib/security/request-origin";
import { decideCareerApproval } from "@/lib/career-os/mission-service";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
type Context = { params: Promise<{ id: string; approvalId: string }> };
const schema = z.object({ apiVersion: z.literal("v1"), decision: z.enum(["approve", "reject"]) }).strict();
/** Decision alone NEVER executes the proposed action. */
export async function PATCH(req: Request, ctx: Context) {
  return withCareerHttp("mission.approval.decide", async () => {
    assertTrustedWriteOrigin(req);
    const actor = await getSessionUser();
    if (!actor) throw new CareerContractError(401, "UNAUTHORIZED");
    const params = await ctx.params;
    const id = z.string().uuid().parse(params.id);
    const approvalId = z.string().uuid().parse(params.approvalId);
    const body = schema.parse(await profileJson(req, 1024));
    return decideCareerApproval(actor, id, approvalId, body.decision);
  });
}
