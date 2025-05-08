import { NextResponse } from "next/server";
import prisma from "../../../../../prisma/prisma"
import { cookies } from "next/headers";
import { SignJWT } from "jose";

const secret = new TextEncoder().encode("secret_key");

export async function GET(req: Request) {
  const url = new URL(req.url)
  const id = url.pathname.split('/').pop() as string
  const user = await prisma.user.findUnique({
    where: { id, },
    include: {
      Experience: true,
      Education: true,
      Project: true,
    },
  })
  if (!user) {
    return NextResponse.json({ message: "User not found" })
  }
  return NextResponse.json(user)
}

export async function PUT(req: Request) {
  const url = new URL(req.url);
  const id = url.pathname.split("/").pop() as string;
  const body = await req.json();

  const {
    name,
    email,
    phone,
    address,
    linkedin,
    portfolio,
    github,
    skills,
  } = body;

  let user = await prisma.user.findUnique({
    where: { id },
  });

  if (!user) {
    user = await prisma.user.create({
      data: {
        name,
        email,
        phone,
        address,
        github,
        linkedin,
        portfolio,
        skills,
      },
    });

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

  const updatedUser = await prisma.user.update({
    where: { id },
    data: {
      name,
      phone,
      address,
      github,
      email,
      linkedin,
      portfolio,
      skills,
    },
  });

  return NextResponse.json(updatedUser, { status: 200 });
}

export async function DELETE(req: Request) {
  const url = new URL(req.url)
  const id = url.pathname.split('/').pop() as string
  await prisma.user.delete({ 
    where: { id, }, 
  })
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