import { NextResponse } from "next/server";
import { getSessionUser, sanitizeUser } from "@/lib/auth";
import prisma from "../../../../prisma/prisma";

export async function GET() {
  const session = await getSessionUser();
  if (!session) return NextResponse.json({ error: "Non authentifi?" }, { status: 401 });
  const user = await prisma.user.findUnique({ where: { id: session.id } });
  if (!user) return NextResponse.json({ error: "Non authentifi?" }, { status: 401 });
  return NextResponse.json(sanitizeUser(user), { headers: { "Cache-Control": "private, no-store" } });
}
