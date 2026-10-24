import { z } from "zod";
import { getSessionUser } from "@/lib/auth";
import { CareerContractError } from "@/lib/career-os/contracts";
import { withCareerHttp } from "@/lib/career-os/http";
import { createApplicationPacket, listApplicationPackets } from "@/lib/career-os/application-packet-service";
import { profileJson } from "@/lib/career-profile/http";
import { assertTrustedWriteOrigin } from "@/lib/security/request-origin";
export const runtime = "nodejs";
export const dynamic = "force-dynamic";
const schema = z.object({ apiVersion: z.literal("v1"), requestKey: z.string().uuid(), jobId: z.string().uuid(), cvId: z.string().uuid(), coverLetterId: z.string().uuid().optional(), missionId: z.string().uuid().optional(), language: z.enum(["fr", "en"]).default("fr") }).strict();
export async function GET(req: Request) {
  return withCareerHttp("application-packet.list", async () => {
    const actor = await getSessionUser();
    if (!actor) throw new CareerContractError(401, "UNAUTHORIZED");
    const query = new URL(req.url).searchParams;
    const limit = z.coerce.number().int().min(1).max(50).default(30).parse(query.get("limit") ?? undefined);
    return listApplicationPackets(actor, limit);
  });
}
export async function POST(req: Request) {
  return withCareerHttp("application-packet.create", async () => {
    assertTrustedWriteOrigin(req);
    const actor = await getSessionUser();
    if (!actor) throw new CareerContractError(401, "UNAUTHORIZED");
    return createApplicationPacket(actor, schema.parse(await profileJson(req, 4096)));
  }, 201);
}
