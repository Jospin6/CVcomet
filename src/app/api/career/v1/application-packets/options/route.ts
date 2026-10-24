import { getSessionUser } from "@/lib/auth";
import { CareerContractError } from "@/lib/career-os/contracts";
import { withCareerHttp } from "@/lib/career-os/http";
import { packetOptions } from "@/lib/career-os/application-packet-service";
export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export async function GET() {
  return withCareerHttp("application-packet.options", async () => {
    const actor = await getSessionUser();
    if (!actor) throw new CareerContractError(401, "UNAUTHORIZED");
    return packetOptions(actor);
  });
}
