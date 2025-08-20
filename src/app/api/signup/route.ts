import bcrypt from "bcryptjs";
import { NextResponse, NextRequest } from "next/server";
import prisma from "../../../../prisma/prisma";
import { z } from "zod";
import { authSchema } from "@/helpers/schema";
import { generateVerifyCode } from "@/lib/utils";
import axios from "axios";

export const registerSchema = z.object({
  email: z.string().email({ message: "Email invalide" }),
  password: z
    .string()
    .min(6, { message: "Le mot de passe doit contenir au moins 6 caractères" }),
});


export async function POST(req: NextRequest) {
  const data = await req.json();

  const register = authSchema.safeParse(data);
  if (register.error)
    return NextResponse.json({ message: register.error.errors[0].message, data }, { status: 400 });

  try {
    const existingUser = await prisma.user.findUnique({
      where: { email: register.data.email },
    });

    if (existingUser) {
      return NextResponse.json({ message: 'Email already in use.'}, { status: 400 });
    }

    const hashedPassword = await bcrypt.hash(register.data.password, 10);
    const verifyCode = generateVerifyCode()

    const user = await prisma.user.create({
      data: { ...register.data, password: hashedPassword, verificationCode: verifyCode },
    });

    return NextResponse.json(user, { status: 200 });
  } catch (error) {
    console.log(error instanceof Error ? error.message : error);
    return NextResponse.json({ message: 'An unexpected error occurred.' }, { status: 500 });;
  }

}
