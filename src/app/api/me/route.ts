import { NextResponse } from "next/server";
import { getToken } from "next-auth/jwt";

const secret = process.env.NEXTAUTH_SECRET || "secret_key";

export async function GET(request: Request) {
    try {
        const token = await getToken({ req: request, secret });

        if (!token) {
            return NextResponse.json({ error: "Non authentifié" }, { status: 401 });
        }

        return NextResponse.json(token, { status: 200 });
    } catch (error) {
        return NextResponse.json({ error: "Token invalide ou expiré" }, { status: 401 });
    }
}