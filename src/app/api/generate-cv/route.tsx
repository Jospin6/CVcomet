import { NextResponse } from "next/server";
import prisma from "../../../../prisma/prisma";
import { CoreMessage, streamObject } from "ai";
import { gemini } from "@/lib/gemini";
import { generateCvPrompt, generateCvSystemPrompt, generatedLanguagePrompt } from "@/helpers/helpers";
import { cvSchema } from "@/helpers/schema";
import { dayLimit } from "@/helpers/constants";
import { canAccessUser, getSessionUser, sanitizeUser } from "@/lib/auth";

export const maxDuration = 30;

export async function POST(req: Request) {
  const session = await getSessionUser();

  if (!session) {
    return new NextResponse(JSON.stringify({ error: "Unauthorized" }), {
      status: 401,
      headers: { "Content-Type": "application/json" },
    });
  }

  const { description, conversationId, language } = await req.json();
  const curentLanguage = generatedLanguagePrompt(language);

  const conversationContent = await prisma.conversation.findUnique({
    where: { id: conversationId },
  });

  if (!conversationContent) {
    return new NextResponse(JSON.stringify({ error: "Conversation not found" }), {
      status: 404,
      headers: { "Content-Type": "application/json" },
    });
  }

  if (!canAccessUser(session, conversationContent.userId)) {
    return new NextResponse(JSON.stringify({ error: "Forbidden" }), {
      status: 403,
      headers: { "Content-Type": "application/json" },
    });
  }

  const fullUser = await prisma.user.findUnique({
    where: { id: session.id },
    include: {
      Experience: true,
      Education: true,
      Project: true,
      certifications: true,
    },
  });

  if (!fullUser) {
    return new NextResponse(JSON.stringify({ error: "User not found" }), {
      status: 404,
      headers: { "Content-Type": "application/json" },
    });
  }

  const user = sanitizeUser(fullUser);

  if (!fullUser.isSubscribed) {
    const today = new Date();
    const isSameDay =
      fullUser.lastGeneratedAt &&
      today.toDateString() === new Date(fullUser.lastGeneratedAt).toDateString();

    if (isSameDay && fullUser.generationCount >= dayLimit) {
      return new NextResponse(
        JSON.stringify({ error: `Limit to ${dayLimit} generations a day` }),
        { status: 400, headers: { "Content-Type": "application/json" } }
      );
    }

    await prisma.user.update({
      where: { id: fullUser.id },
      data: {
        generationCount: isSameDay ? { increment: 1 } : 1,
        lastGeneratedAt: today,
      },
    });
  }

  await prisma.message.create({
    data: {
      conversationId,
      role: "user",
      content: description,
    },
  });

  const prompt = generateCvPrompt({ description, user: user as any, curentLanguage });
  const system = generateCvSystemPrompt();

  const messages = await prisma.message.findMany({
    where: { conversationId },
    select: {
      role: true,
      content: true,
    },
    orderBy: { createdAt: "asc" },
  });

  const chatHistory: CoreMessage[] = messages.map((m) => ({
    role: m.role as "user" | "assistant",
    content: m.content,
  }));

  if (conversationContent?.content) {
    chatHistory.push({
      role: "user",
      content: generateCvPrompt({ description: conversationContent.content, user: user as any, curentLanguage }),
    });
  }

  chatHistory.push({
    role: "user",
    content: prompt,
  });

  try {
    const result = await streamObject({
      model: gemini("gemini-1.5-flash"),
      output: "object",
      schema: cvSchema,
      system,
      messages: chatHistory,
      async onFinish({ object, error }) {
        if (object === undefined) {
          console.error("Error:", error);
          return;
        }

        await prisma.message.create({
          data: {
            conversationId,
            role: "assistant",
            content: JSON.stringify(object.cvs),
          },
        });

        await prisma.cv.create({
          data: {
            title: object.cvs.title,
            summary: object.cvs.summary ? [object.cvs.summary] : [],
            skills: object.cvs.skills,
            experiences: object.cvs.experiences,
            educations: object.cvs.educations,
            certifications: object.cvs.certifications,
            projects: object.cvs.projects,
            languages: object.cvs.languages,
            conversationId,
          },
        });
      },
    });

    return result.toTextStreamResponse();
  } catch {
    return new NextResponse(
      JSON.stringify({ error: "Failed to generate cv" }),
      { status: 500, headers: { "Content-Type": "application/json" } }
    );
  }
}
