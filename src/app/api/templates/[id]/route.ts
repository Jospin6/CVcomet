import { NextResponse } from "next/server";
import prisma from "../../../../../prisma/prisma";
import { getSessionUser } from "@/lib/auth";

/** Template metadata only: binary previews are served by /api/avatar?id=... */
export async function GET(_req: Request, { params }: { params: Promise<{ id: string }> }) {
  const user = await getSessionUser();
  if (!user) return NextResponse.json({ error: "UNAUTHORIZED" }, { status: 401 });
  const { id } = await params;
  const template = await prisma.template.findUnique({ where: { id }, select: {
    id: true, name: true, type: true, plan: true, markets: true, styleFamily: true,
    customizable: true, accentColors: true, createdAt: true, updatedAt: true,
  } });
  if (!template) return NextResponse.json({ error: "NOT_FOUND" }, { status: 404 });
  return NextResponse.json(template, { headers: { "Cache-Control": "private, no-store" } });
}
