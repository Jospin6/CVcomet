import { z } from "zod";
import { getSessionUser } from "@/lib/auth";
import { CareerContractError } from "@/lib/career-os/contracts";
import { withCareerHttp } from "@/lib/career-os/http";
import { profileJson } from "@/lib/career-profile/http";
import { assertTrustedWriteOrigin } from "@/lib/security/request-origin";
import { assertMissionRequestKey } from "@/lib/career-os/mission-policy";
import { executeCareerMissionRun, listCareerMissionRuns } from "@/lib/career-os/mission-service";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const maxDuration = 60;
type Context = { params: Promise<{ id: string }> };
const input = z.object({ apiVersion: z.literal("v1"), requestKey: z.string().uuid(), message: z.string().trim().min(2).max(6000), applicationId: z.string().uuid().optional() }).strict();
const query = z.object({ limit: z.coerce.number().int().min(1).max(30).default(30), cursor: z.string().uuid().optional() }).strict();
export async function GET(req: Request, ctx: Context) {
  return withCareerHttp("mission.runs.list", async () => {
    const actor = await getSessionUser();
    if (!actor) throw new CareerContractError(401, "UNAUTHORIZED");
    const id = z.string().uuid().parse((await ctx.params).id);
    const input = query.parse(Object.fromEntries(new URL(req.url).searchParams));
    return listCareerMissionRuns(actor, id, input.limit, input.cursor);
  });
}
export async function POST(req: Request, ctx: Context) {
  return withCareerHttp("mission.run", async () => {
    assertTrustedWriteOrigin(req);
    const actor = await getSessionUser();
    if (!actor) throw new CareerContractError(401, "UNAUTHORIZED");
    const id = z.string().uuid().parse((await ctx.params).id);
    const body = input.parse(await profileJson(req, 8 * 1024));
    return executeCareerMissionRun(actor, id, assertMissionRequestKey(body.requestKey), body.message, req.signal, body.applicationId);
  });
}
