import { NextRequest, NextResponse } from "next/server";
import { getToken } from "next-auth/jwt";

const secret = process.env.NEXTAUTH_SECRET || "secret_key";

// Routes nécessitant des rôles spécifiques
const routePermissions: Record<string, ("USER" | "ADMIN")[]> = {
    "/admin": ["ADMIN"],
    "/g": ["USER", "ADMIN"],
    "/profil": ["USER", "ADMIN"],
    "/templates": ["USER", "ADMIN"],
    "/upgrade": ["USER", "ADMIN"],
};

export async function middleware(request: NextRequest) {
    const path = request.nextUrl.pathname;

    if (path === "/login" || path === "/unauthorized") return NextResponse.next();

    // Utilise getToken d'Auth.js pour récupérer le token et le payload
    const token = await getToken({ req: request, secret });

    if (!token) {
        console.log("❌ Pas de token → redirection login");
        return NextResponse.redirect(new URL("/login", request.url));
    }

    const requiredRoles = getRequiredRoles(path);

    // On suppose que le rôle est stocké dans token.role
    if (requiredRoles.length && !requiredRoles.includes(token.role as any)) {
        console.log(`🚫 Accès refusé pour le rôle ${token.role} sur ${path}`);
        return NextResponse.redirect(new URL("/unauthorized", request.url));
    }

    console.log(`✅ Accès autorisé à ${path} pour rôle ${token.role}`);
    return NextResponse.next();
}

// 🔍 Trouve les rôles requis selon la route
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
