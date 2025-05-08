import bcrypt from "bcryptjs";
import { NextResponse, NextRequest } from "next/server";
import prisma from "../../../../prisma/prisma";
import { SignJWT } from "jose";
import { cookies } from "next/headers";

const SECRET_KEY = "secret_key";

const secret = new TextEncoder().encode("secret_key");

async function generateToken(user: any) {
  const token = await new SignJWT({
    id: user.id,
    email: user.email,
    role: user.role,
  })
    .setProtectedHeader({ alg: "HS256" })
    .setIssuedAt()
    .setExpirationTime(100 * 365 * 24 * 60 * 60)
    .sign(secret);

  return token;
}

export async function POST(req: NextRequest) {
  const { email, password } = await req.json();
  const user = await prisma.user.findUnique({
    where: { email },
  })

  if (!user) {
    throw new Error('Utilisateur non trouvé')
  }

  if (!user.password) {
    return NextResponse.json({ message: "Mot de passe non défini" }, { status: 400 });
  }

  const isPasswordValid = await bcrypt.compare(password, user.password)

  if (!isPasswordValid) {
    throw new Error('Mot de passe incorrect')
  }

  const token = await generateToken(user);
  
  const response = NextResponse.json({ message: "Connexion réussie" }, { status: 200 });
  
  (await cookies()).set("token_cv", token, {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "strict",
    path: "/",
    maxAge: 100 * 365 * 24 * 60 * 60, 
  });
  return response;
}