import { z } from "zod";
import type { extractionSchema } from "@/lib/career-profile/extraction";
import { boundedBody, ProfileError, profileJson } from "@/lib/career-profile/http";
import { extractPDFText } from "@/lib/pdf-text";
import { MAX_RESUME_SIZE } from "@/lib/resume-documents";
import { resumeContentSchema } from "@/lib/resume-editor";
import { MAX_LINKEDIN_TEXT, normalizeLinkedInUrl } from "@/lib/linkedin";

export type LinkedInInput = { source: "url" | "pdf" | "text"; text?: string; url?: string };
const inputSchema = z.discriminatedUnion("source", [
  z.object({ source: z.literal("url"), url: z.string().trim().min(1).max(2048) }).strict(),
  z.object({ source: z.literal("text"), text: z.string().trim().min(40).max(MAX_LINKEDIN_TEXT) }).strict(),
]);

export function linkedInUrlImportAvailable() {
  const customEndpoint = process.env.LINKEDIN_IMPORT_API_URL?.trim();
  if (!customEndpoint) return Boolean(process.env.SCRAPINGDOG_API_KEY?.trim());
  try {
    const url = new URL(customEndpoint);
    return url.protocol === "https:" && !url.username && !url.password;
  } catch { return false; }
}

export async function readLinkedInInput(req: Request): Promise<LinkedInInput> {
  if (req.headers.get("content-type")?.startsWith("multipart/form-data")) {
    const contentType = req.headers.get("content-type")!;
    const bytes = await boundedBody(req, MAX_RESUME_SIZE + 65536);
    let form: FormData;
    try { form = await new Response(bytes, { headers: { "Content-Type": contentType } }).formData(); }
    catch { throw new ProfileError(400, "INVALID_FILE"); }
    const entries = form.getAll("profile");
    const file = entries[0];
    if (entries.length !== 1 || !(file instanceof File) || !file.size) throw new ProfileError(400, "INVALID_FILE");
    if (file.size > MAX_RESUME_SIZE) throw new ProfileError(413, "TOO_LARGE");
    const data = Buffer.from(await file.arrayBuffer());
    if (!file.name.toLowerCase().endsWith(".pdf") || !["", "application/pdf"].includes(file.type) || data.subarray(0, 5).toString() !== "%PDF-") throw new ProfileError(415, "INVALID_TYPE");
    const text = await extractPDFText(data);
    if (!text.trim()) throw new ProfileError(422, "PDF_TEXT_REQUIRED");
    return { source: "pdf", text: text.slice(0, MAX_LINKEDIN_TEXT) };
  }
  const input = inputSchema.parse(await profileJson(req));
  if (input.source === "text") return input;
  const url = normalizeLinkedInUrl(input.url);
  if (!url) throw new ProfileError(400, "LINKEDIN_INVALID_URL");
  if (!linkedInUrlImportAvailable()) throw new ProfileError(503, "LINKEDIN_NOT_CONFIGURED");
  return { source: "url", url };
}

