import { NextResponse } from "next/server";
import prisma from "../../../../prisma/prisma";
import { getSessionUser, isAdmin, sanitizeUser } from "@/lib/auth";

export async function GET() {
  const session = await getSessionUser();

  if (!isAdmin(session)) {
    return NextResponse.json({ message: "Forbidden" }, { status: 403 });
  }

  const users = await prisma.user.findMany();
  return NextResponse.json(users.map((user) => sanitizeUser(user)));
}
