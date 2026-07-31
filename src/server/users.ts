"use server";

import { headers } from "next/headers";
import { auth } from "@/lib/auth";
import { authSchema } from "@/helpers/schema";
import { prepareLegacyCredential } from "@/lib/credentials";

export async function signIn(email: string, password: string) {
  const parsed = authSchema.safeParse({ email: email.trim().toLowerCase(), password });
  if (!parsed.success) return { success: false, message: parsed.error.errors[0].message };
  try {
    await prepareLegacyCredential(parsed.data.email, parsed.data.password);
    await auth.api.signInEmail({ body: parsed.data, headers: await headers() });
    return { success: true, message: "Sign in successful" };
  } catch (error) {
    return { success: false, message: error instanceof Error ? error.message : "Sign in failed" };
  }
}

export async function signUp(email: string, password: string, name: string) {
  const parsed = authSchema.safeParse({ email: email.trim().toLowerCase(), password });
  if (!parsed.success) return { success: false, message: parsed.error.errors[0].message };
  if (name.trim().length < 3) return { success: false, message: "Name is required" };
  try {
    await auth.api.signUpEmail({
      body: { ...parsed.data, name: name.trim() },
      headers: await headers(),
    });
    return { success: true, message: "Sign up successful" };
  } catch (error) {
    return { success: false, message: error instanceof Error ? error.message : "Sign up failed" };
  }
}
