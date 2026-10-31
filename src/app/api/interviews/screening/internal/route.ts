import { timingSafeEqual } from "node:crypto";
import { NextResponse } from "next/server";
import { apiError } from "@/lib/career/api";
import { completeScreening, getScreeningForWorker } from "@/lib/career/screening";

export const runtime = "nodejs";

function authorized(req: Request): boolean {
  const expected = process.env.CVCOMET_VOICE_WORKER_SECRET;
  const received = req.headers.get("authorization")?.replace(/^Bearer\s+/i, "") ?? "";
  if (!expected || !received) return false;
  const a = Buffer.from(received);
  const b = Buffer.from(expected);
  return a.length === b.length && timingSafeEqual(a, b);
}
export async function GET(req: Request) {
  if (!authorized(req)) return NextResponse.json({ error: "UNAUTHORIZED" }, { status: 401 });
  try {
    const sessionId = new URL(req.url).searchParams.get("sessionId") ?? "";
    if (!/^[0-9a-f-]{36}$/i.test(sessionId)) return NextResponse.json({ error: "BAD_SESSION" }, { status: 400 });
    return NextResponse.json(await getScreeningForWorker(sessionId), { headers: { "cache-control": "no-store" } });
  } catch (error) { return apiError(error); }
}
export async function POST(req: Request) {
  if (!authorized(req)) return NextResponse.json({ error: "UNAUTHORIZED" }, { status: 401 });
  try {
    const size = Number(req.headers.get("content-length") || 0);
    if (size > 150_000) return NextResponse.json({ error: "TOO_LARGE" }, { status: 413 });
    return NextResponse.json(await completeScreening(await req.json()));
  } catch (error) { return apiError(error); }
}
