import { z } from "zod";
import { referralSources, resumeMarkets } from "@/lib/resume-market";
import { webUrl } from "./schema";

// Imported data is an editable draft, not a confirmed profile. Normalize
// formatting before validation without filling in missing candidate facts.
function extractedText(value: unknown, max: number) {
  if (typeof value === "string") return value.trim().slice(0, max);
  if (typeof value === "number" && Number.isFinite(value)) return String(value).slice(0, max);
  if (Array.isArray(value)) return value.filter(item => typeof item === "string").map(item => item.trim()).filter(Boolean).join(", ").slice(0, max);
  return "";
}
const text = (max: number) => z.preprocess(value => extractedText(value, max), z.string().max(max).default(""));

export function normalizeResumeUrl(value: unknown) {
  const source = extractedText(value, 2048).replace(/^<|>$/g, "");
  if (!source) return "";
  let candidate = source;
  if (candidate.startsWith("//")) candidate = "https:" + candidate;
  else if (!/^[a-z][a-z0-9+.-]*:/i.test(candidate)) {
    if (!/^(?:www\.)?[a-z0-9.-]+\.[a-z]{2,}(?:[/?#]|$)/i.test(candidate)) return "";
    candidate = "https://" + candidate;
  }
  try {
    const url = new URL(candidate);
    return /^https?:$/.test(url.protocol) && !url.username && !url.password && !/\s/.test(candidate) && candidate.length <= 2048 ? candidate : "";
  } catch { return ""; }
}
const url = z.preprocess(normalizeResumeUrl, webUrl.default(""));
const records = <T extends z.ZodRawShape>(shape: T, max = 50) => z.preprocess(value => {
  const entries = Array.isArray(value) ? value : value && typeof value === "object" ? [value] : [];
  return entries.filter(item => item && typeof item === "object" && !Array.isArray(item)).slice(0, max);
}, z.array(z.object(shape).strip()).max(max).default([]).transform(items => items.filter(item => Object.values(item).some(value => typeof value === "string" && value.trim()))));

const choice = <T extends readonly [string, ...string[]]>(values: T) => z.preprocess(
  value => typeof value === "string" && values.includes(value.trim()) ? value.trim() : "",
  z.enum(values).or(z.literal("")).default(""),
);

// Preprocessors apply to the model response before the AI SDK validates it.
// Null/omitted optional fields and bare links must not reject an entire CV.
// Required labels stay empty when unknown; the user completes them in review.
export const extractionSchema = z.object({
  name: text(200), phone: text(80), address: text(500),
  headline: text(300), summary: text(8000), skills: text(8000), languages: text(4000), hobbies: text(4000),
  linkedin: url, github: url, portfolio: url,
  targetMarket: choice(resumeMarkets), referralSource: choice(referralSources),
  experiences: records({ title: text(200), company: text(200), location: text(200), start: text(80), end: text(80), description: text(8000) }),
  education: records({ degree: text(200), school: text(200), start: text(80), end: text(80), description: text(8000) }),
  projects: records({ title: text(200), start: text(80), end: text(80), url, description: text(8000) }),
  certifications: records({ name: text(200), organization: text(200), date: text(80), description: text(4000) }),
  awards: records({ title: text(200), organization: text(200), date: text(80), description: text(4000) }),
  professionalLinks: records({ label: text(100), url }, 30),
}).strip();

export function hasResumeFacts(data: z.infer<typeof extractionSchema>) {
  return Object.entries(data).some(([key, value]) => key !== "targetMarket" && key !== "referralSource" &&
    (typeof value === "string" ? Boolean(value.trim()) : Array.isArray(value) && value.length > 0));
}
