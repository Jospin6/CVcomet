import { NextResponse } from "next/server";
import prisma from "../../../../../prisma/prisma";
import { canAccessUser, getSessionUser } from "@/lib/auth";

export async function GET(req: Request) {
  const url = new URL(req.url);
  const id = url.pathname.split("/").pop() as string;
  const session = await getSessionUser();

  const project = await prisma.project.findUnique({
    where: { id },
  });

  if (!project) {
    return NextResponse.json({ message: "Project not found" }, { status: 404 });
  }

  if (!canAccessUser(session, project.userId)) {
    return NextResponse.json({ message: "Forbidden" }, { status: 403 });
  }

  return NextResponse.json(project);
}

export async function PUT(req: Request) {
  const pathUrl = new URL(req.url);
  const id = pathUrl.pathname.split("/").pop() as string;
  const session = await getSessionUser();
  const { title, url, start, end, userId, description } = await req.json();

  const project = await prisma.project.findUnique({
    where: { id },
  });

  if (!project) {
    return NextResponse.json({ message: "Project not found" }, { status: 404 });
  }

  if (!canAccessUser(session, project.userId) || !canAccessUser(session, userId)) {
    return NextResponse.json({ message: "Forbidden" }, { status: 403 });
  }

  const updatedProject = await prisma.project.update({
    where: { id },
    data: { title, url, start, end, userId, description },
  });

  return NextResponse.json(updatedProject);
}

export async function DELETE(req: Request) {
  const url = new URL(req.url);
  const id = url.pathname.split("/").pop() as string;
  const session = await getSessionUser();

  const project = await prisma.project.findUnique({
    where: { id },
  });

  if (!project) {
    return NextResponse.json({ message: "Project not found" }, { status: 404 });
  }

  if (!canAccessUser(session, project.userId)) {
    return NextResponse.json({ message: "Forbidden" }, { status: 403 });
  }

  await prisma.project.delete({ where: { id } });
  return NextResponse.json({ message: "Project deleted" });
}
