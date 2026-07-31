import { NextResponse } from "next/server";
import prisma from "../../../../prisma/prisma";
import { canAccessUser, getSessionUser } from "@/lib/auth";

export async function POST(req: Request) {
  const session = await getSessionUser();
  const { title, url, start, end, description, userId } = await req.json();

  if (!canAccessUser(session, userId)) {
    return NextResponse.json({ message: "Forbidden" }, { status: 403 });
  }

  try {
    const projects = await prisma.project.create({
      data: {
        title,
        start,
        description,
        end,
        url,
        userId,
      },
    });
    return NextResponse.json(projects, { status: 201 });
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

  const projects = await prisma.project.findMany({
    where: {
      userId: requestedUserId,
    },
  });

  return NextResponse.json(projects);
}
