import { NextRequest, NextResponse } from "next/server";
import prisma from "../../../../prisma/prisma";
import { getSessionUser, isAdmin } from "@/lib/auth";

export async function POST(req: NextRequest) {
  const session = await getSessionUser();

  if (!isAdmin(session)) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  try {
    const formData = await req.formData();

    const name = formData.get("name") as string;
    const type = formData.get("type") as string;
    const templateFile = formData.get("templateFile") as File;
    const markets = String(formData.get("markets") || "").split(",").map(v => v.trim()).filter(Boolean);
    const styleFamily = String(formData.get("styleFamily") || "MODERN");

    if (!templateFile) {
      return NextResponse.json({ error: "Preview image is required" }, { status: 400 });
    }

    const previewBuffer = Buffer.from(await templateFile.arrayBuffer());

    const template = await prisma.template.create({
      data: {
        name,
        type: type as "CV" | "COVER_LETTER",
        templateFile: previewBuffer, markets, styleFamily,
      },
    });

    return NextResponse.json(template, { status: 201 });
  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}

export async function GET() {
  const session = await getSessionUser();

  if (!session) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const templates = await prisma.template.findMany();
  return NextResponse.json(templates);
}
