import { NextResponse } from "next/server";
import prisma from "../../../../../prisma/prisma";
import { canAccessUser, getSessionUser } from "@/lib/auth";

export async function GET(req: Request) {
  const url = new URL(req.url);
  const id = url.pathname.split("/").pop() as string;
  const session = await getSessionUser();

  const education = await prisma.education.findUnique({
    where: { id },
  });

  if (!education) {
    return NextResponse.json({ message: "Education not found" }, { status: 404 });
  }

  if (!canAccessUser(session, education.userId)) {
    return NextResponse.json({ message: "Forbidden" }, { status: 403 });
  }

  return NextResponse.json(education);
}

export async function PUT(req: Request) {
  const url = new URL(req.url);
  const id = url.pathname.split("/").pop() as string;
  const session = await getSessionUser();
  const { degree, school, start, end, userId, description } = await req.json();

  const education = await prisma.education.findUnique({
    where: { id },
  });

  if (!education) {
    return NextResponse.json({ message: "Education not found" }, { status: 404 });
  }

  if (!canAccessUser(session, education.userId) || !canAccessUser(session, userId)) {
    return NextResponse.json({ message: "Forbidden" }, { status: 403 });
  }

  const updatedEducation = await prisma.education.update({
    where: { id },
    data: { degree, school, start, end, userId, description },
  });

  return NextResponse.json(updatedEducation);
}

export async function DELETE(req: Request) {
  const url = new URL(req.url);
  const id = url.pathname.split("/").pop() as string;
  const session = await getSessionUser();

  const education = await prisma.education.findUnique({
    where: { id },
  });

  if (!education) {
    return NextResponse.json({ message: "Education not found" }, { status: 404 });
  }

  if (!canAccessUser(session, education.userId)) {
    return NextResponse.json({ message: "Forbidden" }, { status: 403 });
  }

  await prisma.education.delete({ where: { id } });
  return NextResponse.json({ message: "Education deleted" });
}
