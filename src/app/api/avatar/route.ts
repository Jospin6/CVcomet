import { NextResponse, NextRequest } from "next/server";
import prisma from "../../../../prisma/prisma"

export async function GET(req: NextRequest) {
    try {
        const { searchParams } = new URL(req.url);
        const id = searchParams.get("id");

        if (!id) {
            return new NextResponse("Missing id", { status: 400 });
        }

        const template = await prisma.template.findUnique({
            where: { id },
        });

        if (!template?.templateFile) {
            return new NextResponse("Template not found", { status: 404 });
        }

        const mimeType = "image/png";
        const headers = new Headers({ "Content-Type": mimeType });

        return new NextResponse(template.templateFile, { headers });
    } catch (error) {
        console.error("Error in avatar API:", error);
        return new NextResponse("Server error", { status: 500 });
    }
}
