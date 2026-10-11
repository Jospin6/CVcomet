import mammoth from "mammoth";
import { boundedBody, ProfileError } from "@/lib/career-profile/http";
import { MAX_RESUME_BATCH_SIZE, validateResumeSelection } from "@/lib/resume-documents";

export async function readResumeUploads(req: Request) {
  const contentType = req.headers.get("content-type");
  if (!contentType?.startsWith("multipart/form-data")) throw new ProfileError(415, "INVALID_TYPE");
  const bytes = await boundedBody(req, MAX_RESUME_BATCH_SIZE + 128 * 1024);
  let form: FormData;
  try { form = await new Response(bytes, { headers: { "Content-Type": contentType } }).formData(); }
  catch { throw new ProfileError(400, "INVALID_FILE"); }
  const entries = form.getAll("resumes");
  if (entries.some(file => !(file instanceof File))) throw new ProfileError(400, "INVALID_FILE");
  const files = entries as File[];
  const invalid = validateResumeSelection(files);
  if (invalid) throw new ProfileError(invalid === "TOO_LARGE" ? 413 : invalid === "INVALID_TYPE" ? 415 : 400, invalid);
  const uploads = [];
  // Validate the entire batch before any database write.
  for (const file of files) {
    const content = Buffer.from(await file.arrayBuffer());
    const extension = file.name.split(".").pop()!.toLowerCase();
    let mimeType: string;
    let previewText: string | null = null;
    if (extension === "pdf") {
      if (content.subarray(0, 5).toString() !== "%PDF-" || !["", "application/pdf", "application/octet-stream"].includes(file.type)) throw new ProfileError(415, "INVALID_TYPE");
      mimeType = "application/pdf";
    } else if (extension === "docx") {
      if (!["", "application/octet-stream", "application/vnd.openxmlformats-officedocument.wordprocessingml.document"].includes(file.type)) throw new ProfileError(415, "INVALID_TYPE");
      try { previewText = (await mammoth.extractRawText({ buffer: content })).value.trim().slice(0, 120000); }
      catch { throw new ProfileError(400, "INVALID_FILE"); }
      if (!previewText) throw new ProfileError(400, "INVALID_FILE");
      mimeType = "application/vnd.openxmlformats-officedocument.wordprocessingml.document";
    } else {
      if (content.includes(0) || !["", "text/plain"].includes(file.type)) throw new ProfileError(415, "INVALID_TYPE");
      previewText = content.toString("utf8").trim().slice(0, 120000);
      if (!previewText) throw new ProfileError(400, "INVALID_FILE");
      mimeType = "text/plain";
    }
    const name = file.name.replace(/[\u0000-\u001f\u007f/\\]/g, "_").slice(0, 240);
    uploads.push({ name, mimeType, size: file.size, content, previewText });
  }
  return uploads;
}

export const resumeDocumentSelect = {
  id: true, name: true, mimeType: true, size: true, previewText: true, createdAt: true,
} as const;
