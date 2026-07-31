import { NextResponse } from "next/server";
import prisma from "../../../../prisma/prisma";
import { canAccessUser, getSessionUser } from "@/lib/auth";

export async function POST(req: Request) {
  const session = await getSessionUser();
  const { degree, school, start, description, end, userId } = await req.json();

  if (!canAccessUser(session, userId)) {
    return NextResponse.json({ message: "Forbidden" }, { status: 403 });
  }

  try {
    const educations = await prisma.education.create({
      data: {
        degree,
        school,
        description,
        start,
        end,
        userId,
      },
    });
    return NextResponse.json(educations, { status: 201 });
  } catch {
    return NextResponse.json({ message: "Internal Server Error" }, { status: 500 });
  }
}

export async function GET(req: Request) {
  const session = await getSessionUser();
  const { searchParams } = new URL(req.url);
  const requestedUserId = searchParams.get("userId") || session?.id || "";

  if (!session) {
    return NextResponse.json({ message: "Unauthorized" }, { status: 401 });
  }

  if (!canAccessUser(session, requestedUserId)) {
    return NextResponse.json({ message: "Forbidden" }, { status: 403 });
  }

  const educations = await prisma.education.findMany({
    where: { userId: requestedUserId },
  });

  return NextResponse.json(educations);
}
