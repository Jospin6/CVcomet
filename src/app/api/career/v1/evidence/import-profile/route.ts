import { getSessionUser } from "@/lib/auth";
import { withCareerHttp } from "@/lib/career-os/http";
import { CareerContractError } from "@/lib/career-os/contracts";
import { assertTrustedWriteOrigin } from "@/lib/security/request-origin";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

async function retired(write = false, req?: Request) {
  return withCareerHttp("evidence.retired", async () => {
    if (write && req) assertTrustedWriteOrigin(req);
    const actor = await getSessionUser();
    if (!actor) throw new CareerContractError(401, "UNAUTHORIZED");
    throw new CareerContractError(410, "FEATURE_RETIRED_USE_CAREER_PROFILE");
  });
}

export async function POST(req: Request) { return retired(true, req); }
