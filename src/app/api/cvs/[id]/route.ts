import { NextResponse } from "next/server";
import prisma from "../../../../../prisma/prisma";
import { canAccessUser, getSessionUser } from "@/lib/auth";

export async function GET(req: Request) {
  const url = new URL(req.url);
  const id = url.pathname.split("/").pop() as string;
  const session = await getSessionUser();

  const generateCv = await prisma.cv.findUnique({
    where: { id },
  });

  if (!generateCv) {
    return NextResponse.json({ message: "Cv not found" }, { status: 404 });
  }

  const conversation = await prisma.conversation.findUnique({
    where: { id: generateCv.conversationId },
  });

  if (!conversation || !canAccessUser(session, conversation.userId)) {
    return NextResponse.json({ message: "Forbidden" }, { status: 403 });
  }

  return NextResponse.json(generateCv);
}

export async function DELETE(req: Request) {
  const url = new URL(req.url);
  const id = url.pathname.split("/").pop() as string;
  const session = await getSessionUser();

  const generateCv = await prisma.cv.findUnique({
    where: { id },
  });

  if (!generateCv) {
    return NextResponse.json({ message: "Cv not found" }, { status: 404 });
  }

  const conversation = await prisma.conversation.findUnique({
    where: { id: generateCv.conversationId },
  });

  if (!conversation || !canAccessUser(session, conversation.userId)) {
    return NextResponse.json({ message: "Forbidden" }, { status: 403 });
  }

  await prisma.cv.delete({ where: { id } });
  return NextResponse.json({ id });
}
