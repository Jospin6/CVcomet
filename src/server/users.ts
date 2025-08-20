"use server";

import { auth } from "@/lib/auth"
import prisma from "../../prisma/prisma";
import bcrypt from "bcryptjs";

export const signIn = async (email: string, password: string) => {
    try {
        await auth.api.signInEmail({
            body: {
                email,
                password,
            }
        })
        return {
            success: true,
            message: "Sign in successful"
        }
    } catch (error) {
        return {
            success: false,
            message: error instanceof Error ? error.message : "Unknown error",
        }
    }
}

export const signUp = async (email: string, password: string, name: string) => {
  try {
    // 1️⃣ Créer l'utilisateur avec Better Auth
    const res = await auth.api.signUpEmail({
      body: { name, email, password },
    });

    if (!res.user) {
      return { success: false, message: "User not created" };
    }

    // 2️⃣ Créer explicitement l'account dans Prisma avec type = "credentials"
    const hashedPassword = await bcrypt.hash(password, 10);

    await prisma.account.create({
      data: {
        userId: res.user.id,
        type: "credentials",
        providerId: "credentials",
        accountId: res.user.id, // ou email
        password: hashedPassword,
      },
    });

    // 3️⃣ Vérifier si token existe pour auto-login
    if (!res.token) {
      return {
        success: true,
        message: "Signup succeeded but no session created (token is null).",
      };
    }

    return {
      success: true,
      message: "Sign up successful",
    };
  } catch (error) {
    return {
      success: false,
      message: error instanceof Error ? error.message : "Unknown error",
    };
  }
};