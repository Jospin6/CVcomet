import { z } from "zod";
import { getSessionUser } from "@/lib/auth";
import { CareerContractError } from "@/lib/career-os/contracts";
import { withCareerHttp } from "@/lib/career-os/http";
import { profileJson } from "@/lib/career-profile/http";
import { assertTrustedWriteOrigin } from "@/lib/security/request-origin";
import { deleteCareerMission, getCareerMission, updateCareerMission } from "@/lib/career-os/mission-service";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
type Context = { params: Promise<{ id: string }> };
const patch = z.discriminatedUnion("action", [
  z.object({ apiVersion: z.literal("v1"), action: z.literal("rename"), revision: z.number().int().min(0), title: z.string().trim().min(2).max(120) }).strict(),
  z.object({ apiVersion: z.literal("v1"), action: z.enum(["archive", "restore"]), revision: z.number().int().min(0) }).strict(),
]);
const identify = async (ctx: Context) => z.string().uuid().parse((await ctx.params).id);
export async function GET(_req: Request, ctx: Context) {
  return withCareerHttp("mission.detail", async () => {
    const actor = await getSessionUser();
    if (!actor) throw new CareerContractError(401, "UNAUTHORIZED");
    return getCareerMission(actor, await identify(ctx));
  });
}
export async function PATCH(req: Request, ctx: Context) {
  return withCareerHttp("mission.update", async () => {
    assertTrustedWriteOrigin(req);
    const actor = await getSessionUser();
    if (!actor) throw new CareerContractError(401, "UNAUTHORIZED");
    const input = patch.parse(await profileJson(req, 1024));
    return updateCareerMission(actor, await identify(ctx), input.revision, input);
  });
}
export async function DELETE(req: Request, ctx: Context) {
  return withCareerHttp("mission.delete", async () => {
    assertTrustedWriteOrigin(req);
    const actor = await getSessionUser();
    if (!actor) throw new CareerContractError(401, "UNAUTHORIZED");
    return deleteCareerMission(actor, await identify(ctx));
  });
}
