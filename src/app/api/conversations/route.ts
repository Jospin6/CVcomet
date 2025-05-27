import { NextResponse } from "next/server";
import prisma from "../../../../prisma/prisma"
import { z } from "zod";
import { generateText } from "ai";
import { gemini } from "@/lib/gemini";

const schema = z.object({
  content: z.string(),
  userId: z.string().uuid()
});

export async function POST(req: Request) {
    try {
        const body = await req.json();
        const { content, userId } = schema.parse(body);

        const titleResponse = await generateText({
            model: gemini("gemini-1.5-flash"),
            prompt: `Create a very short and catchy summary title (max 28 characters) for the following conversation:\n\n${content}\n\nOnly return the title.`,
            maxTokens: 20,
            temperature: 0.7,
        })

        const conversations = await prisma.conversation.create({
            data: {
                title: titleResponse.text,
                content,
                userId
            }
        })
        return NextResponse.json(conversations, { status: 201 });
    } catch (error) {
        return NextResponse.json({ message: 'Internal Server Error' }, { status: 500 });
    }
}


export async function GET(req: Request) {
    const { searchParams } = new URL(req.url);
    const userId = searchParams.get("userId");
    const conversation = await prisma.conversation.findMany(
        {
            where: {
                ...(userId ? { userId } : {}),
            },
            take: 20,
            orderBy: {
                createdAt: "desc",
            },
        }
    )
    return NextResponse.json(conversation)
}