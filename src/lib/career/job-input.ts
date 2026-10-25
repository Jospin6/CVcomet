import { boundedBody, ProfileError } from "@/lib/career-profile/http";
import { extractPDFText } from "@/lib/pdf-text";
import mammoth from "mammoth";
import { MAX_RESUME_SIZE } from "@/lib/resume-documents";
import { jobTextSchema, MAX_JOB_TEXT, type JobSource } from "./job-schema";

export function normalizeJobText(text: string) {
  return text.replace(/\r\n?/g, "\n").replace(/\u00a0/g, " ").replace(/[ \t]+/g, " ").replace(/\n{3,}/g, "\n\n").trim();
}

export async function readJobPDF(req: Request): Promise<{ text: string; source: JobSource }> {
  const type = req.headers.get("content-type");
  if (!type?.startsWith("multipart/form-data")) throw new ProfileError(415, "INVALID_TYPE");
  const bytes = await boundedBody(req, MAX_RESUME_SIZE + 65536);
  let form: FormData;
  try { form = await new Response(bytes, { headers: { "content-type": type } }).formData(); }
  catch { throw new ProfileError(400, "INVALID_FILE"); }
  const file = form.get("file");
  if (!(file instanceof File) || !file.size) throw new ProfileError(400, "INVALID_FILE");
  if (file.size > MAX_RESUME_SIZE) throw new ProfileError(413, "TOO_LARGE");
  const data = Buffer.from(await file.arrayBuffer());
  const name = file.name.toLowerCase();
  const pdf = name.endsWith(".pdf") && data.subarray(0, 5).toString() === "%PDF-" && ["", "application/pdf", "application/octet-stream"].includes(file.type);
  const docx = name.endsWith(".docx") && data.subarray(0, 2).toString() === "PK" && ["", "application/vnd.openxmlformats-officedocument.wordprocessingml.document", "application/octet-stream"].includes(file.type);
  const plain = name.endsWith(".txt") && ["", "text/plain"].includes(file.type) && !data.includes(0);
  if (!pdf && !docx && !plain) throw new ProfileError(415, "INVALID_TYPE");
  let text = "";
  if (pdf) text = await extractPDFText(data);
  if (docx) {
    try { text = (await mammoth.extractRawText({ buffer: data })).value; }
    catch { throw new ProfileError(400, "INVALID_FILE"); }
  }
  if (plain) text = data.toString("utf8");
  if (!text.trim()) throw new ProfileError(422, "PDF_TEXT_REQUIRED");
  if (text.length > MAX_JOB_TEXT) throw new ProfileError(413, "JOB_TOO_LONG");
  if (!jobTextSchema.safeParse(text).success) throw new ProfileError(422, "JOB_TOO_SHORT");
  return { text, source: { type: "PDF", name: file.name.replace(/[\u0000-\u001f/\\]/g, "_").slice(0, 240), originalText: text } };
}
