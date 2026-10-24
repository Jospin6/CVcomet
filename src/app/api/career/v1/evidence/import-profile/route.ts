import { getSessionUser } from "@/lib/auth";
import { withCareerHttp } from "@/lib/career-os/http";
import { CareerContractError } from "@/lib/career-os/contracts";
import { profileJson } from "@/lib/career-profile/http";
import { assertTrustedWriteOrigin } from "@/lib/security/request-origin";
import { evidenceImportSchema } from "@/lib/career-evidence/schema";
import { importProfileEvidence } from "@/lib/career-evidence/service";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export async function POST(req: Request) {
  return withCareerHttp("evidence.import_profile", async () => {
    assertTrustedWriteOrigin(req);
    const actor = await getSessionUser();
    if (!actor) throw new CareerContractError(401, "UNAUTHORIZED");
    evidenceImportSchema.parse(await profileJson(req, 1024));
    return importProfileEvidence(actor.id);
  });
}
