import { NextResponse } from "next/server";
import prisma from "../../../../prisma/prisma";
import { getSessionUser, isAdmin } from "@/lib/auth";

export async function GET(req: Request) {
  const session = await getSessionUser();

  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const mine = new URL(req.url).searchParams.get("mine") === "1";

  if (!mine && !isAdmin(session)) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  try {
    const coverLetters = await prisma.coverLetter.findMany({
      where: mine ? { conversation: { userId: session.id } } : undefined,
      orderBy: { createdAt: "desc" },
    });
    return NextResponse.json(coverLetters, { status: 200 });
  } catch {
    return NextResponse.json({ error: "Internal Server Error" }, { status: 500 });
  }
}
