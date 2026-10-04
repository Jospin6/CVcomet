import { NextResponse } from "next/server";
import prisma from "../../../../prisma/prisma";
import { canAccessUser, getSessionUser } from "@/lib/auth";
import { z } from "zod";
import { generateText } from "ai";
import { getCareerModel } from "@/lib/gemini";

const schema = z.object({
  content: z.string().min(1),
  userId: z.string().uuid().optional(),
});

export async function POST(req: Request) {
  const session = await getSessionUser();

  if (!session) {
    return NextResponse.json({ message: "Unauthorized" }, { status: 401 });
  }

  try {
    const body = await req.json();
    const { content, userId } = schema.parse(body);
    const conversationUserId = userId || session.id;

    if (!canAccessUser(session, conversationUserId)) {
      return NextResponse.json({ message: "Forbidden" }, { status: 403 });
    }

    const titleResponse = await generateText({
      model: getCareerModel(),
      prompt: `Create a very short and catchy summary title (max 28 characters) for the following conversation:\n\n${content}\n\nOnly return the title.`,
      maxTokens: 20,
      temperature: 0.7,
    });

    const conversations = await prisma.conversation.create({
      data: {
        title: titleResponse.text,
        content,
        userId: conversationUserId,
      },
    });
    return NextResponse.json(conversations, { status: 201 });
  } catch {
    return NextResponse.json({ message: "Internal Server Error" }, { status: 500 });
  }
}

export async function GET(req: Request) {
  const session = await getSessionUser();

  if (!session) {
    return NextResponse.json({ message: "Unauthorized" }, { status: 401 });
  }

  const { searchParams } = new URL(req.url);
  const requestedUserId = searchParams.get("userId") || session.id;

  if (!canAccessUser(session, requestedUserId)) {
    return NextResponse.json({ message: "Forbidden" }, { status: 403 });
  }

  const conversation = await prisma.conversation.findMany({
    where: {
      userId: requestedUserId,
    },
    take: 20,
    orderBy: {
      createdAt: "desc",
    },
  });
  return NextResponse.json(conversation);
}
