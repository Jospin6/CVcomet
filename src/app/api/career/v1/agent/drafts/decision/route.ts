import { z } from "zod";
import { getSessionUser } from "@/lib/auth";
import { ProfileError, profileJson } from "@/lib/career-profile/http";
import { assertTrustedWriteOrigin } from "@/lib/security/request-origin";
import { withCareerHttp } from "@/lib/career-os/http";
import { decideApplicationDraft } from "@/lib/career-os/application-drafts";
export const runtime = "nodejs";
const input = z.object({ apiVersion: z.literal("v1"), applicationId: z.string().uuid(), kind: z.enum(["resume", "letter"]), proposalId: z.string().uuid(), action: z.enum(["accept", "discard"]) }).strict();
export async function POST(req: Request) {
  return withCareerHttp("agent.drafts.decide", async () => {
    assertTrustedWriteOrigin(req);
    const actor = await getSessionUser();
    if (!actor) throw new ProfileError(401, "UNAUTHORIZED");
    const body = input.parse(await profileJson(req, 8 * 1024));
    return decideApplicationDraft(actor.id, body.applicationId, body.kind, body.proposalId, body.action);
  });
}
