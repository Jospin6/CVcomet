import { NextResponse } from "next/server";
import { z } from "zod";
import prisma from "../../../../prisma/prisma";
import { requireUser } from "@/lib/career/auth-user";
import { apiError } from "@/lib/career/api";
import { ProfileError, profileJson } from "@/lib/career-profile/http";
import { factualRules } from "@/lib/career-profile/ai";
import { runResumeFieldAgent } from "@/lib/agentic/agents/resume/agent/field.agent";
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
    const generated = await runResumeFieldAgent({
      actorId: user.id,
      signal: req.signal,
      input: {
        action: body.action, field: body.field, language: body.language,
        systemPolicy: factualRules + "\n" + marketPrompt(
          authoritativeDesign?.targetMarket ?? "GLOBAL",
          authoritativeDesign?.documentLanguage ?? "auto", body.language,
        ),
        facts,
        candidateSources: [body.text, body.notes, JSON.stringify(resumeFacts),
          ...factsFromProfile.map(row => row.statement)],
      },
    });
    if ("issue" in generated) {
      throw new ProfileError(generated.issue === "UNSUPPORTED_FACTS" ? 422 : 502, "AI_INVALID_RESPONSE");
    }
    const proposal = generated.proposal;
    const unexpectedNumbers = unsupportedNumericClaims([{ type: "setField", value: proposal }],
      [body.text, body.notes, JSON.stringify(resumeFacts), ...factsFromProfile.map(row => row.statement)]);
    if (unexpectedNumbers.length) throw new ProfileError(422, "UNSUPPORTED_FACTS");
    return NextResponse.json({ proposal: proposal.slice(0, 8000) }, { headers: { "Cache-Control": "no-store" } });
  } catch (error) { return apiError(error); }
}
