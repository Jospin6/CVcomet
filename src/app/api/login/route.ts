import bcrypt from "bcryptjs";
import { NextResponse, NextRequest } from "next/server";
import prisma from "../../../../prisma/prisma";
import { SignJWT } from "jose";
import { cookies } from "next/headers";
import { generateToken } from "@/lib/utils";

export async function POST(req: NextRequest) {
  const { email, password } = await req.json();
  const user = await prisma.user.findUnique({
    where: { email },
  })

  if (!user) {
    return NextResponse.json({ message: "Utilisateur non trouvé" }, { status: 400 });
  }

  if (!user.password) {
    return NextResponse.json({ message: "Mot de passe non défini" }, { status: 400 });
  }

  const isPasswordValid = await bcrypt.compare(password, user.password)

  if (!isPasswordValid) {
    throw new Error('Mot de passe incorrect')
  }

  const token = await generateToken(user);
  
  const response = NextResponse.json(user, { status: 200 });
  
  (await cookies()).set("token_cv", token, {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "strict",
    path: "/",
    maxAge: 100 * 365 * 24 * 60 * 60, 
  });
  return response;
}