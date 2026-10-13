export const AI_PROVIDERS = ["OPENAI", "GOOGLE", "ANTHROPIC", "HUGGINGFACE", "GROQ"] as const;
export type AIProviderId = typeof AI_PROVIDERS[number];

export const AI_PROVIDER_LABELS: Record<AIProviderId, string> = {
  OPENAI: "OpenAI", GOOGLE: "Google Gemini", ANTHROPIC: "Claude (Anthropic)",
  HUGGINGFACE: "Hugging Face", GROQ: "Groq",
};

export type AIProviderView = {
  provider: AIProviderId;
  label: string;
  model: string;
  enabled: boolean;
  configured: boolean;
  keySource: "database" | "environment" | "none";
  updatedAt: string | null;
};

export type AIAdminView = {
  activeProvider: AIProviderId;
  providers: AIProviderView[];
  canStoreKeys: boolean;
};

export type AIModelOption = { id: string; name: string };
