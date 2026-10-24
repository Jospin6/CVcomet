import { getSessionUser } from "@/lib/auth";
import prisma from "../../../../../../../prisma/prisma";
import { normalizeEditorResume } from "@/lib/resume-editor";
import { createResumeDocx } from "@/lib/resume-export/docx";
import { resolveDocumentLanguage } from "@/lib/career-localization/markets";
import { NextResponse } from "next/server";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
type Context = { params: Promise<{ id: string }> };

export async function GET(req: Request, { params }: Context) {
  const user = await getSessionUser();
  if (!user) return NextResponse.json({ error: "UNAUTHORIZED" }, { status: 401, headers: { "Cache-Control": "no-store" } });
  const { id } = await params;
  const cv = await prisma.cv.findFirst({ where: { id, conversation: { userId: user.id } } });
  if (!cv) return NextResponse.json({ error: "NOT_FOUND" }, { status: 404, headers: { "Cache-Control": "no-store" } });
  const resume = normalizeEditorResume(cv);
  const preferred = new URL(req.url).searchParams.get("language");
  const fallback = preferred === "fr" ? "fr" : "en";
  const language = resolveDocumentLanguage(resume.design.targetMarket, resume.design.documentLanguage, fallback);
  const bytes = createResumeDocx(resume, language);
  const filename = (resume.design.documentName || resume.contact.name || "cvcomet-cv").slice(0, 90).replace(/[\\/:*?"<>|\r\n\u0000-\u001f]/g, "_") + ".docx";
  return new NextResponse(new Uint8Array(bytes), { status: 200, headers: {
    "Content-Type": "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
    "Content-Disposition": `attachment; filename="resume.docx"; filename*=UTF-8''${encodeURIComponent(filename)}`,
    "Cache-Control": "private, no-store", "X-Content-Type-Options": "nosniff",
  } });
}
