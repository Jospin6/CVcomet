import { z } from "zod";
import { jobTextSchema } from "./job-schema";

export const savedJobInput = z.object({
  title: z.string().trim().min(1).max(180),
  company: z.string().trim().max(180).default(""),
  description: jobTextSchema.transform(value => value.trim()),
}).strict();

export type SavedJobSummary = {
  id: string; title: string; company: string | null; location?: string | null;
  createdAt: string; updatedAt: string;
};

// Keep a recognizable source excerpt if an older extraction omitted the title.
export function savedJobTitle(job: { title?: string | null; description?: string; sourceName?: string | null }) {
  return (job.title?.trim() || job.description?.split(/\r?\n/).map(line => line.trim()).find(Boolean) || job.sourceName?.trim() || "Job opportunity").slice(0, 180);
}

export function savedJobLabel(job: Pick<SavedJobSummary, "title" | "company">, language: "fr" | "en") {
  const title = job.title.trim(), company = job.company?.trim();
  const escapedCompany = company?.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
  const mentioned = escapedCompany && new RegExp(`(^|[^\\p{L}\\p{N}])${escapedCompany}($|[^\\p{L}\\p{N}])`, "iu").test(title);
  return company && !mentioned
    ? `${title} ${language === "fr" ? "chez" : "at"} ${company}` : title;
}
