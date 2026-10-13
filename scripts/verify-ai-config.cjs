// Read-only check of the active database/environment configuration. No generation.
require("@next/env").loadEnvConfig(process.cwd());
const loader = require("./source-loader.cjs");
const prisma = require("@prisma/client");
const client = new prisma.PrismaClient();
const path = require("node:path");
const load = loader({ [path.resolve(__dirname, "../prisma/prisma.ts")]: client });

async function main() {
  const { getActiveAIProvider, getAIProviderConfig } = load("src/lib/ai/config.ts");
  const { discoverAIModels } = load("src/lib/ai/models.ts");
  const config = await getAIProviderConfig(await getActiveAIProvider());
  if (!config.enabled || !config.apiKey || !config.model) throw new Error("AI_UNAVAILABLE");
  const models = await discoverAIModels(config.provider, config.apiKey);
  // Hugging Face supports an optional routing suffix after the model ID.
  const selected = config.provider === "HUGGINGFACE" ? config.model.split(":")[0] : config.model;
  if (!models.some(model => model.id === selected)) throw new Error("AI_MODEL_UNAVAILABLE");
  console.log(`Active AI configuration: ${config.provider} / ${config.model}. Key accepted by the model catalogue.`);
  console.log("No document submitted and no generation performed. Use the admin model test to check generation.");
}
main().catch(error => {
  const known = new Set(["AI_UNAVAILABLE", "AI_AUTH_ERROR", "AI_RATE_LIMIT", "AI_TIMEOUT", "AI_MODEL_UNAVAILABLE", "AI_KEY_UNREADABLE", "AI_KEY_REQUIRED"]);
  const code = error?.code || error?.message;
  console.error("AI configuration check failed:", known.has(code) ? code : "AI_FAILED");
  process.exitCode = 1;
}).finally(() => client.$disconnect());
