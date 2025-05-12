import { NextResponse } from "next/server";
import prisma from "../../../../../../prisma/prisma"

export async function PUT(req: Request) {
    const { id, plan } = await req.json()

    const updateTemplatePlan = await prisma.template.update({
        where: { id: id },
        data: { plan }
    })
    return NextResponse.json(updateTemplatePlan)
}