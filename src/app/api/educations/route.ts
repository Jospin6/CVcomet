import { NextResponse } from "next/server";
import prisma from "../../../../prisma/prisma"


export async function POST(req: Request) {
    const { degree, school, start, end, userId } = await req.json()

    try {
        const educations = await prisma.education.create({
            data: {
                degree, 
                school, 
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
    const educations = await prisma.education.findMany()
    return NextResponse.json(educations)
}