import { createHash, randomUUID } from "node:crypto";
import { generateObject } from "ai";
import { Prisma } from "@prisma/client";
import { z } from "zod";
import prisma from "../../../prisma/prisma";
import { getAIModel } from "@/lib/ai/model";
import { factualRules, reserveProfileAI } from "@/lib/career-profile/ai";
import { ProfileError, profileAIError } from "@/lib/career-profile/http";
import { fieldValue, normalizeEditorResume, resumeContentSchema, setResumeField, type EditorResume } from "@/lib/resume-editor";
import { requireFeature } from "./entitlements";
import { jobAnalysisSchema, type TailorChange, type TailorProposal } from "./job-schema";

const propose = z.object({ action: z.literal("PROPOSE"), matchId: z.string().uuid(), cvId: z.string().uuid(), mode: z.enum(["TAILOR", "IMPROVE"]).default("TAILOR"), language: z.enum(["fr", "en"]).default("en") }).strict();
const accept = z.object({ action: z.literal("ACCEPT"), matchId: z.string().uuid(), proposalId: z.string().uuid(), paths: z.array(z.string().max(120)).min(1).max(100) }).strict();
const reject = z.object({ action: z.literal("REJECT"), matchId: z.string().uuid() }).strict();
export const tailorInput = z.discriminatedUnion("action", [propose, accept, reject]);
const generated = z.object({ changes: z.array(z.object({ path: z.string().max(120), text: z.string().max(8000), reason: z.string().max(1000), evidence: z.string().max(1600) }).strict()).max(100) }).strict();
const allowedPath = /^(?:summary\.\d+|experiences\.\d+\.description|skills\.\d+\.(?:hardskills|softskills|tools)|projects\.\d+\.description)$/;
const tokens = (text: string) => text.toLowerCase().normalize("NFD").replace(/\p{M}/gu, "").match(/[\p{L}\p{N}+#]+/gu) || [];
const connectors = new Set("a an the and or with for to of in on by from as at is are was were be been being that which this these those my our i we it its their de du des le la les un une et ou avec pour dans par sur au aux en ce cette ces qui que dont mon ma mes notre nos je nous il elle ils elles est sont ete etre d l s a".split(" "));

// New content words, proper nouns, technologies and numbers are rejected.
// The model can improve word order, punctuation and connecting words, using
// only each field's own facts. It cannot transfer an unrelated skill to a role.
export function isGroundedResumeChange(current: string, proposed: string) {
  const existing = new Set(tokens(current));
  const numbers = (text: string) => [...new Set(text.match(/\d+(?:[.,]\d+)?/g) || [])].sort().join("|");
  return numbers(current) === numbers(proposed) && tokens(proposed).every(word => existing.has(word) || connectors.has(word));
}
const signature = (resume: EditorResume) => createHash("sha256").update(JSON.stringify(resume)).digest("hex");

export async function tailorJobResume(userId: string, raw: unknown) {
  const body = tailorInput.parse(raw);
  const match = await prisma.jobMatch.findFirst({ where: { id: body.matchId, userId }, include: { job: true } });
  if (!match) throw new ProfileError(404, "NOT_FOUND");
  if (body.action === "REJECT") { await prisma.jobMatch.update({ where: { id: match.id }, data: { tailoring: Prisma.DbNull } }); return { discarded: true }; }
  await requireFeature(userId, "RESUME_TAILOR");
  if (body.action === "ACCEPT") {
    const proposal = match.tailoring as unknown as TailorProposal | null;
    if (!proposal || proposal.id !== body.proposalId) throw new ProfileError(409, "PROPOSAL_CHANGED");
    if (match.tailoredCvId) return { cvId: match.tailoredCvId };
    const requested = new Set(body.paths);
    const changes = proposal.changes.filter(change => requested.has(change.path));
    if (changes.length !== requested.size) throw new ProfileError(400, "VALIDATION");
    return prisma.$transaction(async tx => {
      const source = await tx.cv.findFirst({ where: { id: proposal.cvId, conversation: { userId } } });
      if (!source) throw new ProfileError(404, "RESUME_NOT_FOUND");
      const original = normalizeEditorResume(source as unknown as Record<string, unknown>);
      if (signature(original) !== proposal.sourceSignature) throw new ProfileError(409, "SOURCE_CHANGED");
      let adapted = original;
      for (const change of changes) adapted = setResumeField(adapted, change.path, change.proposed);
      adapted = resumeContentSchema.parse(adapted);
      adapted.design.documentName = (original.design.documentName + " · " + match.job.title).slice(0, 160);
      const cv = await tx.cv.create({ data: { ...adapted, ...(source.templateId ? { template: { connect: { id: source.templateId } } } : {}),
        conversation: { create: { title: adapted.design.documentName, content: "Resume adapted for job " + match.job.id + "; original resume " + source.id + " preserved.", userId } } } });
      await tx.resumeVersion.create({ data: { cvId: cv.id, label: "Source before job adaptation", snapshot: original as unknown as Prisma.InputJsonValue } });
      const claimed = await tx.jobMatch.updateMany({ where: { id: match.id, userId, tailoredCvId: null, tailoring: { path: ["id"], equals: proposal.id } }, data: { tailoredCvId: cv.id } });
      if (claimed.count !== 1) throw new ProfileError(409, "PROPOSAL_CHANGED");
      await tx.jobApplication.updateMany({ where: { userId, jobId: match.jobId }, data: { cvId: cv.id } });
      return { cvId: cv.id };
    });
  }
  const cv = await prisma.cv.findFirst({ where: { id: body.cvId, conversation: { userId } } });
  if (!cv) throw new ProfileError(404, "RESUME_NOT_FOUND");
  const resume = normalizeEditorResume(cv as unknown as Record<string, unknown>);
  const sourceSignature = signature(resume);
  const cached = match.tailoring as unknown as (TailorProposal & { language: string }) | null;
  if (cached?.sourceSignature === sourceSignature && cached.cvId === cv.id && cached.mode === body.mode && cached.language === body.language) return cached;
  const analysis = jobAnalysisSchema.safeParse(match.job.analysis);
  if (!analysis.success) throw new ProfileError(409, "JOB_REANALYZE");
  const fields: Record<string, string> = {};
  resume.summary.forEach((_, i) => { fields[`summary.${i}`] = fieldValue(resume, `summary.${i}`); });
  resume.experiences.forEach((_, i) => { fields[`experiences.${i}.description`] = fieldValue(resume, `experiences.${i}.description`); });
  resume.skills.forEach((entry, i) => Object.keys(entry).forEach(key => { fields[`skills.${i}.${key}`] = fieldValue(resume, `skills.${i}.${key}`); }));
  resume.projects.forEach((_, i) => { fields[`projects.${i}.description`] = fieldValue(resume, `projects.${i}.description`); });
  if (!Object.values(fields).some(text => text.trim())) throw new ProfileError(422, "AI_FACTS_REQUIRED");
  const model = await getAIModel(); await reserveProfileAI(userId, "RESUME_TAILOR");
  let result: z.infer<typeof generated>;
  try {
    const response = await generateObject({ model, schema: generated, temperature: 0, maxTokens: 5000, maxRetries: 1, abortSignal: AbortSignal.timeout(45000),
      system: factualRules + "\nPropose honest improvements to summary, experience accomplishment wording and skills ordering. Only modify the supplied paths. Each field's new content words MUST already occur in THAT FIELD; change order, punctuation and connecting words only. Preserve every number. Never introduce technologies from the advert. Keep all relevant facts. Return changed fields only, with exact job evidence quotes. Do not claim improved scores. For IMPROVE mode prioritize clarity even if the job is a weak match. If safe rewriting is unnecessary, reorder existing accomplishment lines or skill items by relevance.",
      prompt: JSON.stringify({ mode: body.mode, language: body.language, sourceFields: fields, untrustedJobDescription: match.job.description, requirements: analysis.data.requirements }) });
    result = generated.parse(response.object);
  } catch (error) { throw profileAIError(error); }
  const changes: TailorChange[] = []; const seen = new Set<string>();
  for (const change of result.changes) {
    const current = fields[change.path];
    if (!allowedPath.test(change.path) || !current || seen.has(change.path) || current.trim() === change.text.trim() || !change.text.trim()) continue;
    if (!isGroundedResumeChange(current, change.text) || !change.evidence.trim() || !match.job.description.replace(/\s+/g, " ").includes(change.evidence.replace(/\s+/g, " "))) continue;
    try { resumeContentSchema.parse(setResumeField(resume, change.path, change.text)); } catch { continue; }
    changes.push({ path: change.path, current, proposed: change.text, reason: change.reason, evidence: change.evidence }); seen.add(change.path);
  }
  if (!changes.length) throw new ProfileError(422, "NO_SAFE_CHANGES");
  const proposal = { id: randomUUID(), cvId: cv.id, sourceSignature, mode: body.mode, language: body.language, changes, rejectedCount: result.changes.length - changes.length };
  await prisma.jobMatch.update({ where: { id: match.id }, data: { tailoring: proposal, tailoredCvId: null } });
  return proposal;
}
