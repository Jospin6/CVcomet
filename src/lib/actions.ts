"use server"

import bcrypt from "bcryptjs";
import prisma from "../../prisma/prisma";
import { z } from "zod";
import { signIn } from "./auth";
import { authSchema } from "@/helpers/schema";

export async function signUp(
    _prevState:
        | { message: string; data: { email: string; password: string } }
        | { message: string; data: null }
        | undefined,
    data: z.infer<typeof authSchema>) {
    const register = authSchema.safeParse(data);
    if (register.error)
        return { message: register.error.errors[0].message, data };

    try {
        const existingUser = await prisma.user.findUnique({
            where: { email: register.data.email },
        });

        if (existingUser) {
            return { message: 'Email already in use.', data: register.data };
        }

        const hashedPassword = await bcrypt.hash(register.data.password, 10);

        const user = await prisma.user.create({
            data: { ...register.data, password: hashedPassword },
        });

        await signIn("credentials", {
            email: user.email,
            password: register.data.password,
            redirect: false,
        });

        return { message: 'Registration successful', data: register.data };
    } catch (error) {
        console.log(error instanceof Error ? error.message : error);
        return { message: 'An unexpected error occurred.', data: null };
    }
}