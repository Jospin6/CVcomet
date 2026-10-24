import { NextResponse } from "next/server";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/** Public liveness check. Does not probe the database or claim readiness. */
export async function GET() {
  return NextResponse.json(
    { service: "cvcomet", status: "alive", check: "liveness_only" },
    { headers: { "Cache-Control": "no-store" } },
  );
}
