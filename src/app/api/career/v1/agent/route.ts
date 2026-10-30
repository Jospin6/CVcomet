import { z } from "zod";
import { getSessionUser } from "@/lib/auth";
import { ProfileError, profileJson } from "@/lib/career-profile/http";
import { requireCareerVersion } from "@/lib/career-os/contracts";
import { withCareerHttp } from "@/lib/career-os/http";
import { runCareerAgent } from "@/lib/career-os/agent-service";
import { assertTrustedWriteOrigin } from "@/lib/security/request-origin";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const maxDuration = 60;
const requestSchema = z.object({
  apiVersion: z.literal("v1"), message: z.string().trim().min(2).max(6000), applicationId: z.string().uuid().optional(),
}).strict();

/** The caller can submit a question, never tool calls, ownership or approvals. */
export async function POST(req: Request) {
  return withCareerHttp("agent.run", async () => {
    assertTrustedWriteOrigin(req);
    const actor = await getSessionUser();
    if (!actor) throw new ProfileError(401, "UNAUTHORIZED");
    const body = requestSchema.parse(await profileJson(req, 8 * 1024));
    requireCareerVersion(body.apiVersion);
    return body.applicationId ? runCareerAgent(actor, body.message, req.signal, [], body.applicationId) : runCareerAgent(actor, body.message, req.signal);
  });
}
