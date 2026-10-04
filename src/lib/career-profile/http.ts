import { NextResponse } from "next/server";
import { ZodError } from "zod";

export class ProfileError extends Error {
  readonly status: number;
  readonly code: string;
  constructor(status: number, code: string) {
    super(code);
    this.status = status;
    this.code = code;
  }
}
export function profileErrorResponse(error: unknown) {
  if (error instanceof ProfileError) return NextResponse.json({ error: error.code }, { status: error.status });
  if (error instanceof ZodError) return NextResponse.json({ error: "VALIDATION", issues: error.issues.map(x => ({ path: x.path.join("."), message: x.message })) }, { status: 400 });
  if (error instanceof SyntaxError) return NextResponse.json({ error: "INVALID_JSON" }, { status: 400 });
  if (typeof error === "object" && error && "code" in error && error.code === "P2002") return NextResponse.json({ error: "EMAIL_TAKEN" }, { status: 409 });
  console.error("Career profile request failed", error instanceof Error ? error.name : "UnknownError");
  return NextResponse.json({ error: "UNAVAILABLE" }, { status: 500 });
}
export async function boundedBody(req: Request, max: number) {
  if (Number(req.headers.get("content-length")) > max) throw new ProfileError(413, "TOO_LARGE");
  const reader = req.body?.getReader();
  if (!reader) throw new ProfileError(400, "EMPTY_BODY");
  const chunks: Uint8Array[] = [];
  let size = 0;
  try {
    while (true) {
      const { done, value } = await reader.read();
      if (done) break;
      size += value.byteLength;
      if (size > max) { await reader.cancel(); throw new ProfileError(413, "TOO_LARGE"); }
      chunks.push(value);
    }
  } finally { reader.releaseLock(); }
  return Buffer.concat(chunks);
}
export async function profileJson(req: Request) {
  if (!req.headers.get("content-type")?.includes("application/json")) throw new ProfileError(415, "INVALID_TYPE");
  return JSON.parse((await boundedBody(req, 1024 * 1024)).toString("utf8")) as unknown;
}
