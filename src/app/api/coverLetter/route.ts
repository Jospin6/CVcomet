import { NextResponse } from "next/server";
import prisma from "../../../../prisma/prisma";
import { getSessionUser, isAdmin } from "@/lib/auth";

export async function GET() {
  const session = await getSessionUser();

  if (!isAdmin(session)) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  try {
    const coverLetters = await prisma.coverLetter.findMany();
    return NextResponse.json(coverLetters, { status: 200 });
  } catch {
    return NextResponse.json({ error: "Internal Server Error" }, { status: 500 });
  }
}
