import type { AgentRunIdentity } from "../contracts.ts";
import { AgenticError } from "../errors.ts";
import { validateModelRequest, type AgentModelRequest } from "./model-policy.ts";
import type { AIQuotaFeature } from "../../../ai/quota-policy";

export type ValidatedAgentModelRequest = ReturnType<typeof validateModelRequest>;
export type StructuredSchema<T> = Readonly<{ parse: (value: unknown) => T }>;

/** DI seam: keeps tests independent from configured providers and paid APIs. */
export type ModelGatewayDependencies<TModel> = Readonly<{
  loadModel: (structured: boolean) => Promise<TModel>;
  reserveQuota: (actorId: string, feature: AIQuotaFeature) => Promise<unknown>;
  generateText: (model: TModel, request: ValidatedAgentModelRequest, signal: AbortSignal) => Promise<string>;
  generateObject: <T>(model: TModel, request: ValidatedAgentModelRequest,
    schema: StructuredSchema<T>, signal: AbortSignal) => Promise<unknown>;
}>;

export function createAgentModelGateway<TModel>(deps: ModelGatewayDependencies<TModel>) {
  const prepare = async (identity: AgentRunIdentity, request: AgentModelRequest, signal: AbortSignal,
    structured: boolean) => {
    const validated = validateModelRequest(identity, request);
    if (signal.aborted) throw new AgenticError("AGENT_CANCELLED", 499);
    // Reserve before sending data to the model. Quota failure must propagate.
    try {
      await deps.reserveQuota(validated.actorId, validated.feature);
    } catch (error) {
      if (error instanceof AgenticError) throw error;
      const code = error && typeof error === "object" && "code" in error &&
        typeof error.code === "string" ? error.code : "";
      if (["AI_LIMIT", "AI_HOURLY_LIMIT", "AI_MONTHLY_LIMIT"].includes(code)) {
        throw new AgenticError("AGENT_MODEL_QUOTA_DENIED", 429);
      }
      throw new AgenticError("AGENT_MODEL_UNAVAILABLE", 503);
    }
    if (signal.aborted) throw new AgenticError("AGENT_CANCELLED", 499);
    try {
      const model = await deps.loadModel(structured);
      return { model, validated };
    } catch {
      throw new AgenticError("AGENT_MODEL_UNAVAILABLE", 503);
    }
  };

  const safeGenerate = async <T>(work: () => Promise<T>, signal: AbortSignal): Promise<T> => {
    try {
      const value = await work();
      if (signal.aborted) throw new AgenticError("AGENT_CANCELLED", 499);
      return value;
    } catch (error) {
      if (signal.aborted) throw new AgenticError("AGENT_CANCELLED", 499);
      if (error instanceof AgenticError) throw error;
      // Never return provider messages, request contents or raw model output.
      throw new AgenticError("AGENT_MODEL_UNAVAILABLE", 503);
    }
  };

  return {
    async text(identity: AgentRunIdentity, request: AgentModelRequest, signal: AbortSignal): Promise<string> {
      const { model, validated } = await prepare(identity, request, signal, false);
      return safeGenerate(() => deps.generateText(model, validated, signal), signal);
    },
    async object<T>(identity: AgentRunIdentity, request: AgentModelRequest,
      schema: StructuredSchema<T>, signal: AbortSignal): Promise<T> {
      if (!schema || typeof schema.parse !== "function") {
        throw new AgenticError("AGENT_MODEL_INPUT_INVALID", 400);
      }
      const { model, validated } = await prepare(identity, request, signal, true);
      return safeGenerate(async () => schema.parse(
        await deps.generateObject(model, validated, schema, signal)), signal);
    },
  };
}
