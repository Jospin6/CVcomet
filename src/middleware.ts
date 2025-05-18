import { NextRequest, NextResponse } from "next/server";
import { jwtVerify } from "jose";

const secret = new TextEncoder().encode(process.env.JWT_SECRET || "secret_key");

async function verifyToken(token: string) {
    try {
        const { payload } = await jwtVerify(token, secret);
        return payload;
    } catch (e) {
        return null;
    }
}

// Routes nécessitant des rôles spécifiques
const routePermissions: Record<string, ("USER" | "ADMIN")[]> = {
    "/admin": ["ADMIN"],
    "/g": ["USER", "ADMIN"],
    "/profil": ["USER", "ADMIN"],
    "/templates": ["USER", "ADMIN"],
    "/upgrade": ["USER", "ADMIN"],
};

export async function middleware(request: NextRequest) {
    const token = request.cookies.get("token_cv")?.value || "";
    const path = request.nextUrl.pathname;

    if (path === "/login" || path === "/unauthorized") return NextResponse.next();

    if (!token) {
        console.log("❌ Pas de token → redirection login");
        return NextResponse.redirect(new URL("/login", request.url));
    }

    const decoded = await verifyToken(token);
    if (!decoded) {
        console.log("❌ Token invalide ou expiré");
        return NextResponse.redirect(new URL("/login", request.url));
    }

    const requiredRoles = getRequiredRoles(path);

    if (requiredRoles.length && !requiredRoles.includes(decoded.role as any)) {
        console.log(`🚫 Accès refusé pour le rôle ${decoded.role} sur ${path}`);
        return NextResponse.redirect(new URL("/unauthorized", request.url));
    }

    console.log(`✅ Accès autorisé à ${path} pour rôle ${decoded.role}`);
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
