import { createHash } from "node:crypto";
import { generateObject } from "ai";
import { Prisma } from "@prisma/client";
import { z } from "zod";
import prisma from "../../../prisma/prisma";
import { coverLetterSchema } from "@/helpers/schema";
import { getAIModel } from "@/lib/ai/model";
import { factualRules, reserveProfileAI } from "@/lib/career-profile/ai";
import { careerProfileContext, getCareerProfile } from "@/lib/career-profile/service";
import { ProfileError, profileAIError } from "@/lib/career-profile/http";
import { normalizeEditorResume } from "@/lib/resume-editor";
import { marketPrompt, resolveDocumentLanguage } from "@/lib/career-localization/markets";
import { runCoverLetterCreationAgent } from "@/lib/agentic/agents/cover-letter/agent/creation.agent";
import { requireFeature } from "./entitlements";
import { canonicalTerm, careerEvidence } from "./job-match";
import { jobAnalysisSchema } from "./job-schema";

const emailSchema = z.object({ subject: z.string().trim().min(1).max(300), body: z.string().trim().min(1).max(12000) }).strict();
const letterSchema = coverLetterSchema.shape.coverLetter;
const common = { jobId: z.string().uuid(), cvId: z.string().uuid().optional(), action: z.enum(["GENERATE", "SAVE"]).default("GENERATE"), language: z.enum(["fr", "en"]).default("en"), notes: z.string().max(4000).default("") };
// A letter can start from confirmed profile evidence; an application-specific
// CV is attached automatically as soon as one exists.
const letterInput = z.object({ ...common, draft: letterSchema.optional() }).strict();
const emailInput = z.object({ ...common, draft: emailSchema.optional() }).strict();
const draftsSchema = z.object({
  letter: z.object({ fingerprint: z.string(), draft: letterSchema }).optional(),
  email: z.object({ fingerprint: z.string(), draft: emailSchema }).optional(),
}).default({});
type Drafts = z.infer<typeof draftsSchema>;

export function assertDocumentFacts(text: string, candidateFacts: string, technicalRequirements: string[], signature: string[] = []) {
  const content = signature.reduce((value, contact) => contact.trim() ? value.split(contact).join("") : value, text);
  const numbers = new Set(candidateFacts.match(/\d+(?:[.,]\d+)?/g) || []);
  if ((content.match(/\d+(?:[.,]\d+)?/g) || []).some(number => !numbers.has(number))) throw new ProfileError(422, "UNSUPPORTED_FACTS");
  const output = " " + canonicalTerm(content) + " ", facts = " " + canonicalTerm(candidateFacts) + " ";
  if (technicalRequirements.some(term => output.includes(" " + canonicalTerm(term) + " ") && !facts.includes(" " + canonicalTerm(term) + " "))) throw new ProfileError(422, "UNSUPPORTED_FACTS");
}

async function saveDrafts(userId: string, jobId: string, value: Partial<Drafts>) {
  await prisma.$transaction(async tx => {
    const job = await tx.jobOpportunity.findFirst({ where: { id: jobId, userId } });
    if (!job) throw new ProfileError(404, "NOT_FOUND");
    const drafts = draftsSchema.safeParse(job.documentDrafts);
    await tx.jobOpportunity.update({ where: { id: jobId }, data: { documentDrafts: { ...(drafts.success ? drafts.data : {}), ...value } as Prisma.InputJsonValue } });
  });
}

async function context(userId: string, body: z.infer<typeof letterInput> | z.infer<typeof emailInput>) {
  const job = await prisma.jobOpportunity.findFirst({ where: { id: body.jobId, userId } });
  if (!job) throw new ProfileError(404, "NOT_FOUND");
  const profile = await getCareerProfile(userId);
  const cv = body.cvId ? await prisma.cv.findFirst({ where: { id: body.cvId, conversation: { userId } } }) : null;
  if (body.cvId && !cv) throw new ProfileError(404, "RESUME_NOT_FOUND");
  const resume = cv ? normalizeEditorResume(cv as unknown as Record<string, unknown>) : undefined;
  const confirmedProfile = careerProfileContext(profile);
  const professionalFacts = careerEvidence(profile, resume).map(item => item.quote).join("\n") + "\n" + body.notes;
  if (!professionalFacts.trim()) throw new ProfileError(422, "AI_FACTS_REQUIRED");
  const facts = professionalFacts;
  const parsed = jobAnalysisSchema.safeParse(job.analysis);
  const technicalRequirements = parsed.success ? parsed.data.requirements.filter(item => item.category === "TECHNICAL").flatMap(item => item.terms) : [];
  const localization = marketPrompt(resume?.design.targetMarket ?? "GLOBAL", resume?.design.documentLanguage ?? "auto", body.language);
  const documentLanguage = resolveDocumentLanguage(resume?.design.targetMarket ?? "GLOBAL", resume?.design.documentLanguage ?? "auto", body.language);
  const fingerprint = createHash("sha256").update(JSON.stringify({ job: job.description, profile: confirmedProfile, resume, notes: body.notes, language: body.language, localization })).digest("hex");
  const drafts = draftsSchema.safeParse(job.documentDrafts);
  return { job, profile, resume, confirmedProfile, facts, technicalRequirements, fingerprint, localization, documentLanguage, drafts: drafts.success ? drafts.data : {} };
}

