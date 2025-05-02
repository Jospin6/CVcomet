import { NextResponse } from "next/server";
import prisma from "../../../../prisma/prisma"
import { SignJWT } from "jose";
import { cookies } from "next/headers";

const secret = new TextEncoder().encode("secret_key");

export async function POST(req: Request) {
    const { email } = await req.json()

    let user = await prisma.user.findUnique({
        where: { email },
    })

    if (!user) {
        user = await prisma.user.create({
            data: {
                email
            }
        })
    }

    const token = await generateToken(user);

    (await cookies()).set("token_cv", token, {
        httpOnly: true,
        secure: process.env.NODE_ENV === "production",
        sameSite: "strict",
        path: "/",
        maxAge: 100 * 365 * 24 * 60 * 60,
    });

    return NextResponse.json(user, { status: 200 });
}

export async function generateToken(user: any) {
    const token = await new SignJWT({
        id: user.id,
        email: user.email
    })
        .setProtectedHeader({ alg: "HS256" })
        .setIssuedAt()
        .setExpirationTime(100 * 365 * 24 * 60 * 60)
        .sign(secret);

    return token;
}

export async function GET(req: Request) {
    const users = await prisma.user.findMany()
    return NextResponse.json(users)
}