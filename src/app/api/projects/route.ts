import { NextResponse } from "next/server";
import prisma from "../../../../prisma/prisma"


export async function POST(req: Request) {
    const { title, url, start, end,description, userId } = await req.json()

    try {
        const projects = await prisma.project.create({
            data: {
                title,
                start,
                description, 
                end, 
                url, 
                userId 
            }
        })
        return NextResponse.json(projects, { status: 201 });
    } catch (error) {
        return NextResponse.json({ message: 'Internal Server Error' }, { status: 500 });
    }
}


export async function GET(req: Request) {
    const { searchParams } = new URL(req.url);
    const userId = searchParams.get("userId");
    const projects = await prisma.project.findMany(
        {
            where: {
                ...(userId ? { userId, } : {})
            }
        }
    )
    return NextResponse.json(projects)
}