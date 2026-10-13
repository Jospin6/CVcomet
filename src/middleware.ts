import { getSessionCookie } from "better-auth/cookies";
import { NextRequest, NextResponse } from "next/server";
import type { SessionUser } from "@/lib/auth";

export async function middleware(request: NextRequest) {
  const loginURL = new URL("/login", request.url);
  loginURL.searchParams.set("redirect", request.nextUrl.pathname + request.nextUrl.search);
  if (!getSessionCookie(request.headers)) return NextResponse.redirect(loginURL);

  const response = await fetch(new URL("/api/auth/get-session", request.url), {
    headers: { cookie: request.headers.get("cookie") || "" },
    cache: "no-store",
  });
  if (!response.ok) return NextResponse.redirect(loginURL);
  const session: { user: SessionUser } | null = await response.json();
  if (!session?.user) return NextResponse.redirect(loginURL);

  if (request.nextUrl.pathname.startsWith("/admin") && session.user.role !== "ADMIN") {
    return NextResponse.redirect(new URL("/unauthorized", request.url));
  }
  return NextResponse.next();
}

export const config = {
  matcher: ["/dashboard/:path*", "/onboarding/:path*", "/settings/:path*", "/g/:path*", "/admin/:path*", "/profil/:path*", "/templates/:path*", "/upgrade/:path*"],
};
