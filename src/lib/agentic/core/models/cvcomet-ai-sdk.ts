import { generateObject, generateText, type LanguageModel } from "ai";
import type { ZodType } from "zod";
import { getAIModel } from "../../../ai/model";
import { reserveAIQuota } from "../../../ai/quota-service";
import { AgenticError } from "../errors.ts";
import { createAgentModelGateway } from "./model-gateway.ts";

/**
 * Production port to CVComet's EXISTING active provider and quota service.
 * No new keys, providers, accounting tables or independent model configuration.
 */
export const cvcometAgentModel = createAgentModelGateway<LanguageModel>({
  loadModel: (structured) => getAIModel({ structuredOutputs: structured }),
  reserveQuota: (userId, feature) => reserveAIQuota(userId, feature),
  async generateText(model, request, signal) {
    const response = await generateText({
      model, system: request.system, prompt: request.prompt,
      maxTokens: request.maxTokens, maxRetries: 1, abortSignal: signal,
    });
    return response.text;
  },
  async generateObject<T>(model: LanguageModel, request, schema, signal) {
    // All actual CVComet structured agents must use Zod (not an arbitrary parser).
    if (!("safeParse" in schema) || typeof schema.safeParse !== "function") {
      throw new AgenticError("AGENT_MODEL_INPUT_INVALID", 400);
    }
    const response = await generateObject({
      model, schema: schema as ZodType<T>, system: request.system, prompt: request.prompt,
      maxTokens: request.maxTokens, maxRetries: 1, abortSignal: signal,
    });
    return response.object;
  },
});
