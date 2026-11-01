import { timingSafeEqual } from "node:crypto";
import { NextResponse } from "next/server";
import { apiError } from "@/lib/career/api";
import { ProfileError } from "@/lib/career-profile/http";
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
/** Reject oversized POST bodies even when Content-Length is missing or forged. */
async function readBoundedJson(req: Request, maxBytes = 200_000): Promise<unknown> {
  if (Number(req.headers.get("content-length") || 0) > maxBytes) throw new ProfileError(413, "TOO_LARGE");
  if (!req.body) throw new ProfileError(400, "VALIDATION");
  const reader = req.body.getReader();
  const chunks: Uint8Array[] = [];
  let size = 0;
  try {
    while (true) {
      const { value, done } = await reader.read();
      if (done) break;
      size += value.byteLength;
      if (size > maxBytes) throw new ProfileError(413, "TOO_LARGE");
      chunks.push(value);
    }
  } finally {
    reader.releaseLock();
  }
  return JSON.parse(Buffer.concat(chunks).toString("utf8"));
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
    return NextResponse.json(await completeScreening(await readBoundedJson(req)));
  } catch (error) { return apiError(error); }
}
