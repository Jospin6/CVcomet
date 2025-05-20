import { NextResponse } from "next/server";
import prisma from "../../../../../prisma/prisma"

export async function GET(req: Request) {
    const url = new URL(req.url)
    const id = url.pathname.split('/').pop() as string
    const project = await prisma.project.findUnique({
        where: { id, }
    })
    if (!project) {
        return NextResponse.json({ message: "certification not found" })
    }
    return NextResponse.json(project)
}

export async function PUT(req: Request) {
    const pathUrl = new URL(req.url)
    const id = pathUrl.pathname.split('/').pop() as string
    const { title, url, start, end, userId } = await req.json()
    const project = await prisma.project.update({
        where: { id, },
        data: { title, url, start, end, userId }
    })
    return NextResponse.json(project)
}

export async function DELETE(req: Request) {
    const url = new URL(req.url)
    const id = url.pathname.split('/').pop() as string
    await prisma.project.delete({ where: { id, } })
    return NextResponse.json({message: "Project deleted"})
}