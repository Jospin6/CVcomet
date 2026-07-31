import { NextResponse } from "next/server";
import prisma from "../../../../../prisma/prisma";
import { canAccessUser, getSessionUser } from "@/lib/auth";

export async function GET(req: Request) {
  const url = new URL(req.url);
  const id = url.pathname.split("/").pop() as string;
  const session = await getSessionUser();

  const coverLetter = await prisma.coverLetter.findUnique({
    where: { id },
  });

  if (!coverLetter) {
    return NextResponse.json({ message: "Cover letter not found" }, { status: 404 });
  }

  const conversation = await prisma.conversation.findUnique({
    where: { id: coverLetter.conversationId },
  });

  if (!conversation || !canAccessUser(session, conversation.userId)) {
    return NextResponse.json({ message: "Forbidden" }, { status: 403 });
  }

  return NextResponse.json(coverLetter);
}

export async function DELETE(req: Request) {
  const url = new URL(req.url);
  const id = url.pathname.split("/").pop() as string;
  const session = await getSessionUser();

  const coverLetter = await prisma.coverLetter.findUnique({
    where: { id },
  });

  if (!coverLetter) {
    return NextResponse.json({ message: "Cover letter not found" }, { status: 404 });
  }

  const conversation = await prisma.conversation.findUnique({
    where: { id: coverLetter.conversationId },
  });

  if (!conversation || !canAccessUser(session, conversation.userId)) {
    return NextResponse.json({ message: "Forbidden" }, { status: 403 });
  }

  await prisma.coverLetter.delete({ where: { id } });
  return NextResponse.json({ id });
}
