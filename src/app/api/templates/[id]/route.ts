
import { NextResponse } from "next/server";
import prisma from "../../../../../prisma/prisma"

export async function GET(req: Request) {
    const url = new URL(req.url)
    const id = url.pathname.split('/').pop() as string
    const experience = await prisma.template.findUnique({
        where: { id, }
    })
    if (!experience) {
        return NextResponse.json({ message: "certification not found" })
    }
    return NextResponse.json(experience)
}