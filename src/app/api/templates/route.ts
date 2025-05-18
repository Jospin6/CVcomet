import { NextRequest, NextResponse } from "next/server";
import prisma from "../../../../prisma/prisma"

export async function POST(req: NextRequest) {
  try {
    const formData = await req.formData();

    const name = formData.get("name") as string;
    const type = formData.get("type") as string;
    const templateFile = formData.get("templateFile") as File; // l'image uploadée

    if (!templateFile) {
      return NextResponse.json({ error: "Preview image is required" }, { status: 400 });
    }

    const previewBuffer = Buffer.from(await templateFile.arrayBuffer());

    const template = await prisma.template.create({
      data: {
        name,
        type: type as "CV" | "COVER_LETTER",
        templateFile: previewBuffer,
      },
    });

    return NextResponse.json(template, { status: 201 });
  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}

export async function GET(req: Request) {
  const templates = await prisma.template.findMany()
  return NextResponse.json(templates)
}
