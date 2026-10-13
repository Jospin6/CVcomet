import { generateObject } from "ai";
import { z } from "zod";
import { getAIProviderConfig } from "@/lib/ai/config";
import { createAIModel } from "@/lib/ai/model";
import { aiTestSchema } from "@/lib/ai/admin-schema";
import { requireAIAdmin, aiAdminBody, aiAdminResponse, aiAdminError } from "@/lib/ai/admin-http";

export const maxDuration = 60;
export async function POST(req: Request) {
  try {
    await requireAIAdmin(req, true);
    const input = aiTestSchema.parse(await aiAdminBody(req));
    const apiKey = input.apiKey || (await getAIProviderConfig(input.provider)).apiKey;
    const started = Date.now();
    await generateObject({ model: createAIModel({ ...input, apiKey, enabled: true }),
      schema: z.object({ ok: z.literal(true) }), prompt: 'Return the JSON object {"ok":true}.',
      maxTokens: 512, maxRetries: 0, abortSignal: AbortSignal.timeout(45000),
    });
    return aiAdminResponse({ ok: true, latencyMs: Date.now() - started });
  } catch (error) { return aiAdminError(error); }
}
