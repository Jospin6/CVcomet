import { NextResponse } from "next/server";
import { z } from "zod";
import prisma from "../../../../prisma/prisma";
import { getSessionUser, isAdmin } from "@/lib/auth";
import { ProfileError, profileErrorResponse, profileFormData } from "@/lib/career-profile/http";
import { MAX_TEMPLATE_FORM_BYTES, validTemplatePreview } from "@/lib/security/template-preview";

const fields = z.object({
  name: z.string().trim().min(1).max(120),
  type: z.enum(["CV", "COVER_LETTER"]),
  styleFamily: z.enum(["MODERN", "CLASSIC", "MINIMAL", "EXECUTIVE", "TECHNICAL", "EUROPASS_INSPIRED"]).default("MODERN"),
  markets: z.array(z.string().regex(/^[A-Z0-9_-]{2,40}$/)).max(30),
});

const publicTemplateFields = {
  id: true, name: true, type: true, plan: true, markets: true,
  styleFamily: true, customizable: true, accentColors: true, createdAt: true, updatedAt: true,
} as const;

export async function POST(req: Request) {
  try {
    const session = await getSessionUser();
    if (!session) throw new ProfileError(401, "UNAUTHORIZED");
    if (!isAdmin(session)) throw new ProfileError(403, "FORBIDDEN");
    const form = await profileFormData(req, MAX_TEMPLATE_FORM_BYTES);
    const markets = String(form.get("markets") || "").split(",").map(v => v.trim()).filter(Boolean);
    const data = fields.parse({ name: form.get("name"), type: form.get("type"),
      markets, styleFamily: form.get("styleFamily") || "MODERN" });
    const upload = form.get("templateFile");
    if (!(upload instanceof File)) throw new ProfileError(400, "IMAGE_REQUIRED");
    if (upload.size > 2 * 1024 * 1024 || upload.size === 0) throw new ProfileError(413, "INVALID_IMAGE");
    const image = new Uint8Array(await upload.arrayBuffer());
    if (!validTemplatePreview(image, upload.type)) throw new ProfileError(400, "INVALID_IMAGE");
    const created = await prisma.template.create({
      data: { ...data, templateFile: Buffer.from(image) },
      select: publicTemplateFields,
    });
    return NextResponse.json(created, { status: 201, headers: { "Cache-Control": "private, no-store" } });
  } catch (error) { return profileErrorResponse(error); }
}

export async function GET() {
  const session = await getSessionUser();
  if (!session) return NextResponse.json({ error: "UNAUTHORIZED" }, { status: 401 });
  const templates = await prisma.template.findMany({ select: publicTemplateFields, orderBy: { createdAt: "desc" } });
  return NextResponse.json(templates, { headers: { "Cache-Control": "private, no-store" } });
}
