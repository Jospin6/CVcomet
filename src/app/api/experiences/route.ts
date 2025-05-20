import { NextResponse } from "next/server";
import prisma from "../../../../prisma/prisma"


export async function POST(req: Request) {
    const { title, company, description, location, start, end, userId } = await req.json()

    try {
        const experiences = await prisma.experience.create({
            data: {
                title,
                company,
                description,
                location,
                start,
                end,
                userId
            }
        })
        return NextResponse.json(experiences, { status: 201 });
    } catch (error) {
        return NextResponse.json({ message: 'Internal Server Error' }, { status: 500 });
    }
}


export async function GET(req: Request) {
    const { searchParams } = new URL(req.url);
    const userId = searchParams.get("userId");
    const experiences = await prisma.experience.findMany(
        {
            where: {
                ...(userId ? { userId, } : {})
            }
        }
    )
    return NextResponse.json(experiences)
}