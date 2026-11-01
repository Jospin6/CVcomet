/** Ephemeral, owner-scoped multimodal inputs. Only a small manifest is persisted.
 * Never put file bytes, extracted text or transcripts in the mission log/graph checkpoint. */
import { createHash } from "node:crypto";
import mammoth from "mammoth";
import { extractPDFText } from "@/lib/pdf-text";
import { CareerContractError } from "@/lib/career-os/contracts";
import { profileFormData } from "@/lib/career-profile/http";

export const MAX_ATTACHMENTS = 3;
export const MAX_ATTACHMENT_BYTES = 5 * 1024 * 1024;
export const MAX_MULTIMODAL_BODY = 12 * 1024 * 1024 + 128 * 1024;
export type AssistantAttachmentMeta = Readonly<{ name: string; kind: "image" | "document"; mimeType: string; size: number }>;
export type AssistantAttachment = AssistantAttachmentMeta & Readonly<{
  digest: string;
  text?: string;
  image?: Uint8Array;
}>;

function invalid(code: string, status = 400): never { throw new CareerContractError(status, code); }
export function safeAttachmentName(name: string) {
  return name.replace(/[\u0000-\u001f\u007f/\\<>]/g, "_").trim().slice(0, 100) || "fichier";
}
function mimeFromSignature(data: Buffer): string | null {
  if (data.subarray(0, 8).equals(Buffer.from([137,80,78,71,13,10,26,10]))) return "image/png";
  if (data.length > 3 && data[0] === 255 && data[1] === 216 && data[2] === 255) return "image/jpeg";
  if (data.subarray(0, 4).toString() === "RIFF" && data.subarray(8, 12).toString() === "WEBP") return "image/webp";
  if (data.subarray(0, 5).toString() === "%PDF-") return "application/pdf";
  if (data.subarray(0, 4).equals(Buffer.from([80,75,3,4]))) return "application/zip";
  return null;
}
function kindFromFile(file: File, data: Buffer) {
  const ext = file.name.toLowerCase().split(".").pop() || "";
  const signature = mimeFromSignature(data);
  if (ext === "png" && signature === "image/png") return { kind: "image" as const, mimeType: "image/png" };
  if (["jpg", "jpeg"].includes(ext) && signature === "image/jpeg") return { kind: "image" as const, mimeType: "image/jpeg" };
  if (ext === "webp" && signature === "image/webp") return { kind: "image" as const, mimeType: "image/webp" };
  if (ext === "pdf" && signature === "application/pdf") return { kind: "document" as const, mimeType: "application/pdf" };
  if (ext === "docx" && signature === "application/zip") return { kind: "document" as const,
    mimeType: "application/vnd.openxmlformats-officedocument.wordprocessingml.document" };
  if (ext === "txt" && !signature && !data.includes(0) && !data.toString("utf8").includes("\ufffd")) return { kind: "document" as const, mimeType: "text/plain" };
  invalid("ASSISTANT_UNSUPPORTED_FILE", 415);
}
export async function prepareAssistantAttachments(files: File[]): Promise<AssistantAttachment[]> {
  if (files.length > MAX_ATTACHMENTS) invalid("ASSISTANT_TOO_MANY_ATTACHMENTS", 413);
  const result: AssistantAttachment[] = [];
  let totalChars = 0;
  for (const file of files) {
    if (!file.size || file.size > MAX_ATTACHMENT_BYTES) invalid("ASSISTANT_FILE_TOO_LARGE", 413);
    const bytes = Buffer.from(await file.arrayBuffer());
    const type = kindFromFile(file, bytes);
    // MIME is advisory, but conflicting declared types must not silently pass.
    if (file.type && file.type !== "application/octet-stream" && file.type !== type.mimeType &&
      !(type.mimeType === "image/jpeg" && file.type === "image/jpg")) invalid("ASSISTANT_FILE_TYPE_MISMATCH", 415);
    let text: string | undefined;
    if (type.kind === "document") {
      if (type.mimeType === "application/pdf") text = await extractPDFText(bytes);
      else if (type.mimeType === "text/plain") text = bytes.toString("utf8");
      else {
        try { text = (await mammoth.extractRawText({ buffer: bytes })).value; }
        catch { invalid("ASSISTANT_INVALID_DOCUMENT", 400); }
      }
      if (!text?.trim()) invalid("ASSISTANT_DOCUMENT_NO_TEXT", 422);
      const remaining = 15_000 - totalChars;
      if (remaining < 500) invalid("ASSISTANT_DOCUMENT_TEXT_LIMIT", 413);
      text = text.replace(/\u0000/g, "").trim().slice(0, Math.min(remaining, 8000));
      totalChars += text.length;
    }
    result.push({ name: safeAttachmentName(file.name), ...type, size: bytes.length,
      digest: createHash("sha256").update(bytes).digest("hex"),
      ...(text ? { text } : {}), ...(type.kind === "image" ? { image: new Uint8Array(bytes) } : {}) });
  }
  return result;
}
export function publicAttachmentManifest(items: readonly AssistantAttachment[]): AssistantAttachmentMeta[] {
  return items.map(({ name, kind, mimeType, size }) => ({ name, kind, mimeType, size }));
}
export function assistantInputDigest(message: string, items: readonly AssistantAttachment[],
  applicationId?: string, requestedSpecialist?: string): string | null {
  // Bind the same requestKey to every input affecting the reply, not only files.
  // Keep old text-only runs compatible: they have NULL digests.
  if (!items.length && !applicationId && !requestedSpecialist) return null;
  return createHash("sha256").update(JSON.stringify({ message,
    applicationId: applicationId ?? null, requestedSpecialist: requestedSpecialist ?? null,
    files: items.map(({ name, size, mimeType, digest }) => ({ name, size, mimeType, digest })),
  })).digest("hex");
}
export function assistantAttachmentContext(items: readonly AssistantAttachment[]): Array<{
  kind: AssistantAttachment["kind"]; name: string; mimeType: string;
  extractedUntrustedText: string | null; imageProvidedToVisionModel: boolean;
}> {
  return items.map(item => ({ kind: item.kind, name: item.name, mimeType: item.mimeType,
    extractedUntrustedText: item.text ?? null, imageProvidedToVisionModel: item.kind === "image" }));
}
export async function readAssistantRunInput(req: Request) {
  if (!req.headers.get("content-type")?.toLowerCase().startsWith("multipart/form-data")) invalid("INVALID_TYPE", 415);
  const form = await profileFormData(req, MAX_MULTIMODAL_BODY);
  const allowed = new Set(["apiVersion", "requestKey", "message", "applicationId", "specialist", "files"]);
  for (const key of form.keys()) if (!allowed.has(key)) invalid("INVALID_AGENT_INPUT");
  const files = form.getAll("files");
  if (files.some(file => !(file instanceof File))) invalid("INVALID_AGENT_INPUT");
  return { apiVersion: form.get("apiVersion"), requestKey: form.get("requestKey"),
    message: form.get("message"), applicationId: form.get("applicationId") || undefined,
    specialist: form.get("specialist") || undefined,
    attachments: await prepareAssistantAttachments(files as File[]) };
}