// Custom providers implement the small documented POST { url } contract.
// Scrapingdog is also supported directly, without a custom proxy.
export async function fetchLinkedInProfileText(profileUrl: string) {
  const normalized = normalizeLinkedInUrl(profileUrl);
  if (!normalized) throw new ProfileError(400, "LINKEDIN_INVALID_URL");
  const customEndpoint = process.env.LINKEDIN_IMPORT_API_URL?.trim();
  let endpoint: URL;
  let init: RequestInit;
  if (customEndpoint) {
    try {
      endpoint = new URL(customEndpoint);
      if (endpoint.protocol !== "https:" || endpoint.username || endpoint.password) throw new Error();
    } catch { throw new ProfileError(503, "LINKEDIN_NOT_CONFIGURED"); }
    const token = process.env.LINKEDIN_IMPORT_API_KEY?.trim();
    init = { method: "POST", headers: { "Content-Type": "application/json", ...(token ? { Authorization: `Bearer ${token}` } : {}) }, body: JSON.stringify({ url: normalized }) };
  } else {
    const apiKey = process.env.SCRAPINGDOG_API_KEY?.trim();
    if (!apiKey) throw new ProfileError(503, "LINKEDIN_NOT_CONFIGURED");
    endpoint = new URL("https://api.scrapingdog.com/profile");
    endpoint.search = new URLSearchParams({ api_key: apiKey, type: "profile", id: decodeURIComponent(new URL(normalized).pathname.split("/")[2]) }).toString();
    init = { method: "GET" };
  }
  try {
    const response = await fetch(endpoint, { ...init, cache: "no-store", redirect: "error", signal: AbortSignal.timeout(25000) });
    if (response.status === 404) throw new ProfileError(422, "LINKEDIN_NOT_FOUND");
    if (response.status === 429) throw new ProfileError(429, "LINKEDIN_RATE_LIMIT");
    if (!response.ok) throw new ProfileError(502, "LINKEDIN_UNAVAILABLE");
    const payload: unknown = JSON.parse((await boundedBody(response, 1024 * 1024)).toString("utf8"));
    const result = Array.isArray(payload) ? payload[0] : payload;
    if (!result || typeof result !== "object") throw new ProfileError(502, "LINKEDIN_INVALID_RESPONSE");
    const wrapper = result as Record<string, unknown>;
    if (wrapper.success === false || wrapper.error) throw new ProfileError(422, "LINKEDIN_NOT_FOUND");
    const person = wrapper.profile || wrapper.person || wrapper;
    if (!person || typeof person !== "object" || Array.isArray(person)) throw new ProfileError(502, "LINKEDIN_INVALID_RESPONSE");
    const data = person as Record<string, unknown>;
    const fields = ["name", "fullName", "full_name", "firstName", "lastName", "first_name", "last_name", "headline", "summary", "about", "phone", "address", "location", "linkedin", "linkedInUrl", "website", "portfolio", "github", "skills", "languages", "experiences", "experience", "positions", "education", "educations", "schools", "certifications", "certification", "projects", "awards", "professionalLinks"];
    const profile = Object.fromEntries(fields.filter(key => data[key] !== undefined).map(key => [key, data[key]]));
    if (!Object.values(profile).some(value => typeof value === "string" ? value.trim() : value && typeof value === "object" && Object.keys(value).length)) throw new ProfileError(422, "LINKEDIN_NOT_FOUND");
    const text = JSON.stringify(profile);
    if (text.length > MAX_LINKEDIN_TEXT) throw new ProfileError(502, "LINKEDIN_INVALID_RESPONSE");
    return text;
  } catch (error) {
    if (error instanceof ProfileError && error.code !== "TOO_LARGE") throw error;
    if (error instanceof Error && ["TimeoutError", "AbortError"].includes(error.name)) throw new ProfileError(504, "LINKEDIN_TIMEOUT");
    // Never expose provider errors: they may contain API keys or profile data.
    throw new ProfileError(502, "LINKEDIN_UNAVAILABLE");
  }
}

export function linkedInFactsToResume(facts: z.infer<typeof extractionSchema>, email: string, language: "fr" | "en") {
  const lines = (text: string) => {
    const items = text.split(/\n+/).map(line => line.trim()).filter(Boolean);
    return items.length <= 30 ? items : [...items.slice(0, 29), items.slice(29).join("\n")];
  };
  const title = (facts.headline || (language === "fr" ? "CV LinkedIn" : "LinkedIn resume")).slice(0, 160);
  return resumeContentSchema.parse({
    title,
    summary: facts.summary ? facts.summary.match(/[\s\S]{1,5000}/g) : [],
    contact: { name: facts.name, email, phone: facts.phone, city: facts.address, linkedin: facts.linkedin, website: facts.portfolio || facts.github },
    design: { documentName: (facts.name ? `${facts.name} · LinkedIn` : title).slice(0, 160) },
    skills: facts.skills ? [{ hardskills: facts.skills }] : [],
    experiences: facts.experiences.map(item => ({ ...item, description: lines(item.description) })),
    educations: facts.education.map(item => ({ ...item, location: "", description: lines(item.description) })),
    projects: facts.projects.map(item => ({ title: item.title, description: [item.start || item.end ? [item.start, item.end].filter(Boolean).join(" – ") : "", item.description].filter(Boolean).join("\n").slice(0, 8000), technologies: "", link: item.url })),
    certifications: facts.certifications.map(item => ({ title: item.name, issuer: item.organization, date: item.date, description: item.description })),
    languages: facts.languages.split(/[,;\n]+/).map(language => language.trim()).filter(Boolean).slice(0, 30).map(language => ({ language: language.slice(0, 200), level: "" })),
  });
}
