import { getAIAdminView, saveAIProviderConfig } from "@/lib/ai/config";
import { aiConfigSchema } from "@/lib/ai/admin-schema";
import { requireAIAdmin, aiAdminBody, aiAdminResponse, aiAdminError } from "@/lib/ai/admin-http";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET(req: Request) {
  try { await requireAIAdmin(req); return aiAdminResponse(await getAIAdminView()); }
  catch (error) { return aiAdminError(error); }
}
export async function PATCH(req: Request) {
  try {
    const user = await requireAIAdmin(req, true);
    const { provider, ...input } = aiConfigSchema.parse(await aiAdminBody(req));
    await saveAIProviderConfig(provider, input, user.id);
    return aiAdminResponse(await getAIAdminView());
  } catch (error) { return aiAdminError(error); }
}
