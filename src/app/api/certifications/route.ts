import { NextResponse } from "next/server";
import prisma from "../../../../prisma/prisma"


export async function POST(req: Request) {
    const { name, organization,description, date, userId } = await req.json()

    try {
        const certifications = await prisma.certification.create({
            data: {
                name,
                organization,
                description,
                date,
                userId
            }
        })
        return NextResponse.json(certifications, { status: 201 });
    } catch (error) {
        return NextResponse.json({ message: 'Internal Server Error' }, { status: 500 });
    }
}


export async function GET(req: Request) {
    const certifications = await prisma.certification.findMany()
    return NextResponse.json(certifications)
}