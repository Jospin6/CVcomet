import { getAIProviderConfig } from "@/lib/ai/config";
import { discoverAIModels } from "@/lib/ai/models";
import { aiModelsSchema } from "@/lib/ai/admin-schema";
import { requireAIAdmin, aiAdminBody, aiAdminResponse, aiAdminError } from "@/lib/ai/admin-http";

export const maxDuration = 60;
export async function POST(req: Request) {
  try {
    await requireAIAdmin(req, true);
    const input = aiModelsSchema.parse(await aiAdminBody(req));
    const key = input.apiKey || (await getAIProviderConfig(input.provider)).apiKey;
    return aiAdminResponse({ models: await discoverAIModels(input.provider, key) });
  } catch (error) { return aiAdminError(error); }
}
