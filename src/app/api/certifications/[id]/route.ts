import { NextResponse } from "next/server";
import prisma from "../../../../../prisma/prisma"

export async function GET(req: Request) {
    const url = new URL(req.url)
    const id = url.pathname.split('/').pop() as string
    const certification = await prisma.certification.findUnique({
        where: {id,}
    })
    if (!certification) {
        return NextResponse.json({message: "certification not found"})
    }
    return NextResponse.json(certification)
}

export async function PUT(req: Request) {
    const url = new URL(req.url)
    const id = url.pathname.split('/').pop() as string
    const { name, organization, date, userId } = await req.json()
    const certification = await prisma.certification.update({
        where: {id,},
        data: { name, organization, date, userId }
    })
    return NextResponse.json(certification)
}

export async function DELETE(req: Request) {
    const url = new URL(req.url)
    const id = url.pathname.split('/').pop() as string
    await prisma.certification.delete({where: {id,}})
    return NextResponse.json({message: "certification deleted"})
}