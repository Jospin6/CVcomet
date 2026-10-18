import { createGoogleGenerativeAI } from "@ai-sdk/google";
import { createOpenAI } from "@ai-sdk/openai";
import { createAnthropic } from "@ai-sdk/anthropic";
import { APICallError, wrapLanguageModel, type LanguageModel } from "ai";
import { ProfileError, profileAIError } from "@/lib/career-profile/http";
import { getActiveAIProvider, getAIProviderConfig } from "./config";
import type { AIProviderId } from "./catalog";

type ModelConfig = { provider: AIProviderId; apiKey: string; model: string; enabled: boolean };
type ModelOptions = { structuredOutputs?: boolean };

// The existing AI SDK uses chat completions. New reasoning models require
// completion-token limits and do not accept sampling parameters.
function providerFetch(provider: AIProviderId): typeof fetch {
  return async (input, init) => {
    let body = init?.body;
    if (provider === "OPENAI" && typeof body === "string") {
      const data = JSON.parse(body);
      if (/^(?:o[134](?:-|$)|gpt-5(?:[.-]|$))/.test(data.model || "")) {
        for (const key of ["temperature", "top_p", "frequency_penalty", "presence_penalty", "logprobs", "top_logprobs"]) delete data[key];
        data.max_completion_tokens = Math.max(data.max_completion_tokens || data.max_tokens || 4096, 4096);
        delete data.max_tokens;
        body = JSON.stringify(data);
      }
    }
    const signal = init?.signal
      ? AbortSignal.any([init.signal, AbortSignal.timeout(45000)]) : AbortSignal.timeout(45000);
    return fetch(input, { ...init, body, signal });
  };
}

export function createAIModel(config: ModelConfig, options: ModelOptions = {}): LanguageModel {
  if (!config.enabled || !config.apiKey || !config.model) throw new ProfileError(503, "AI_UNAVAILABLE");
  const fetcher = providerFetch(config.provider);
  let model: LanguageModel;
  switch (config.provider) {
    case "GOOGLE":
      model = createGoogleGenerativeAI({ apiKey: config.apiKey, fetch: fetcher })(config.model);
      break;
    case "ANTHROPIC":
      model = createAnthropic({ apiKey: config.apiKey, fetch: fetcher })(config.model);
      break;
    case "OPENAI": {
      // Opt in only for known model families supporting strict JSON schemas.
      // Other callers and legacy models retain their existing JSON behavior.
      const supportsSchema = /^(?:gpt-4o-mini(?:-|$)|gpt-4o$|gpt-4o-2024-(?:08-06|11-20)$|gpt-4\.1(?:-|$)|gpt-[5-9](?:[.-]|$)|o[134](?:-|$))/.test(config.model);
      model = createOpenAI({ apiKey: config.apiKey, fetch: fetcher })(config.model, { structuredOutputs: options.structuredOutputs === true && supportsSchema });
      break;
    }
    case "GROQ":
      model = createOpenAI({ apiKey: config.apiKey, fetch: fetcher, compatibility: "compatible", name: "groq",
        baseURL: "https://api.groq.com/openai/v1" })(config.model, { structuredOutputs: false });
      break;
    case "HUGGINGFACE":
      model = createOpenAI({ apiKey: config.apiKey, fetch: fetcher, compatibility: "compatible", name: "huggingface",
        baseURL: "https://router.huggingface.co/v1" })(config.model, { structuredOutputs: false });
      break;
  }
  const wrapped = wrapLanguageModel({
    model,
    middleware: {
      // HF routes to models with different JSON-mode capabilities. The SDK
      // still injects the schema and validates the generated JSON locally.
      transformParams: async ({ params }) => config.provider === "HUGGINGFACE" && params.mode.type === "object-json"
        ? { ...params, mode: { type: "regular" } } : params,
      wrapGenerate: async ({ doGenerate }) => {
        try { return await doGenerate(); } catch (error) {
          // Keep retryable SDK errors intact so maxRetries can actually work.
          if (APICallError.isInstance(error) && error.isRetryable) throw error;
          throw profileAIError(error);
        }
      },
      wrapStream: async ({ doStream }) => {
        try {
          const result = await doStream();
          return { ...result, stream: result.stream.pipeThrough(new TransformStream({
            transform(chunk, controller) {
              controller.enqueue(chunk.type === "error" ? { ...chunk, error: profileAIError(chunk.error) } : chunk);
            },
          })) };
        } catch (error) {
          if (APICallError.isInstance(error) && error.isRetryable) throw error;
          throw profileAIError(error);
        }
      },
    },
  });
  // OpenAI-compatible providers otherwise default to tool calls. JSON mode
  // works for schemas across Groq/HF models without requiring function tools.
  return { ...wrapped, defaultObjectGenerationMode: config.provider === "ANTHROPIC" || config.provider === "GOOGLE"
    ? wrapped.defaultObjectGenerationMode : "json" };
}

export async function getAIModel(options: ModelOptions = {}) {
  const config = await getAIProviderConfig(await getActiveAIProvider());
  return createAIModel(config, options);
}

export async function getAIContext() {
  const config = await getAIProviderConfig(await getActiveAIProvider());
  return { provider: config.provider, modelId: config.model, model: createAIModel(config) };
}
