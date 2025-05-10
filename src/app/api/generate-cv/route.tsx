import { NextResponse, NextRequest } from "next/server";
import prisma from "../../../../prisma/prisma"
import axios from "axios";
import { generateObject, streamObject } from "ai";
import { gemini } from "@/lib/gemini";
import { z } from "zod";
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
      throw new Error("Limite gratuite de 6 CV par jour atteinte. Abonnez-vous pour génération illimitée.");
    }
    await prisma.user.update({
      where: { id: user.id },
      data: {
        generationCount: isSameDay ? { increment: 1 } : 1,
        lastGeneratedAt: today,
      },
    });
  }
  
  const prompt = generateCvPrompt({ description, user, curentLanguage })
  const system = generateCvSystemPrompt()

  try {
    const result = streamObject({
      model: gemini("gemini-1.5-flash"),
      output: 'object',
      schema: cvSchema,
      system: system,
      prompt: prompt,
      async onFinish({ object, error }) {
        if (object === undefined) {
          console.error('Error:', error);
          return;
        }
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
    console.error("Error while generating the cv:", error);
    return new NextResponse(
      JSON.stringify({ error: "Failed to generate cv" }),
      { status: 500, headers: { "Content-Type": "application/json" } }
    );
  }
}