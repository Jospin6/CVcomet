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
import { resumeContentSchema } from "@/lib/resume-editor";
import { marketPrompt } from "@/lib/career-localization/markets";

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
    const storedCV = body.cvId ? await prisma.cv.findFirst({ where: { id: body.cvId, conversation: { userId: user.id } }, select: { id: true, design: true } }) : null;
    if (body.cvId && !storedCV) throw new ProfileError(404, "NOT_FOUND");
    const confirmedEvidence = await prisma.careerEvidence.findMany({ where: { userId: user.id, status: "CONFIRMED" },
      orderBy: { updatedAt: "desc" }, take: 30, select: { kind: true, statement: true, sourceLabel: true } });
    const authoritativeDesign = storedCV ? resumeContentSchema.shape.design.parse(storedCV.design ?? {}) : body.draft?.design;
    const { design: _design, ...resumeFacts } = body.draft || {};
    const facts = { text: body.text, notes: body.notes, resume: resumeFacts, confirmedEvidence };
    const relevant = body.text.trim() || body.notes.trim() || body.draft?.summary.some(value => value.trim()) || body.draft?.skills.some(value => value.hardskills.trim() || value.softskills.trim() || value.tools.trim()) || body.draft?.experiences.some(value => value.title.trim() || value.company.trim() || value.description.length) || body.draft?.educations.some(value => value.degree.trim() || value.school.trim()) || body.draft?.projects.some(value => value.title.trim() || value.description.trim()) || body.draft?.certifications.some(value => value.title.trim()) || confirmedEvidence.length > 0;
    if (!relevant) throw new ProfileError(422, "AI_FACTS_REQUIRED");
    const model = await getAIModel();
    await reserveProfileAI(user.id, "RESUME_EDIT");
    const result = await generateText({ model, maxRetries: 1, maxTokens: 1800, abortSignal: AbortSignal.timeout(45000),
      system: factualRules + "\n" + marketPrompt(authoritativeDesign?.targetMarket ?? "GLOBAL", authoritativeDesign?.documentLanguage ?? "auto", body.language) + "\nYou help a candidate write their resume. Only use candidate facts in the supplied resume, profile, source text or notes. A target job title is a goal, not proof of qualifications. Respond with replacement resume field text in the document writing language from the market policy; the UI conversation language is not automatically the document language. For GENERATE, draft concise professional text grounded in those facts. For other actions, rewrite only the selected text without expanding its factual scope. Profile imports that have not been explicitly confirmed must not be treated as evidence. Confirmation is by the owner, not an independent verification. Return ONLY the replacement text, no heading, code fence, explanations or invented placeholders. For experience/education bullet text, return one bullet per line without bullet symbols. Do not repeat contact details in a summary.",
      prompt: JSON.stringify({ action: body.action, selectedField: body.field, language: body.language, candidateFacts: facts }),
    });
    const proposal = result.text.trim().replace(/^```(?:text)?\s*|\s*```$/g, "").trim();
    if (!proposal) throw new ProfileError(502, "AI_INVALID_RESPONSE");
    const unexpectedNumbers = unsupportedNumericClaims([{ type: "setField", value: proposal }],
      [body.text, body.notes, JSON.stringify(resumeFacts), ...confirmedEvidence.map(row => row.statement)]);
    if (unexpectedNumbers.length) throw new ProfileError(422, "UNSUPPORTED_FACTS");
    return NextResponse.json({ proposal: proposal.slice(0, 8000) }, { headers: { "Cache-Control": "no-store" } });
  } catch (error) { return apiError(error); }
}
