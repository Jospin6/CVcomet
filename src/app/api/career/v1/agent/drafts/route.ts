import { z } from "zod";
import { getSessionUser } from "@/lib/auth";
import { ProfileError, profileJson } from "@/lib/career-profile/http";
import { assertTrustedWriteOrigin } from "@/lib/security/request-origin";
import { withCareerHttp } from "@/lib/career-os/http";
import { proposeApplicationDraft } from "@/lib/career-os/application-drafts";
export const runtime = "nodejs";
export const maxDuration = 90;
const input = z.object({ apiVersion: z.literal("v1"), applicationId: z.string().uuid(), kind: z.enum(["resume", "letter"]), instruction: z.string().trim().min(5).max(4000), language: z.enum(["fr", "en"]).default("fr") }).strict();
export async function POST(req: Request) {
  return withCareerHttp("agent.drafts.propose", async () => {
    assertTrustedWriteOrigin(req);
    const actor = await getSessionUser();
    if (!actor) throw new ProfileError(401, "UNAUTHORIZED");
    const body = input.parse(await profileJson(req, 8 * 1024));
    return proposeApplicationDraft(actor.id, body.applicationId, body.kind, body.instruction, body.language);
  });
}
