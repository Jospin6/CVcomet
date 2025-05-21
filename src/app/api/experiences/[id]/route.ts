import { NextResponse } from "next/server";
import prisma from "../../../../../prisma/prisma"

export async function GET(req: Request) {
    const url = new URL(req.url)
    const id = url.pathname.split('/').pop() as string
    const experience = await prisma.experience.findUnique({
        where: {id,}
    })
    if (!experience) {
        return NextResponse.json({message: "certification not found"})
    }
    return NextResponse.json(experience)
}

export async function PUT(req: Request) {
    const url = new URL(req.url)
    const id = url.pathname.split('/').pop() as string
    const { title, company, location, start, end, userId, description } = await req.json()
    const experience = await prisma.experience.update({
        where: {id,},
        data: { title, company, location, start, end, userId, description }
    })
    return NextResponse.json(experience)
}

export async function DELETE(req: Request) {
    const url = new URL(req.url)
    const id = url.pathname.split('/').pop() as string
    await prisma.experience.delete({where: {id,}})
    return NextResponse.json({message: "Experience deleted"})
}