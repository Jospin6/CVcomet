import { NextResponse } from "next/server";
import prisma from "../../../../../../prisma/prisma"

export async function PUT(req: Request) {
    const { id, currentTemplateId } = await req.json()

    const updateTemplateId = await prisma.user.update({
        where: { id: id },
        data: { currentCoverLetterId: currentTemplateId }
    })
    return NextResponse.json(updateTemplateId)
}