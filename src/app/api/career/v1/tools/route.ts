import { getSessionUser } from "@/lib/auth";
import { ProfileError, profileJson } from "@/lib/career-profile/http";
import { requireCareerVersion } from "@/lib/career-os/contracts";
import { assertTrustedWriteOrigin } from "@/lib/security/request-origin";
import { withCareerHttp } from "@/lib/career-os/http";
import { availableCareerTools, executeCareerReadTool, toolRequestSchema } from "@/lib/career-os/tool-registry";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/** Introspection requires a live user session and never reveals private data. */
export async function GET() {
  return withCareerHttp("tools.catalog", async () => {
    const actor = await getSessionUser();
    if (!actor) throw new ProfileError(401, "UNAUTHORIZED");
    return { tools: availableCareerTools() };
  });
}

/** Explicitly read-only. Later write tools must use separate approval gates. */
export async function POST(req: Request) {
  return withCareerHttp("tools.read", async () => {
    assertTrustedWriteOrigin(req);
    const actor = await getSessionUser();
    if (!actor) throw new ProfileError(401, "UNAUTHORIZED");
    const body = toolRequestSchema.parse(await profileJson(req, 8 * 1024));
    requireCareerVersion(body.apiVersion);
    return { tool: body.tool, result: await executeCareerReadTool(actor, body.tool, body.input) };
  });
}
