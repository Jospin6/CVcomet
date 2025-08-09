'use server';

import bcrypt from 'bcryptjs';
import { AuthError } from 'next-auth';
import jwt from 'jsonwebtoken';
import prisma from "../../prisma/prisma";
import { z } from "zod";

export const registerSchema = z.object({
  email: z.string().email({ message: "Email invalide" }),
  password: z
    .string()
    .min(6, { message: "Le mot de passe doit contenir au moins 6 caractères" }),
});

export async function signUp(
  data: z.infer<typeof registerSchema>
) {
  const register = registerSchema.safeParse(data);
  if (register.error)
    return { message: register.error.errors[0].message, data: data };
  try {
    // Vérifie si l'utilisateur existe déjà
    const existingUser = await prisma.user.findUnique({
      where: { email: register.data.email },
    });

    if (existingUser) {
      return { message: 'Email already in use.', data: register.data };
    }

    const hashedPassword = await bcrypt.hash(register.data.password, 10);

    // Crée le nouvel utilisateur
    const createdUser = await prisma.user.create({
      data: {
        ...register.data,
        password: hashedPassword,
      },
    });

    return { message: 'Registration successful', data: register.data };
  } catch (error) {
    if (error instanceof Error) {
      console.log(error.message);
    }
    return { message: 'An unexpected error occurred.' };
  }
}