import { NextResponse } from "next/server";
import prisma from "../../../../../../prisma/prisma"

export async function PUT(req: Request) {
    const { id, selectedTemplateId } = await req.json()

    const updateTemplateId = await prisma.user.update({
        where: { id: id },
        data: { currentTemplateId: selectedTemplateId }
    })
    return NextResponse.json(updateTemplateId)
}