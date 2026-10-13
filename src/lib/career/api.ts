import { NextResponse } from "next/server";
import { ProfileError } from "@/lib/career-profile/http";
import { ZodError } from "zod";
export function apiError(error: unknown) {
  if (error instanceof ProfileError) return NextResponse.json({ error: error.code }, { status: error.status });
  if (error instanceof ZodError || error instanceof SyntaxError) return NextResponse.json({ error: "VALIDATION" }, { status: 400 });
  const failure = error as { status?: number; message?: string };
  if (failure?.status && failure.status >= 400 && failure.status < 500) return NextResponse.json({ error: failure.message || "Request failed" }, { status: failure.status });
  return NextResponse.json({ error: "Unexpected error" }, { status: 500 });
}
