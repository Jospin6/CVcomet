import { NextResponse } from "next/server";
import prisma from "../../../../../prisma/prisma"


export async function GET(req: Request) {
    const url = new URL(req.url);
  const id = url.pathname.split("/").pop() as string;
    const conversation = await prisma.conversation.findUnique(
        {
            where: {
                id,
            },
            include: {
                Cv: true,
                CoverLetter: true,
            }
        }
    )
    return NextResponse.json(conversation)
}