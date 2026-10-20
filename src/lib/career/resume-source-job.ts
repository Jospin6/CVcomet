import prisma from "../../../prisma/prisma";
import { ProfileError } from "@/lib/career-profile/http";
import { normalizeJobText } from "./job-input";
import { jobTextSchema } from "./job-schema";
import { savedJobTitle } from "./job-opportunities";

function sourceText(content: string) {
  // These conversations contain import/editor provenance, not a job posting.
  if (/^Resume (?:from confirmed career profile\.|started from scratch\.|imported from LinkedIn \(|adapted for job )/.test(content)) return null;
  const text = normalizeJobText(content);
  return jobTextSchema.safeParse(text).success ? text : null;
}

const sourceWhere = (userId: string, content: string, text: string) => ({
  userId, OR: [{ description: text }, { originalText: content }, { originalText: text }],
});

/** The immutable initial conversation content is the source used by generate-cv.
 * Save that text once, independently of later generation/editing instructions. */
export async function ensureResumeGenerationJob(userId: string, content: string) {
  const text = sourceText(content);
  if (!text) return null;
  const existing = await prisma.jobOpportunity.findFirst({ where: sourceWhere(userId, content, text), orderBy: [{ createdAt: "asc" }, { id: "asc" }] });
  if (existing) return existing;
  return prisma.jobOpportunity.create({ data: { userId, title: savedJobTitle({ description: text }), description: text, originalText: content, sourceType: "TEXT" } });
}

const isGeneratedResume = (content: string) => {
  try {
    const value = JSON.parse(content);
    return value && typeof value.title === "string" && Array.isArray(value.skills) && Array.isArray(value.experiences);
  } catch { return false; }
};

async function resolveResumeSourceJob(userId: string, cvId: string) {
  const cv = await prisma.cv.findFirst({ where: { id: cvId, conversation: { userId } }, include: { conversation: { select: { id: true, content: true } } } });
  if (!cv) throw new ProfileError(404, "RESUME_NOT_FOUND");
  // A tailored copy has an explicit generation relationship. A comparison
  // merely made with the original CV must never become its generation source.
  const adapted = await prisma.jobMatch.findFirst({ where: { userId, tailoredCvId: cvId, job: { userId } }, include: { job: true }, orderBy: [{ createdAt: "asc" }, { id: "asc" }] });
  if (adapted) return { job: adapted.job, origin: "ADAPTATION" as const };
  const content = cv.conversation.content, text = sourceText(content);
  if (!text) return { job: null, origin: null };
  const existing = await prisma.jobOpportunity.findFirst({ where: sourceWhere(userId, content, text), orderBy: [{ createdAt: "asc" }, { id: "asc" }] });
  if (existing) return { job: existing, origin: "GENERATION" as const };
  // Older generations predate the saved-job catalog. Recover their original
  // posting only when an actual generated CV message confirms this workflow.
  const messages = await prisma.message.findMany({ where: { conversationId: cv.conversation.id, role: "assistant" }, select: { content: true }, orderBy: { createdAt: "asc" }, take: 10 });
  if (!messages.some(message => isGeneratedResume(message.content))) return { job: null, origin: null };
  return { job: await ensureResumeGenerationJob(userId, content), origin: "GENERATION" as const };
}

const initializing = new Map<string, ReturnType<typeof resolveResumeSourceJob>>();
export async function resumeSourceJob(userId: string, cvId: string) {
  const key = `${userId}:${cvId}`;
  let operation = initializing.get(key);
  if (!operation) { operation = resolveResumeSourceJob(userId, cvId); initializing.set(key, operation); }
  try { return await operation; }
  finally { if (initializing.get(key) === operation) initializing.delete(key); }
}
