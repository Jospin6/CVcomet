import { ProfileError, profileAIError } from "@/lib/career-profile/http";
import type { AIModelOption, AIProviderId } from "./catalog";

type ModelEntry = { id?: string; name?: string; displayName?: string; display_name?: string; active?: boolean; supportedGenerationMethods?: string[] };
type ModelPayload = { data?: ModelEntry[]; models?: ModelEntry[]; nextPageToken?: string; has_more?: boolean; last_id?: string };

export async function discoverAIModels(provider: AIProviderId, apiKey: string): Promise<AIModelOption[]> {
  if (!apiKey) throw new ProfileError(400, "AI_KEY_REQUIRED");
  const headers: Record<string, string> = provider === "GOOGLE" ? { "x-goog-api-key": apiKey }
    : provider === "ANTHROPIC" ? { "x-api-key": apiKey, "anthropic-version": "2023-06-01" }
    : { Authorization: "Bearer " + apiKey };
  const urls: Record<AIProviderId, string> = {
    OPENAI: "https://api.openai.com/v1/models",
    GOOGLE: "https://generativelanguage.googleapis.com/v1beta/models?pageSize=1000",
    ANTHROPIC: "https://api.anthropic.com/v1/models?limit=1000",
    HUGGINGFACE: "https://router.huggingface.co/v1/models",
    GROQ: "https://api.groq.com/openai/v1/models",
  };
  try {
    if (provider === "HUGGINGFACE") {
      const identity = await fetch("https://huggingface.co/api/whoami-v2", { headers, cache: "no-store", redirect: "error", signal: AbortSignal.timeout(15000) });
      if (!identity.ok) throw { statusCode: identity.status };
    }
    const models: AIModelOption[] = [];
    let url: string | null = urls[provider];
    // Pagination URLs are constructed locally; remote payloads cannot redirect
    // a request containing the administrator's key to a different host.
    for (let page = 0; url && page < 10; page++) {
      const response: Response = await fetch(url, { headers, cache: "no-store", redirect: "error", signal: AbortSignal.timeout(15000) });
      if (!response.ok) throw { statusCode: response.status, responseBody: await response.text() };
      const payload: ModelPayload = await response.json();
      const entries = payload.data || payload.models || [];
      for (const entry of entries) {
        const id = provider === "GOOGLE" ? entry.name?.replace(/^models\//, "") : entry.id;
        if (!id || entry.active === false) continue;
        if (provider === "GOOGLE" && !entry.supportedGenerationMethods?.includes("generateContent")) continue;
        if (provider === "OPENAI" && /embedding|whisper|tts|dall-e|image|audio|realtime|transcribe|moderation|search|sora/.test(id)) continue;
        if (provider === "GROQ" && /whisper|tts|guard/.test(id)) continue;
        models.push({ id, name: entry.displayName || entry.display_name || id });
      }
      url = provider === "GOOGLE" && payload.nextPageToken
        ? urls.GOOGLE + "&pageToken=" + encodeURIComponent(payload.nextPageToken)
        : provider === "ANTHROPIC" && payload.has_more && payload.last_id
          ? urls.ANTHROPIC + "&after_id=" + encodeURIComponent(payload.last_id) : null;
    }
    return [...new Map(models.map(model => [model.id, model])).values()].sort((a, b) => a.id.localeCompare(b.id));
  } catch (error) { throw profileAIError(error); }
}
