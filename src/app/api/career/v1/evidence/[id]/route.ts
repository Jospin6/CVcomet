import { z } from "zod";
import { getSessionUser } from "@/lib/auth";
import { withCareerHttp } from "@/lib/career-os/http";
import { CareerContractError } from "@/lib/career-os/contracts";
import { profileJson } from "@/lib/career-profile/http";
import { assertTrustedWriteOrigin } from "@/lib/security/request-origin";
import { evidenceEditSchema, evidenceTransitionSchema, evidenceDeleteSchema } from "@/lib/career-evidence/schema";
import { deleteEvidence, editEvidence, transitionEvidence } from "@/lib/career-evidence/service";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
type Context = { params: Promise<{ id: string }> };

async function identify(ctx: Context) {
  return z.string().uuid().parse((await ctx.params).id);
}
export async function PATCH(req: Request, ctx: Context) {
  return withCareerHttp("evidence.change", async () => {
    assertTrustedWriteOrigin(req);
    const actor = await getSessionUser();
    if (!actor) throw new CareerContractError(401, "UNAUTHORIZED");
    const id = await identify(ctx);
    const body = await profileJson(req, 4 * 1024);
    if (typeof body !== "object" || body === null || !("apiVersion" in body)) throw new CareerContractError(400, "VALIDATION");
    if ("action" in body) return transitionEvidence(actor.id, id, evidenceTransitionSchema.parse(body));
    return editEvidence(actor.id, id, evidenceEditSchema.parse(body));
  });
}
export async function DELETE(req: Request, ctx: Context) {
  return withCareerHttp("evidence.delete", async () => {
    assertTrustedWriteOrigin(req);
    const actor = await getSessionUser();
    if (!actor) throw new CareerContractError(401, "UNAUTHORIZED");
    const id = await identify(ctx);
    const { revision } = evidenceDeleteSchema.parse(await profileJson(req, 1024));
    return deleteEvidence(actor.id, id, revision);
  });
}
