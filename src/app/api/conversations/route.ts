import { NextResponse } from "next/server";
import prisma from "../../../../prisma/prisma"
import { z } from "zod";

const schema = z.object({
  content: z.string(),
  userId: z.string().uuid()
});

export async function POST(req: Request) {
    try {
        const body = await req.json();
        const { content, userId } = schema.parse(body);

        const conversations = await prisma.conversation.create({
            data: {
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
            }
        }
    )
    return NextResponse.json(conversation)
}