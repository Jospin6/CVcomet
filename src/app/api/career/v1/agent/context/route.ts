import { z } from "zod";
import { getSessionUser } from "@/lib/auth";
import { ProfileError } from "@/lib/career-profile/http";
import { withCareerHttp } from "@/lib/career-os/http";
import { executeCareerReadTool } from "@/lib/career-os/tool-registry";
export async function GET(req: Request) {
  return withCareerHttp("agent.context", async () => {
    const actor = await getSessionUser();
    if (!actor) throw new ProfileError(401, "UNAUTHORIZED");
    const id = z.string().uuid().parse(new URL(req.url).searchParams.get("applicationId"));
    return executeCareerReadTool(actor, "get_my_application", { applicationId: id });
  });
}
