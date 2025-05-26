import { NextResponse } from "next/server";
import { CoreMessage, streamObject } from "ai";
import { gemini } from "@/lib/gemini";
import prisma from "../../../../prisma/prisma"
import { generateCoverLetterPrompt, generateCoverLetterSystemPrompt, generatedLanguagePrompt } from "@/helpers/helpers";
import { coverLetterSchema } from "@/helpers/schema";
import { dayLimit } from "@/helpers/constants";
export async function POST(req: Request) {
  const { description, user, conversationId, language } = await req.json()
  const curentLanguage = generatedLanguagePrompt(language)

  if (!user.isSubscribed) {
    const today = new Date();
    const isSameDay =
      user.lastGeneratedAt &&
      today.toDateString() === new Date(user.lastGeneratedAt).toDateString();

    if (isSameDay && user.generationCount >= dayLimit) {
      return new NextResponse(
        JSON.stringify({ error: `Limit to ${dayLimit} generations a day` }),
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
  const prompt = generateCoverLetterPrompt({ description, user, curentLanguage })
  const system = generateCoverLetterSystemPrompt()

  const messages = await prisma.message.findMany({
    where: { conversationId },
    orderBy: { createdAt: 'asc' }
  });

  const conversationContent = await prisma.conversation.findUnique({
    where: { id: conversationId }
  })

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
      schema: coverLetterSchema,
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
            content: JSON.stringify(object.coverLetter)
          }
        });
        await prisma.coverLetter.create({
          data: {
            recipientName: object.coverLetter.recipientName,
            companyAddress: object.coverLetter.companyAddress,
            recipientTitle: object.coverLetter.positionTitle,
            companyName: object.coverLetter.companyName,
            positionTitle: object.coverLetter.positionTitle,

            introduction: object.coverLetter.introduction,
            body: object.coverLetter.body,
            conclusion: object.coverLetter.conclusion,
            senderName: object.coverLetter.senderName,
            senderAddress: object.coverLetter.senderAddress,
            senderEmail: object.coverLetter.senderEmail,
            senderPhone: object.coverLetter.senderPhone,
            sendertitle: object.coverLetter.sendertitle,
            conversationId: conversationId,
          }
        })
      },
    });

    return result.toTextStreamResponse();
  } catch (error) {
    console.log("Error while generating the cover letter:", error);
    return new NextResponse(
      JSON.stringify({ error: "Failed to generate cover letter" }),
      { status: 500, headers: { "Content-Type": "application/json" } }
    );
  }
}