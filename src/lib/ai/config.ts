import prisma from "../../../prisma/prisma";
import { ProfileError } from "@/lib/career-profile/http";
import { AI_PROVIDERS, AI_PROVIDER_LABELS, type AIProviderId, type AIAdminView } from "./catalog";
import { canStoreAIKeys, decryptAIKey, encryptAIKey } from "./secrets";

const ENV_KEYS: Record<AIProviderId, string[]> = {
  OPENAI: ["OPENAI_API_KEY"], GOOGLE: ["GOOGLE_GENERATIVE_MODEL_API_KEY", "GOOGLE_API_KEY"],
  ANTHROPIC: ["ANTHROPIC_API_KEY"], HUGGINGFACE: ["HUGGINGFACE_API_KEY", "HF_TOKEN"], GROQ: ["GROQ_API_KEY"],
};
const ENV_MODELS: Record<AIProviderId, string> = {
  OPENAI: "OPENAI_MODEL", GOOGLE: "GEMINI_MODEL", ANTHROPIC: "ANTHROPIC_MODEL",
  HUGGINGFACE: "HUGGINGFACE_MODEL", GROQ: "GROQ_MODEL",
};

function environmentKey(provider: AIProviderId) {
  return ENV_KEYS[provider].map(name => process.env[name]?.trim()).find(Boolean) || "";
}
function environmentModel(provider: AIProviderId) {
  return process.env[ENV_MODELS[provider]]?.trim() ||
    (provider === "GOOGLE" ? "gemini-3.5-flash" : provider === "OPENAI" ? "gpt-4o-mini" : "");
}
function initialProvider(): AIProviderId {
  const candidate = process.env.AI_PROVIDER?.toUpperCase();
  return AI_PROVIDERS.find(p => p === candidate) || "GOOGLE";
}

export async function getActiveAIProvider(): Promise<AIProviderId> {
  const settings = await prisma.aISettings.findUnique({ where: { id: "global" } });
  return settings?.activeProvider || initialProvider();
}

export async function getAIProviderConfig(provider: AIProviderId) {
  const saved = await prisma.aIProviderConfig.findUnique({ where: { provider } });
  const keySource = saved?.encryptedApiKey ? "database" : (!saved || saved.useEnvironmentKey) && environmentKey(provider) ? "environment" : "none";
  return {
    provider, model: saved?.model ?? environmentModel(provider), enabled: saved?.enabled ?? true,
    apiKey: saved?.encryptedApiKey ? decryptAIKey(saved.encryptedApiKey, provider) : keySource === "environment" ? environmentKey(provider) : "",
    keySource, updatedAt: saved?.updatedAt.toISOString() || null,
  };
}

export async function getAIAdminView(): Promise<AIAdminView> {
  const [activeProvider, saved] = await Promise.all([
    getActiveAIProvider(), prisma.aIProviderConfig.findMany(),
  ]);
  return {
    activeProvider, canStoreKeys: canStoreAIKeys(),
    providers: AI_PROVIDERS.map(provider => {
      const row = saved.find(config => config.provider === provider);
      const keySource = row?.encryptedApiKey ? "database" : (!row || row.useEnvironmentKey) && environmentKey(provider) ? "environment" : "none";
      return { provider, label: AI_PROVIDER_LABELS[provider], model: row?.model ?? environmentModel(provider),
        enabled: row?.enabled ?? true, configured: keySource !== "none", keySource,
        updatedAt: row?.updatedAt.toISOString() || null };
    }),
  };
}

export async function saveAIProviderConfig(provider: AIProviderId, input: {
  model: string; enabled: boolean; apiKey?: string | null; useEnvironmentKey?: boolean;
}, adminId: string) {
  const keyChange = input.useEnvironmentKey
    ? { encryptedApiKey: null, useEnvironmentKey: true }
    : input.apiKey === null ? { encryptedApiKey: null, useEnvironmentKey: false }
    : input.apiKey ? { encryptedApiKey: encryptAIKey(input.apiKey, provider), useEnvironmentKey: false } : {};
  const data = { model: input.model, enabled: input.enabled, updatedBy: adminId, ...keyChange };
  await configurationTransaction(async tx => {
    const [settings, existing] = await Promise.all([
      tx.aISettings.findUnique({ where: { id: "global" } }),
      tx.aIProviderConfig.findUnique({ where: { provider } }),
    ]);
    // Replacing/removing a key must also work after an encryption-secret change.
    const configured = input.useEnvironmentKey ? Boolean(environmentKey(provider)) : input.apiKey === null ? false
      : Boolean(input.apiKey || existing?.encryptedApiKey || ((!existing || existing.useEnvironmentKey) && environmentKey(provider)));
    if ((settings?.activeProvider || initialProvider()) === provider && (!input.enabled || !configured || !input.model)) {
      throw new ProfileError(409, "AI_ACTIVE_PROVIDER_REQUIRED");
    }
    await tx.aIProviderConfig.upsert({ where: { provider }, create: { provider, ...data }, update: data });
  });
}

export async function activateAIProvider(provider: AIProviderId, adminId: string) {
  await configurationTransaction(async tx => {
    const saved = await tx.aIProviderConfig.findUnique({ where: { provider } });
    const key = saved?.encryptedApiKey ? decryptAIKey(saved.encryptedApiKey, provider)
      : !saved || saved.useEnvironmentKey ? environmentKey(provider) : "";
    if (!(saved?.enabled ?? true) || !key || !(saved?.model ?? environmentModel(provider))) throw new ProfileError(400, "AI_PROVIDER_NOT_READY");
    await tx.aISettings.upsert({ where: { id: "global" },
      create: { id: "global", activeProvider: provider, updatedBy: adminId },
      update: { activeProvider: provider, updatedBy: adminId },
    });
  });
}

async function configurationTransaction<T>(operation: (tx: import("@prisma/client").Prisma.TransactionClient) => Promise<T>): Promise<T> {
  for (let attempt = 0; ; attempt++) {
    try { return await prisma.$transaction(operation, { isolationLevel: "Serializable" }); }
    catch (error) {
      if (attempt >= 2 || !error || typeof error !== "object" || !("code" in error) || error.code !== "P2034") throw error;
    }
  }
}
