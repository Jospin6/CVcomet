import { NextResponse } from "next/server";
import prisma from "../../../../prisma/prisma"


export async function POST(req: Request) {
    const { content, userId } = await req.json()

    try {
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