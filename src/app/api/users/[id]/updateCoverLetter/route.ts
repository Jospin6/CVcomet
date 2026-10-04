import { NextResponse } from "next/server";
import prisma from "../../../../../../prisma/prisma";
import { canAccessUser, getSessionUser } from "@/lib/auth";

export async function PUT(req: Request) {
  const { id, currentTemplateId, accent } = await req.json();
  const session = await getSessionUser();

  if (!canAccessUser(session, id)) {
    return NextResponse.json({ message: "Forbidden" }, { status: 403 });
  }

  const updateTemplateId = await prisma.user.update({
    where: { id: id },
    data: { currentCoverLetterId: currentTemplateId, ...(typeof accent === "string" && /^#[0-9A-Fa-f]{6}$/.test(accent) ? { coverLetterAccent: accent } : {}) }
  });
  return NextResponse.json(updateTemplateId);
}
