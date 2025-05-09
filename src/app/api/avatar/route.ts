
import { NextResponse, NextRequest } from "next/server";
import prisma from "../../../../prisma/prisma"

export async function GET(req: NextRequest) {
    const { searchParams } = new URL(req.url);
    const id = searchParams.get("id");

    const template = await prisma.template.findUnique({
        where: {id: id!}
    })

    const avatarBuffer = template?.templateFile
    const mimeType = 'image/png'

    const headers = new Headers({ 'Content-Type': mimeType });

    return new NextResponse(avatarBuffer, { headers });
}