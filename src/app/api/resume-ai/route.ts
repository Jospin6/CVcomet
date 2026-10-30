import { NextResponse } from "next/server";
import { generateText } from "ai";
import { z } from "zod";
import prisma from "../../../../prisma/prisma";
import { getAIModel } from "@/lib/ai/model";
import { requireUser } from "@/lib/career/auth-user";
import { apiError } from "@/lib/career/api";
import { ProfileError, profileJson } from "@/lib/career-profile/http";
import { factualRules, reserveProfileAI } from "@/lib/career-profile/ai";
import { unsupportedNumericClaims } from "@/lib/resume-ai/review";
import { normalizeEditorResume, resumeContentSchema } from "@/lib/resume-editor";
import { marketPrompt } from "@/lib/career-localization/markets";
import { getCareerProfile, careerProfileContext } from "@/lib/career-profile/service";
import { profileFacts } from "@/lib/career-profile/ai-facts";

const input = z.object({
  cvId: z.string().uuid().optional(), text: z.string().max(8000).default(""),
  action: z.enum(["GENERATE", "IMPROVE", "SHORTEN", "PROFESSIONAL", "GRAMMAR", "ATS"]),
  field: z.string().max(120).default("summary"), notes: z.string().max(8000).default(""),
  language: z.enum(["fr", "en"]).default("fr"), draft: resumeContentSchema.optional(),
}).strict();
export const maxDuration = 60;
export async function POST(req: Request) {
  try {
    const user = await requireUser();
    const body = input.parse(await profileJson(req));
    const storedCV = body.cvId ? await prisma.cv.findFirst({ where: { id: body.cvId, conversation: { userId: user.id } } }) : null;
    if (body.cvId && !storedCV) throw new ProfileError(404, "NOT_FOUND");
    const profile = await getCareerProfile(user.id);
    const factsFromProfile = profileFacts(profile);
    const authoritativeDesign = storedCV ? resumeContentSchema.shape.design.parse(storedCV.design ?? {}) : body.draft?.design;
    const resolvedResume = body.draft ?? (storedCV ? normalizeEditorResume(storedCV as unknown as Record<string, unknown>) : undefined);
    const { design: _design, ...resumeFacts } = resolvedResume ?? {};
    const facts = { text: body.text, notes: body.notes, resume: resumeFacts, careerProfile: careerProfileContext(profile), factsFromProfile };
    const relevant = body.text.trim() || body.notes.trim() || resolvedResume?.summary.some(value => value.trim()) || resolvedResume?.skills.some(value => value.hardskills.trim() || value.softskills.trim() || value.tools.trim()) || resolvedResume?.experiences.some(value => value.title.trim() || value.company.trim() || value.description.length) || resolvedResume?.educations.some(value => value.degree.trim() || value.school.trim()) || resolvedResume?.projects.some(value => value.title.trim() || value.description.trim()) || resolvedResume?.certifications.some(value => value.title.trim()) || factsFromProfile.length > 0;
    if (!relevant) throw new ProfileError(422, "AI_FACTS_REQUIRED");
    const model = await getAIModel();
    await reserveProfileAI(user.id, "RESUME_EDIT");
    const result = await generateText({ model, maxRetries: 1, maxTokens: 1800, abortSignal: AbortSignal.timeout(45000),
      system: factualRules + "\n" + marketPrompt(authoritativeDesign?.targetMarket ?? "GLOBAL", authoritativeDesign?.documentLanguage ?? "auto", body.language) + "\nYou help a candidate write their resume. Only use candidate facts in the supplied resume, profile, source text or notes. A target job title is a goal, not proof of qualifications. Respond with replacement resume field text in the document writing language from the market policy; the UI conversation language is not automatically the document language. For GENERATE, draft concise professional text grounded in those facts. For other actions, rewrite only the selected text without expanding its factual scope. Career profile information is self-reported and editable by the account owner, not independently verified. Return ONLY the replacement text, no heading, code fence, explanations or invented placeholders. For experience/education bullet text, return one bullet per line without bullet symbols. Do not repeat contact details in a summary.",
      prompt: JSON.stringify({ action: body.action, selectedField: body.field, language: body.language, candidateFacts: facts }),
    });
    const proposal = result.text.trim().replace(/^```(?:text)?\s*|\s*```$/g, "").trim();
    if (!proposal) throw new ProfileError(502, "AI_INVALID_RESPONSE");
    const unexpectedNumbers = unsupportedNumericClaims([{ type: "setField", value: proposal }],
      [body.text, body.notes, JSON.stringify(resumeFacts), ...factsFromProfile.map(row => row.statement)]);
    if (unexpectedNumbers.length) throw new ProfileError(422, "UNSUPPORTED_FACTS");
    return NextResponse.json({ proposal: proposal.slice(0, 8000) }, { headers: { "Cache-Control": "no-store" } });
  } catch (error) { return apiError(error); }
}
