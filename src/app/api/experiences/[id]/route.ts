import { NextResponse } from "next/server";
import prisma from "../../../../../prisma/prisma";
import { canAccessUser, getSessionUser } from "@/lib/auth";

export async function GET(req: Request) {
  const url = new URL(req.url);
  const id = url.pathname.split("/").pop() as string;
  const session = await getSessionUser();

  const experience = await prisma.experience.findUnique({
    where: { id },
  });

  if (!experience) {
    return NextResponse.json({ message: "Experience not found" }, { status: 404 });
  }

  if (!canAccessUser(session, experience.userId)) {
    return NextResponse.json({ message: "Forbidden" }, { status: 403 });
  }

  return NextResponse.json(experience);
}

export async function PUT(req: Request) {
  const url = new URL(req.url);
  const id = url.pathname.split("/").pop() as string;
  const session = await getSessionUser();
  const { title, company, location, start, end, userId, description } = await req.json();

  const experience = await prisma.experience.findUnique({
    where: { id },
  });

  if (!experience) {
    return NextResponse.json({ message: "Experience not found" }, { status: 404 });
  }

  if (!canAccessUser(session, experience.userId) || !canAccessUser(session, userId)) {
    return NextResponse.json({ message: "Forbidden" }, { status: 403 });
  }

  const updatedExperience = await prisma.experience.update({
    where: { id },
    data: { title, company, location, start, end, userId, description },
  });

  return NextResponse.json(updatedExperience);
}

export async function DELETE(req: Request) {
  const url = new URL(req.url);
  const id = url.pathname.split("/").pop() as string;
  const session = await getSessionUser();

  const experience = await prisma.experience.findUnique({
    where: { id },
  });

  if (!experience) {
    return NextResponse.json({ message: "Experience not found" }, { status: 404 });
  }

  if (!canAccessUser(session, experience.userId)) {
    return NextResponse.json({ message: "Forbidden" }, { status: 403 });
  }

  await prisma.experience.delete({ where: { id } });
  return NextResponse.json({ message: "Experience deleted" });
}
