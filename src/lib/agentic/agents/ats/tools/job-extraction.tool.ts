import { generateText, type LanguageModel } from "ai";
import { z } from "zod";
import { JOB_MATCH_EXTRACTION_POLICY } from "@/lib/agentic/agents/job-match/prompts/extract.prompt";
import { factualRules } from "@/lib/career-profile/ai";
import { ProfileError } from "@/lib/career-profile/http";
import { validateJobAnalysis } from "@/lib/career/job-match";
import { jobAnalysisSchema } from "@/lib/career/job-schema";
import { parseAtsJsonObject } from "./parse-json.tool";

/** ATS-only text extractor, independent of provider-specific JSON tool calling.
 * The original JD is the sole authority for requirements and citations. */
export async function extractAtsJobRequirements(
  description: string, language: "fr" | "en", model: LanguageModel, signal?: AbortSignal,
) {
  if (description.trim().length < 100 || description.length > 50_000) throw new ProfileError(422, "JOB_DESCRIPTION_REQUIRED");
  for (let attempt = 0; attempt < 2; attempt++) {
    const abortSignal = signal
      ? AbortSignal.any([signal, AbortSignal.timeout(26_000)])
      : AbortSignal.timeout(26_000);
    try {
      const { text } = await generateText({
        model, maxRetries: 0, maxTokens: 7_000, temperature: 0, abortSignal,
        system: factualRules + "\n" + JOB_MATCH_EXTRACTION_POLICY +
          "\nReturn exactly one JSON object; no Markdown. Fields: title, company, location, workMode, contractType, seniority, summary, objective, responsibilities, requiredSkills, preferredSkills, technologies, education, experience, keywords, requirements, warnings. Every missing string is empty and every missing list is empty. Each requirement has id, title, category, priority, description, evidence, ambiguity, terms. Only use verbatim cited phrases from the original posting.",
        prompt: JSON.stringify({
          language, source: description,
          ...(attempt ? { correction: "Return strictly valid JSON with exact source citations. Remove all unsupported requirements, terms, and quotes." } : {}),
        }),
      });
      let parsed: unknown;
      try { parsed = parseAtsJsonObject(text); }
      catch { throw new ProfileError(502, "AI_INVALID_RESPONSE"); }
      const job = jobAnalysisSchema.parse(parsed);
      return validateJobAnalysis(job, description);
    } catch (error) {
      if (signal?.aborted) throw new ProfileError(499, "ATS_CANCELLED");
      const correctable = error instanceof z.ZodError || error instanceof ProfileError &&
        ["AI_INVALID_RESPONSE", "AI_UNSUPPORTED_EVIDENCE"].includes(error.code);
      if (!correctable || attempt === 1) throw error;
      console.warn("ATS job extraction validation retry", { attempt: attempt + 1, reason: error instanceof ProfileError ? error.code : "SCHEMA_INVALID" });
    }
  }
  throw new ProfileError(502, "AI_INVALID_RESPONSE");
}
