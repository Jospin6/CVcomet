import { NextResponse } from "next/server";
import prisma from "../../../../prisma/prisma";
import { CoreMessage, LanguageModel, streamObject } from "ai";
import { getAIModel } from "@/lib/ai/model";
import { generateCvPrompt, generateCvSystemPrompt, generatedLanguagePrompt } from "@/helpers/helpers";
import { cvSchema } from "@/helpers/schema";
import { getCareerProfile, careerProfileContext } from "@/lib/career-profile/service";
import { reserveProfileAI } from "@/lib/career-profile/ai";
import { generationInputSchema } from "@/lib/career-profile/schema";
import { profileJson, profileErrorResponse, profileAIError } from "@/lib/career-profile/http";
import { canAccessUser, getSessionUser } from "@/lib/auth";
import { ensureResumeGenerationJob } from "@/lib/career/resume-source-job";

export const maxDuration = 30;

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
    input = generationInputSchema.parse(await profileJson(req));
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
    await reserveProfileAI(conversationContent.userId);
  } catch (error) { return profileErrorResponse(error); }

  await prisma.message.create({
    data: {
      conversationId,
      role: "user",
      content: description,
    },
  });

  const prompt = generateCvPrompt({ description, user, curentLanguage });
  const system = generateCvSystemPrompt();

  const messages = await prisma.message.findMany({
    where: { conversationId },
    select: {
      role: true,
      content: true,
    },
    take: 20,
    orderBy: { createdAt: "desc" },
  });

  const chatHistory: CoreMessage[] = messages.reverse().map((m) => ({
    role: m.role as "user" | "assistant",
    content: m.content.slice(0, 8000),
  }));

  if (conversationContent?.content) {
    chatHistory.push({
      role: "user",
      content: generateCvPrompt({ description: conversationContent.content, user, curentLanguage }),
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
      schema: cvSchema,
      maxTokens: 5200, maxRetries: 0, abortSignal: AbortSignal.timeout(45000),
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
            content: JSON.stringify(object.cvs),
          },
        });

        await ensureResumeGenerationJob(conversationContent.userId, conversationContent.content);
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
  } catch (error) { return profileErrorResponse(profileAIError(error)); }
}
