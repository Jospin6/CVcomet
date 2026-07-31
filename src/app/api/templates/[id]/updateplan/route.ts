import { NextResponse } from "next/server";
import prisma from "../../../../../../prisma/prisma";
import { getSessionUser, isAdmin } from "@/lib/auth";

export async function PUT(req: Request) {
  const session = await getSessionUser();

  if (!isAdmin(session)) {
    return NextResponse.json({ message: "Forbidden" }, { status: 403 });
  }

  const { id, plan } = await req.json();

  const updateTemplatePlan = await prisma.template.update({
    where: { id },
    data: { plan },
  });
  return NextResponse.json(updateTemplatePlan);
}
