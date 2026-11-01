import { z } from "zod";
import type { JobIntelligence } from "./job-intelligence";

export const MAX_JOB_TEXT = 50000;
export const MIN_JOB_TEXT = 100;
export const jobTextSchema = z.string().min(MIN_JOB_TEXT).max(MAX_JOB_TEXT).refine(value => value.trim().length >= MIN_JOB_TEXT, "JOB_TOO_SHORT");
export const jobSourceSchema = z.object({
  type: z.enum(["TEXT", "URL", "PDF"]).default("TEXT"),
  url: z.string().url().max(2048).refine(value => /^https?:\/\//i.test(value)).optional(),
  name: z.string().max(240).optional(),
  originalText: z.string().max(MAX_JOB_TEXT).optional(),
}).strict();
const text = (max = 1000) => z.string().max(max).default("");
const list = (max = 40) => z.array(z.string().max(1000)).max(max).default([]);
export const requirementSchema = z.object({
  id: z.string().min(1).max(80), title: z.string().min(1).max(200),
  category: z.enum(["TECHNICAL", "SOFT_SKILL", "EXPERIENCE", "EDUCATION", "CERTIFICATION", "LANGUAGE", "ELIGIBILITY", "OTHER"]),
  priority: z.enum(["REQUIRED", "PREFERRED", "MENTIONED"]), description: text(),
  evidence: z.string().min(1).max(1600), ambiguity: text(),
  terms: z.array(z.string().min(1).max(120)).min(1).max(8),
}).strict();
export const jobAnalysisSchema = z.object({
  title: text(180), company: text(180), location: text(180), workMode: text(120), contractType: text(120), seniority: text(120),
  summary: text(2400), objective: text(1500), responsibilities: list(30),
  requiredSkills: list(), preferredSkills: list(), technologies: list(), education: list(20), experience: list(20), keywords: list(60),
  requirements: z.array(requirementSchema).max(80).default([]), warnings: list(20),
}).strict();

// Storage accepts older/partial records with defaults. Generation requires every
// field explicitly, as OpenAI strict outputs require all properties to be required.
function generationShape(shape: z.ZodRawShape) {
  return Object.fromEntries(Object.entries(shape).map(([key, field]) => [key, field instanceof z.ZodDefault ? field.removeDefault() : field]));
}
const generatedRequirementSchema = z.object({
  ...generationShape(requirementSchema.shape),
  title: requirementSchema.shape.title.describe("A short contiguous phrase copied from evidence, with unchanged spelling. Never paraphrase or translate it."),
  evidence: requirementSchema.shape.evidence.describe("A verbatim quotation copied from the job text. Preserve words, punctuation and line-break hyphens. Do not combine separate passages."),
  terms: requirementSchema.shape.terms.describe("One to eight short terms found in BOTH the title and evidence. Do not add aliases, inferred skills or surrounding words."),
}).strict();
export const jobAnalysisGenerationSchema = z.object({
  ...generationShape(jobAnalysisSchema.shape),
  requirements: z.array(generatedRequirementSchema).max(80),
}).strict();
export type JobAnalysis = z.infer<typeof jobAnalysisSchema>;
export type JobRequirement = z.infer<typeof requirementSchema>;
export type JobSource = z.infer<typeof jobSourceSchema>;
export type Evidence = { path: string; label: string; quote: string };
export type RequirementResult = JobRequirement & {
  status: "DEMONSTRATED" | "PARTIAL" | "NOT_DEMONSTRATED" | "VERIFY";
  explanation: string; evidenceSources: Evidence[];
};
export type ResumePreparationAction = Readonly<{
  requirementId: string; title: string;
  status: RequirementResult["status"];
  priority: RequirementResult["priority"];
  kind: "SELECT_RESUME" | "BRING_PROFILE_EVIDENCE" | "REINFORCE_CV" | "VERIFY_FACTS" | "REVIEW_GAP";
  evidencePaths: string[];
  nextStep: string;
  requiresApproval: true;
}>;
export type MatchResult = {
  version: 1; overallScore: number | null; skillScore: number | null; keywordScore: number | null;
  experienceScore: number | null; educationScore: number | null;
  components: { essentialSkills: number | null; desirableSkills: number | null; experience: number | null; qualifications: number | null };
  requirements: RequirementResult[]; evaluatedCount: number; unverifiedCount: number; totalCount: number;
  matchedSkills: string[]; missingSkills: string[]; unverifiedSkills: string[]; recommendations: string[];
  scoreExplanation: string; source: "PROFILE" | "PROFILE_AND_RESUME"; intelligence?: JobIntelligence;
  /** Read-only plan for Resume Agent; API approvals remain mandatory. */
  resumePlan?: ResumePreparationAction[];
};
export type TailorChange = { path: string; current: string; proposed: string; reason: string; evidence: string };
export type TailorProposal = { id: string; cvId: string; sourceSignature: string; mode: "TAILOR" | "IMPROVE"; changes: TailorChange[]; rejectedCount: number };
