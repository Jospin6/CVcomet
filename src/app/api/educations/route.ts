import { NextResponse } from "next/server";
import prisma from "../../../../prisma/prisma"


export async function POST(req: Request) {
    const { degree, school, start, description, end, userId } = await req.json()

    try {
        const educations = await prisma.education.create({
            data: {
                degree, 
                school,
                description, 
                start, 
                end, 
                userId
            }
        })
        return NextResponse.json(educations, { status: 201 });
    } catch (error) {
        return NextResponse.json({ message: 'Internal Server Error' }, { status: 500 });
    }
}


export async function GET(req: Request) {
    const { searchParams } = new URL(req.url);
    const userId = searchParams.get("userId");
    const educations = await prisma.education.findMany(
        {
            where: { 
                ...(userId ? { userId, } : {}) 
            }
        }
    )
    return NextResponse.json(educations)
}