export async function jobCoverLetter(userId: string, raw: unknown) {
  const body = letterInput.parse(raw), data = await context(userId, body);
  if (body.action === "SAVE") {
    if (!body.draft) throw new ProfileError(400, "VALIDATION");
    const draft = { ...body.draft, recipientTitle: body.draft.recipientTitle || "", companyName: data.job.company || "", positionTitle: data.job.title, senderName: data.profile.name, senderEmail: data.profile.email, senderPhone: data.profile.phone, senderAddress: data.profile.address, sendertitle: data.profile.headline };
    const { date: _date, ...fields } = draft;
    const existing = await prisma.coverLetter.findFirst({ where: { jobId: data.job.id, cvId: body.cvId ?? null, conversation: { userId } } });
    const letter = existing ? await prisma.coverLetter.update({ where: { id: existing.id }, data: { ...fields, revision: { increment: 1 } } })
      : await prisma.coverLetter.create({ data: { ...fields, design: data.resume ? { targetMarket: data.resume.design.targetMarket, documentLanguage: data.resume.design.documentLanguage, paper: data.resume.design.paper } : undefined, ...(body.cvId ? { cv: { connect: { id: body.cvId } } } : {}), job: { connect: { id: data.job.id } }, conversation: { create: { userId, title: data.job.title, content: data.job.description } } } });
    await saveDrafts(userId, data.job.id, { letter: { fingerprint: data.fingerprint, draft } });
    await prisma.jobApplication.updateMany({ where: { userId, jobId: data.job.id }, data: { coverLetterId: letter.id } });
    return { draft, letterId: letter.id, conversationId: letter.conversationId, saved: true };
  }
  await requireFeature(userId, "COVER_LETTER");
  if (data.drafts.letter?.fingerprint === data.fingerprint) return { draft: data.drafts.letter.draft, reused: true };
  try {
    // The graph returns a draft only. The existing SAVE branch still owns writes.
    const draft = await runCoverLetterCreationAgent({
      actorId: userId,
      input: {
        job: { title: data.job.title, company: data.job.company || "",
          description: data.job.description },
        profile: { name: data.profile.name, email: data.profile.email,
          phone: data.profile.phone, address: data.profile.address,
          headline: data.profile.headline },
        confirmedProfile: data.confirmedProfile,
        resume: data.resume,
        notes: body.notes,
        localization: data.localization,
        documentLanguage: data.documentLanguage,
        facts: data.facts,
        technicalRequirements: data.technicalRequirements,
      },
    });
    assertDocumentFacts([draft.introduction, draft.body, draft.conclusion].join("\n"), data.facts, data.technicalRequirements);
    await saveDrafts(userId, data.job.id, { letter: { fingerprint: data.fingerprint, draft } });
    return { draft };
  } catch (error) { throw profileAIError(error); }
}

export async function jobApplicationEmail(userId: string, raw: unknown) {
  const body = emailInput.parse(raw), data = await context(userId, body);
  if (body.action === "SAVE") {
    if (!body.draft) throw new ProfileError(400, "VALIDATION");
    await saveDrafts(userId, data.job.id, { email: { fingerprint: data.fingerprint, draft: body.draft } });
    return { ...body.draft, saved: true };
  }
  await requireFeature(userId, "COVER_LETTER");
  if (data.drafts.email?.fingerprint === data.fingerprint) return { ...data.drafts.email.draft, reused: true };
  const model = await getAIModel(); await reserveProfileAI(userId, "APPLICATION_EMAIL");
  try {
    const { object } = await generateObject({ model, schema: emailSchema, temperature: 0, maxTokens: 1200, maxRetries: 1, abortSignal: AbortSignal.timeout(45000),
      system: factualRules + "\n" + data.localization + "\nWrite a concise application email: subject, generic greeting, introduction, target role, one or two evidenced strengths, polite close and the provided candidate signature. Do not invent a recruiter email or motivations. Do not mention technologies absent from candidate evidence. Do not include numbers absent from candidate evidence.",
      prompt: JSON.stringify({ language: data.documentLanguage, jobDescription: data.job.description, confirmedProfile: data.confirmedProfile, candidateResume: data.resume, notes: body.notes }) });
    const email = emailSchema.parse(object);
    assertDocumentFacts(email.body, data.facts, data.technicalRequirements, [data.profile.name, data.profile.email, data.profile.phone, data.profile.address]);
    await saveDrafts(userId, data.job.id, { email: { fingerprint: data.fingerprint, draft: email } });
    return email;
  } catch (error) { throw profileAIError(error); }
}
