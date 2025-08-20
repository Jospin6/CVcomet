import { NextRequest, NextResponse } from "next/server";
import { getSessionCookie } from "better-auth/cookies";

export async function middleware(request: NextRequest) {
	const path = request.nextUrl.pathname;

	if (path.startsWith('/login') || path.startsWith('/unauthorized') || path === '/') {
		return NextResponse.next();
	}

	const sessionCookie = getSessionCookie(request.headers);
	
	if (!sessionCookie) {
		return NextResponse.redirect(new URL('/login', request.url));
	}

	return NextResponse.next();
}

export const config = {
	matcher: [
		"/g/:path*",
		"/admin/:path*",
		"/profil/:path*",
		"/templates/:path*",
		"/upgrade/:path*",
	],
};