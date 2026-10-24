import { z } from "zod";
import { getSessionUser } from "@/lib/auth";
import { CareerContractError } from "@/lib/career-os/contracts";
import { withCareerHttp } from "@/lib/career-os/http";
import { deleteApplicationPacket, getApplicationPacket, updateApplicationPacket } from "@/lib/career-os/application-packet-service";
import { profileJson } from "@/lib/career-profile/http";
import { assertTrustedWriteOrigin } from "@/lib/security/request-origin";
export const runtime = "nodejs";
export const dynamic = "force-dynamic";
type Context = { params: Promise<{ id: string }> };
const schema = z.object({ apiVersion: z.literal("v1"), revision: z.number().int().min(0), subject: z.string().trim().min(1).max(300), body: z.string().trim().min(1).max(12000), recipientEmail: z.string().trim().email().max(254).nullable().optional() }).strict();
const identify = async (ctx: Context) => z.string().uuid().parse((await ctx.params).id);
export async function GET(_req: Request, ctx: Context) {
  return withCareerHttp("application-packet.detail", async () => {
    const actor = await getSessionUser();
    if (!actor) throw new CareerContractError(401, "UNAUTHORIZED");
    return getApplicationPacket(actor, await identify(ctx));
  });
}
export async function PATCH(req: Request, ctx: Context) {
  return withCareerHttp("application-packet.edit", async () => {
    assertTrustedWriteOrigin(req);
    const actor = await getSessionUser();
    if (!actor) throw new CareerContractError(401, "UNAUTHORIZED");
    return updateApplicationPacket(actor, await identify(ctx), schema.parse(await profileJson(req, 16000)));
  });
}
export async function DELETE(req: Request, ctx: Context) {
  return withCareerHttp("application-packet.delete", async () => {
    assertTrustedWriteOrigin(req);
    const actor = await getSessionUser();
    if (!actor) throw new CareerContractError(401, "UNAUTHORIZED");
    return deleteApplicationPacket(actor, await identify(ctx));
  });
}
