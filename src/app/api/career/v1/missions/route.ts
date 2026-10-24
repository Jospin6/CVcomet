import { z } from "zod";
import { getSessionUser } from "@/lib/auth";
import { CareerContractError } from "@/lib/career-os/contracts";
import { withCareerHttp } from "@/lib/career-os/http";
import { profileJson } from "@/lib/career-profile/http";
import { assertTrustedWriteOrigin } from "@/lib/security/request-origin";
import { createCareerMission, listCareerMissions } from "@/lib/career-os/mission-service";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
const create = z.object({ apiVersion: z.literal("v1"), title: z.string().trim().min(2).max(120) }).strict();
const query = z.object({ limit: z.coerce.number().int().min(1).max(30).default(20), cursor: z.string().uuid().optional() }).strict();
export async function GET(req: Request) {
  return withCareerHttp("mission.list", async () => {
    const actor = await getSessionUser();
    if (!actor) throw new CareerContractError(401, "UNAUTHORIZED");
    const input = query.parse(Object.fromEntries(new URL(req.url).searchParams));
    return listCareerMissions(actor, input.limit, input.cursor);
  });
}
export async function POST(req: Request) {
  return withCareerHttp("mission.create", async () => {
    assertTrustedWriteOrigin(req);
    const actor = await getSessionUser();
    if (!actor) throw new CareerContractError(401, "UNAUTHORIZED");
    const body = create.parse(await profileJson(req, 1024));
    return createCareerMission(actor, body.title);
  }, 201);
}
