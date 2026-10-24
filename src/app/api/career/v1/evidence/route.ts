import { getSessionUser } from "@/lib/auth";
import { withCareerHttp } from "@/lib/career-os/http";
import { CareerContractError } from "@/lib/career-os/contracts";
import { profileJson } from "@/lib/career-profile/http";
import { assertTrustedWriteOrigin } from "@/lib/security/request-origin";
import { newEvidenceSchema, evidenceQuerySchema } from "@/lib/career-evidence/schema";
import { createEvidence, listEvidence } from "@/lib/career-evidence/service";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET(req: Request) {
  return withCareerHttp("evidence.list", async () => {
    const actor = await getSessionUser();
    if (!actor) throw new CareerContractError(401, "UNAUTHORIZED");
    const query = evidenceQuerySchema.parse(Object.fromEntries(new URL(req.url).searchParams));
    return listEvidence(actor.id, query);
  });
}

export async function POST(req: Request) {
  return withCareerHttp("evidence.create", async () => {
    assertTrustedWriteOrigin(req);
    const actor = await getSessionUser();
    if (!actor) throw new CareerContractError(401, "UNAUTHORIZED");
    const input = newEvidenceSchema.parse(await profileJson(req, 4 * 1024));
    return createEvidence(actor.id, input);
  }, 201);
}
