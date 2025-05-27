import { NextResponse } from "next/server";
import prisma from "../../../../../prisma/prisma"


export async function GET(req: Request) {
  const url = new URL(req.url);
  const id = url.pathname.split("/").pop() as string;

  const conversation = await prisma.conversation.findUnique({
    where: { id },
  });

  if (!conversation) {
    return NextResponse.json({ error: "Conversation not found" }, { status: 404 });
  }

  const cvs = await prisma.cv.findMany({
    where: { conversationId: id },
    orderBy: { createdAt: "desc" },
  });

  const coverLetters = await prisma.coverLetter.findMany({
    where: { conversationId: id },
    orderBy: { createdAt: "desc" },
  });

  return NextResponse.json({
    ...conversation,
    Cv: cvs,
    CoverLetter: coverLetters,
  });
}
