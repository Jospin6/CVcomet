import { NextResponse, NextRequest } from "next/server";
import prisma from "../../../../prisma/prisma"


export async function GET(req: Request) {
    const generateCv = await prisma.cv.findMany()
    return NextResponse.json(generateCv)
}