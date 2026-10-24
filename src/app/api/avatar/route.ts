import { NextResponse } from "next/server";
import prisma from "../../../../prisma/prisma";
import { detectPreviewMime } from "@/lib/security/template-preview";

/** Public preview only; never expose template metadata or unexpected binary types. */
export async function GET(req: Request) {
  const id = new URL(req.url).searchParams.get("id");
  if (!id || id.length > 128) return NextResponse.json({ error: "INVALID_ID" }, { status: 400 });
  const template = await prisma.template.findUnique({ where: { id }, select: { templateFile: true } });
  if (!template?.templateFile) return NextResponse.json({ error: "NOT_FOUND" }, { status: 404 });
  const bytes = new Uint8Array(template.templateFile);
  const mime = detectPreviewMime(bytes);
  if (!mime) return NextResponse.json({ error: "UNSUPPORTED_PREVIEW" }, { status: 415 });
  return new NextResponse(Buffer.from(bytes), { headers: {
    "Content-Type": mime, "X-Content-Type-Options": "nosniff", "Cache-Control": "public, max-age=300",
  } });
}
