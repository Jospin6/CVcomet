import { NextRequest, NextResponse } from "next/server";
import { originRejectionReason } from "@/lib/security/origin-policy";

/** Defense in depth: all cookie-backed API mutations must originate from CVComet. */
export function middleware(req: NextRequest) {
  if (!["POST", "PUT", "PATCH", "DELETE"].includes(req.method)) return NextResponse.next();
  // Stripe has signature verification; the cron endpoint uses its own Bearer secret.
  if (req.nextUrl.pathname === "/api/webhooks" || req.nextUrl.pathname === "/api/internal/job-boards/sync") {
    return NextResponse.next();
  }
  const reason = originRejectionReason(req, process.env);
  if (reason) return NextResponse.json({ error: reason }, { status: 403, headers: { "Cache-Control": "no-store" } });
  return NextResponse.next();
}

export const config = { matcher: ["/api/:path*"] };
