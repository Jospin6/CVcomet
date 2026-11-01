import { NextResponse } from "next/server";
import mammoth from "mammoth";
import { extractPDFText } from "@/lib/pdf-text";
import { getSessionUser } from "@/lib/auth";
import { runProfileImportAgent } from "@/lib/agentic/agents/profile/agent/profile.agent";
import { ProfileError, profileErrorResponse, boundedBody } from "@/lib/career-profile/http";
import { AgenticError } from "@/lib/agentic/core/errors";
import { assertTrustedWriteOrigin } from "@/lib/security/request-origin";

export const maxDuration = 60;
export const runtime = "nodejs";
const MAX_FILE = 8 * 1024 * 1024;

export async function POST(req: Request) {
  try {
    assertTrustedWriteOrigin(req);
    const session = await getSessionUser();
    if (!session) throw new ProfileError(401, "UNAUTHORIZED");
    if (!req.headers.get("content-type")?.startsWith("multipart/form-data")) {
      throw new ProfileError(415, "INVALID_TYPE");
    }
    const bytes = await boundedBody(req, MAX_FILE + 65_536);
    let form: FormData;
    try {
      form = await new Response(bytes, {
        headers: { "Content-Type": req.headers.get("content-type")! },
      }).formData();
    } catch {
      throw new ProfileError(400, "INVALID_FILE");
    }
    const file = form.get("resume");
    if (!(file instanceof File) || !file.size) throw new ProfileError(400, "INVALID_FILE");
    if (file.size > MAX_FILE) throw new ProfileError(413, "TOO_LARGE");

    const data = Buffer.from(await file.arrayBuffer());
    const filename = file.name.toLowerCase();
    const pdf = filename.endsWith(".pdf") &&
      (file.type === "application/pdf" || !file.type) && data.subarray(0, 5).toString() === "%PDF-";
    const plain = filename.endsWith(".txt") &&
      ["text/plain", ""].includes(file.type) && !data.includes(0);
    const docx = filename.endsWith(".docx") &&
      ["application/vnd.openxmlformats-officedocument.wordprocessingml.document", "application/octet-stream", ""].includes(file.type);
    if (!pdf && !plain && !docx) throw new ProfileError(415, "INVALID_TYPE");

    let text = "";
    if (pdf) text = await extractPDFText(data);
    if (plain) text = data.toString("utf8");
    if (docx) {
      try {
        text = (await mammoth.extractRawText({ buffer: data })).value.trim();
      } catch {
        throw new ProfileError(400, "INVALID_FILE");
      }
    }
    if (!pdf && !text.trim()) throw new ProfileError(400, "INVALID_FILE");

    const result = await runProfileImportAgent({
      actorId: session.id,
      deps: {
        document: {
          format: pdf ? "pdf" : docx ? "docx" : "txt",
          text,
          // Native PDF input stays in a server-only closure, never in graph state.
          ...(pdf && !text.trim() ? { nativePdf: data } : {}),
        },
      },
      signal: req.signal,
    });
    return NextResponse.json({
      ...result,
      source: { name: file.name, type: pdf ? "pdf" : docx ? "docx" : "txt" },
    }, { headers: { "Cache-Control": "private, no-store" } });
  } catch (error) {
    if (error instanceof AgenticError) {
      const translated = error.code === "AGENT_MODEL_QUOTA_DENIED"
        ? new ProfileError(429, "AI_RATE_LIMIT")
        : error.code === "AGENT_DEADLINE_EXCEEDED"
          ? new ProfileError(504, "AI_TIMEOUT")
          : error.code === "AGENT_CANCELLED"
            ? new ProfileError(499, "AI_CANCELLED")
            : new ProfileError(error.status >= 500 ? 503 : error.status, "AI_FAILED");
      return profileErrorResponse(translated);
    }
    return profileErrorResponse(error);
  }
}
