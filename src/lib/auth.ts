import { betterAuth } from "better-auth";
import { prismaAdapter } from "better-auth/adapters/prisma";
import { nextCookies } from "better-auth/next-js";
import { headers } from "next/headers";
import prisma from "../../prisma/prisma";
import { hashPassword, verifyPassword } from "@/lib/password";

export const auth = betterAuth({
  secret: process.env.BETTER_AUTH_SECRET || process.env.JWT_SECRET,
  baseURL: process.env.BETTER_AUTH_URL ||
    (process.env.NODE_ENV === "production" ? process.env.NEXT_PUBLIC_APP_URL : "http://localhost:3000"),
  database: prismaAdapter(prisma, { provider: "postgresql" }),
  socialProviders: process.env.GOOGLE_CLIENT_ID && process.env.GOOGLE_CLIENT_SECRET
    ? { google: {
        clientId: process.env.GOOGLE_CLIENT_ID,
        clientSecret: process.env.GOOGLE_CLIENT_SECRET,
      } }
    : {},
  emailAndPassword: {
    enabled: true,
    minPasswordLength: 6,
    password: { hash: hashPassword, verify: verifyPassword },
  },
  user: {
    additionalFields: {
      role: { type: "string", defaultValue: "USER", input: false },
      isSubscribed: { type: "boolean", defaultValue: false, input: false },
    },
  },
  account: {
    fields: {
      accessToken: "access_token",
      refreshToken: "refresh_token",
      idToken: "id_token",
    },
  },
  session: { expiresIn: 30 * 24 * 60 * 60, updateAge: 24 * 60 * 60 },
  plugins: [nextCookies()],
});

export type SessionUser = {
  id: string;
  email: string;
  role: "USER" | "ADMIN";
};

export async function getSessionUser(): Promise<SessionUser | null> {
  const session = await auth.api.getSession({ headers: await headers() });
  if (!session) return null;
  return prisma.user.findUnique({
    where: { id: session.user.id },
    select: { id: true, email: true, role: true },
  });
}

export function isAdmin(user: SessionUser | null) {
  return user?.role === "ADMIN";
}

export function canAccessUser(user: SessionUser | null, targetUserId: string) {
  return Boolean(user && (user.role === "ADMIN" || user.id === targetUserId));
}

export function sanitizeUser<T extends { password?: unknown; verificationCode?: unknown; verificationCodeExpiresAt?: unknown; verificationCodeSentAt?: unknown; verificationCodeAttempts?: unknown }>(user: T): Omit<T, "password" | "verificationCode" | "verificationCodeExpiresAt" | "verificationCodeSentAt" | "verificationCodeAttempts"> {
  const { password, verificationCode, verificationCodeExpiresAt, verificationCodeSentAt, verificationCodeAttempts, ...rest } = user;
  void password;
  void verificationCode;
  void verificationCodeExpiresAt;
  void verificationCodeSentAt;
  void verificationCodeAttempts;
  return rest;
}
