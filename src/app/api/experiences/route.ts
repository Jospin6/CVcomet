import { NextResponse } from "next/server";
import prisma from "../../../../prisma/prisma"


export async function POST(req: Request) {
    const { title, company, location, start, end, userId } = await req.json()

    try {
        const experiences = await prisma.experience.create({
            data: {
                title, 
                company, 
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
    const experiences = await prisma.experience.findMany()
    return NextResponse.json(experiences)
}