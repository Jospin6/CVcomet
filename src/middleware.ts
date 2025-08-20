import { NextRequest, NextResponse } from "next/server";
import { getSessionCookie } from "better-auth/cookies";
import { auth } from '@/lib/auth';
import prisma from "../prisma/prisma"

const routePermissions: Record<string, ("USER" | "ADMIN")[]> = {
	"/admin": ["ADMIN"],
	"/g": ["USER", "ADMIN"],
	"/profil": ["USER", "ADMIN"],
	"/templates": ["USER", "ADMIN"],
	"/upgrade": ["USER", "ADMIN"],
};

export async function middleware(request: NextRequest) {
	const path = request.nextUrl.pathname;

	// Routes publiques qui ne nécessitent pas d'authentification
	if (path === '/login' || path === '/unauthorized') {
		return NextResponse.next();
	}

	try {
		const session = await auth.api.getSession({
			headers: request.headers
		});

		if (!session?.user) {
			return NextResponse.redirect(new URL('/login', request.url));
		}

		// Récupérez l'utilisateur avec son rôle depuis la base
		const userWithRole = await prisma.user.findUnique({
			where: { id: session.user.id },
			select: { role: true }
		});

		if (!userWithRole) {
			return NextResponse.redirect(new URL('/login', request.url));
		}

		// Vérification des rôles
		const requiredRoles = getRequiredRoles(path);
		if (requiredRoles.length && !requiredRoles.includes(userWithRole.role)) {
			return NextResponse.redirect(new URL('/unauthorized', request.url));
		}

		return NextResponse.next();

	} catch (error) {
		return NextResponse.redirect(new URL('/login', request.url));
	}
}

function getRequiredRoles(path: string): ("USER" | "ADMIN")[] {
	const keys = Object.keys(routePermissions);

	for (const key of keys) {
		if (path.startsWith(key)) {
			return routePermissions[key];
		}
	}

	return [];
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