import { NextResponse } from "next/server";
import prisma from "../../../../../prisma/prisma";
import { canAccessUser, getSessionUser } from "@/lib/auth";

export async function GET(req: Request) {
  const url = new URL(req.url);
  const id = url.pathname.split("/").pop() as string;
  const session = await getSessionUser();

  const conversation = await prisma.conversation.findUnique({
    where: { id },
  });

  if (!conversation) {
    return NextResponse.json({ error: "Conversation not found" }, { status: 404 });
  }

  if (!canAccessUser(session, conversation.userId)) {
    return NextResponse.json({ message: "Forbidden" }, { status: 403 });
  }

  const cvs = await prisma.cv.findMany({
    where: { conversationId: id },
    orderBy: { createdAt: "desc" },
  });

  const coverLetters = await prisma.coverLetter.findMany({
    where: { conversationId: id },
    orderBy: { createdAt: "desc" },
  });

  const messages = await prisma.message.findMany({
    where: { conversationId: id },
    orderBy: { createdAt: "asc" },
  });

  return NextResponse.json({
    ...conversation,
    Cv: cvs,
    CoverLetter: coverLetters,
    Message: messages,
  });
}

export async function DELETE(req: Request) {
  const url = new URL(req.url);
  const id = url.pathname.split("/").pop() as string;
  const session = await getSessionUser();

  const conversation = await prisma.conversation.findUnique({
    where: { id },
  });

  if (!conversation) {
    return NextResponse.json({ error: "Conversation not found" }, { status: 404 });
  }

  if (!canAccessUser(session, conversation.userId)) {
    return NextResponse.json({ message: "Forbidden" }, { status: 403 });
  }

  await prisma.$transaction([
    prisma.message.deleteMany({ where: { conversationId: id } }),
    prisma.cv.deleteMany({ where: { conversationId: id } }),
    prisma.coverLetter.deleteMany({ where: { conversationId: id } }),
    prisma.conversation.delete({ where: { id } }),
  ]);

  return NextResponse.json({ id }, { status: 200 });
}
