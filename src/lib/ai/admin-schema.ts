import { z } from "zod";
import { AI_PROVIDERS } from "./catalog";

const apiKey = z.string().trim().min(1).max(4096).refine(value => !/[\r\n\u0000]/.test(value));
export const aiProviderSchema = z.object({ provider: z.enum(AI_PROVIDERS) }).strict();
export const aiConfigSchema = z.object({
  provider: z.enum(AI_PROVIDERS), model: z.string().trim().max(200).refine(value => !/[\s\u0000-\u001f]/.test(value)),
  enabled: z.boolean(), apiKey: apiKey.nullable().optional(), useEnvironmentKey: z.boolean().optional(),
}).strict().refine(value => !(value.useEnvironmentKey && value.apiKey !== undefined));
export const aiModelsSchema = z.object({ provider: z.enum(AI_PROVIDERS), apiKey: apiKey.optional() }).strict();
export const aiTestSchema = aiModelsSchema.extend({ model: z.string().trim().min(1).max(200).refine(value => !/[\s\u0000-\u001f]/.test(value)) }).strict();
