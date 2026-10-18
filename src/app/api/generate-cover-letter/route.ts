import { NextResponse } from "next/server";
import { CoreMessage, LanguageModel, streamObject } from "ai";
import { getAIModel } from "@/lib/ai/model";
import prisma from "../../../../prisma/prisma";
import { generateCoverLetterPrompt, generateCoverLetterSystemPrompt, generatedLanguagePrompt } from "@/helpers/helpers";
import { coverLetterSchema } from "@/helpers/schema";
import { getCareerProfile, careerProfileContext } from "@/lib/career-profile/service";
import { reserveProfileAI } from "@/lib/career-profile/ai";
import { generationInputSchema } from "@/lib/career-profile/schema";
import { profileJson, profileErrorResponse, profileAIError } from "@/lib/career-profile/http";
import { canAccessUser, getSessionUser } from "@/lib/auth";
import { jobCoverLetter } from "@/lib/career/job-documents";
export const maxDuration = 60;

export async function POST(req: Request) {
  const session = await getSessionUser();

  if (!session) {
    return new NextResponse(JSON.stringify({ error: "Unauthorized" }), {
      status: 401,
      headers: { "Content-Type": "application/json" },
    });
  }

  let input;
  try {
    const raw = await profileJson(req);
    if (raw && typeof raw === "object" && "jobId" in raw) return NextResponse.json(await jobCoverLetter(session.id, raw));
    input = generationInputSchema.parse(raw);
  } catch (error) { return profileErrorResponse(error); }
  const { description, conversationId, language } = input;
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

  let user;
  let model: LanguageModel;
  try {
    model = await getAIModel();
    user = careerProfileContext(await getCareerProfile(conversationContent.userId));
    await reserveProfileAI(session.id);
  } catch (error) { return profileErrorResponse(error); }

  await prisma.message.create({
    data: {
      conversationId,
      role: "user",
      content: description,
    },
  });

  const prompt = generateCoverLetterPrompt({ description, user, curentLanguage });
  const system = generateCoverLetterSystemPrompt();

  const messages = await prisma.message.findMany({
    where: { conversationId },
    orderBy: { createdAt: "asc" },
  });

  const chatHistory: CoreMessage[] = messages.map((m) => ({
    role: m.role as "user" | "assistant",
    content: m.content,
  }));

  if (conversationContent?.content) {
    chatHistory.push({
      role: "user",
      content: generateCoverLetterPrompt({
        description: conversationContent.content,
        user,
        curentLanguage,
      }),
    });
  }

  chatHistory.push({
    role: "user",
    content: prompt,
  });

  try {
    const result = await streamObject({
      model,
      output: "object",
      schema: coverLetterSchema,
      system,
      messages: chatHistory,
      async onFinish({ object, error }) {
        if (object === undefined) {
          profileAIError(error);
          return;
        }

        await prisma.message.create({
          data: {
            conversationId,
            role: "assistant",
            content: JSON.stringify(object.coverLetter),
          },
        });

        await prisma.coverLetter.create({
          data: {
            recipientName: object.coverLetter.recipientName,
            recipientTitle: object.coverLetter.recipientTitle || "Hiring Manager",
            companyAddress: object.coverLetter.companyAddress,
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
            conversationId,
          },
        });
      },
    });

    return result.toTextStreamResponse();
  } catch (error) { return profileErrorResponse(profileAIError(error)); }
}
