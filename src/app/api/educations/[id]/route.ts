import { NextResponse } from "next/server";
import prisma from "../../../../../prisma/prisma"

export async function GET(req: Request) {
    const url = new URL(req.url)
    const id = url.pathname.split('/').pop() as string
    const education = await prisma.education.findUnique({
        where: {id,}
    })
    if (!education) {
        return NextResponse.json({message: "certification not found"})
    }
    return NextResponse.json(education)
}

export async function PUT(req: Request) {
    const url = new URL(req.url)
    const id = url.pathname.split('/').pop() as string
    const { degree, school, start, end, userId } = await req.json()
    const education = await prisma.education.update({
        where: {id,},
        data: { degree, school, start, end, userId }
    })
    return NextResponse.json(education)
}

export async function DELETE(req: Request) {
    const url = new URL(req.url)
    const id = url.pathname.split('/').pop() as string
    await prisma.education.delete({where: {id,}})
    return NextResponse.json({message: "education deleted"})
}