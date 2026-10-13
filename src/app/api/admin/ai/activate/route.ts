import { activateAIProvider, getAIAdminView } from "@/lib/ai/config";
import { aiProviderSchema } from "@/lib/ai/admin-schema";
import { requireAIAdmin, aiAdminBody, aiAdminResponse, aiAdminError } from "@/lib/ai/admin-http";

export async function POST(req: Request) {
  try {
    const user = await requireAIAdmin(req, true);
    const { provider } = aiProviderSchema.parse(await aiAdminBody(req));
    await activateAIProvider(provider, user.id);
    return aiAdminResponse(await getAIAdminView());
  } catch (error) { return aiAdminError(error); }
}
