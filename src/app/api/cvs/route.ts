import { NextResponse } from "next/server";
import prisma from "../../../../prisma/prisma";
import { getSessionUser, isAdmin } from "@/lib/auth";

export async function GET() {
  const session = await getSessionUser();

  if (!isAdmin(session)) {
    return NextResponse.json({ message: "Forbidden" }, { status: 403 });
  }

  const generateCv = await prisma.cv.findMany();
  return NextResponse.json(generateCv);
}
