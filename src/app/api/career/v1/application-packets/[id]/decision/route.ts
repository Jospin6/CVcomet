import { z } from "zod";
import { getSessionUser } from "@/lib/auth";
import { CareerContractError } from "@/lib/career-os/contracts";
import { withCareerHttp } from "@/lib/career-os/http";
import { decideApplicationPacket } from "@/lib/career-os/application-packet-service";
import { profileJson } from "@/lib/career-profile/http";
import { assertTrustedWriteOrigin } from "@/lib/security/request-origin";
export const runtime = "nodejs";
export const dynamic = "force-dynamic";
type Context = { params: Promise<{ id: string }> };
const schema = z.object({ apiVersion: z.literal("v1"), revision: z.number().int().min(0), action: z.enum(["approve", "cancel"]), reviewed: z.boolean() }).strict();
export async function POST(req: Request, ctx: Context) {
  return withCareerHttp("application-packet.decision", async () => {
    assertTrustedWriteOrigin(req);
    const actor = await getSessionUser();
    if (!actor) throw new CareerContractError(401, "UNAUTHORIZED");
    const body = schema.parse(await profileJson(req, 2048));
    const id = z.string().uuid().parse((await ctx.params).id);
    return decideApplicationPacket(actor, id, body.revision, body.action, body.reviewed);
  });
}
