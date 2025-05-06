import { NextResponse } from "next/server";
import { streamObject } from "ai";
import { gemini } from "@/lib/gemini";
import prisma from "../../../../prisma/prisma"
import { generateCoverLetterPrompt, generateCoverLetterSystemPrompt } from "@/helpers/helpers";
import { coverLetterSchema } from "@/helpers/schema";
export async function POST(req: Request) {
    const { description, user, conversationId } = await req.json()
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
    const prompt = generateCoverLetterPrompt({ description, user })
    const system = generateCoverLetterSystemPrompt()
    try {
        const result = await streamObject({
            model: gemini("gemini-1.5-flash"),
            output: 'object',
            schema: coverLetterSchema,
            system: system,
            prompt: prompt,
            async onFinish({ object, error }) {
                if (object === undefined) {
                    console.error('Error:', error);
                    return;
                }
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
                        conversationId: conversationId,
                    }
                })
            },
        });

        return result.toTextStreamResponse();
    } catch (error) {
        console.error("Error while generating the cover letter:", error);
        return new NextResponse(
            JSON.stringify({ error: "Failed to generate cover letter" }),
            { status: 500, headers: { "Content-Type": "application/json" } }
        );
    }
}