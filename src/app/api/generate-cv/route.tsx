import { NextResponse, NextRequest } from "next/server";
import prisma from "../../../../prisma/prisma"
import { CoreMessage, streamObject } from "ai";
import { gemini } from "@/lib/gemini";
import { generateCvPrompt, generateCvSystemPrompt, generatedLanguagePrompt } from "@/helpers/helpers";
import { cvSchema } from "@/helpers/schema";

export const maxDuration = 30;

export async function POST(req: Request) {
  const { description, user, conversationId, language } = await req.json();
  const curentLanguage = generatedLanguagePrompt(language)

  if (!user.isSubscribed) {
    const today = new Date();
    const isSameDay =
      user.lastGeneratedAt &&
      today.toDateString() === new Date(user.lastGeneratedAt).toDateString();

    if (isSameDay && user.generationCount >= 6) {
      return new NextResponse(
        JSON.stringify({ error: "Limit to 6 generations a day" }),
        { status: 400, headers: { "Content-Type": "application/json" } }
      );
    }
    await prisma.user.update({
      where: { id: user.id },
      data: {
        generationCount: isSameDay ? { increment: 1 } : 1,
        lastGeneratedAt: today,
      },
    });
  }

  await prisma.message.create({
    data: {
      conversationId,
      role: 'user',
      content: description
    }
  });

  const prompt = generateCvPrompt({ description, user, curentLanguage })
  const system = generateCvSystemPrompt()

  const conversationContent = await prisma.conversation.findUnique({
    where: { id: conversationId }
  })

  const messages = await prisma.message.findMany({
    where: { conversationId },
    select: {
      role: true,
      content: true
    },
    orderBy: { createdAt: 'asc' }
  });

  const chatHistory: CoreMessage[] = messages.map(m => ({
    role: m.role as "user" | "assistant",
    content: m.content,
  }));

  chatHistory.push({
    role: "user",
    content: prompt
  });

  if (conversationContent?.content) {
    chatHistory.push({
      role: "user",
      content: conversationContent.content
    });
  }

  try {
    const result = await streamObject({
      model: gemini("gemini-1.5-flash"),
      output: 'object',
      schema: cvSchema,
      system: system,
      messages: chatHistory,
      async onFinish({ object, error }) {
        if (object === undefined) {
          console.error('Error:', error);
          return;
        }
        await prisma.message.create({
          data: {
            conversationId,
            role: 'assistant',
            content: JSON.stringify(object.cvs)
          }
        });
        await prisma.cv.create({
          data: {
            title: object.cvs.title,
            summary: Array.isArray(object.cvs.summary) ? object.cvs.summary : [object.cvs.summary ?? ""],
            skills: object.cvs.skills,
            experiences: object.cvs.experiences,
            educations: object.cvs.educations,
            certifications: object.cvs.certifications,
            projects: object.cvs.projects,
            languages: object.cvs.languages,
            conversationId: conversationId
          }
        })
      },
    });

    return result.toTextStreamResponse();
  } catch (error) {
    return new NextResponse(
      JSON.stringify({ error: "Failed to generate cv" }),
      { status: 500, headers: { "Content-Type": "application/json" } }
    );
  }
}