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

export function profileAIError(error: unknown): ProfileError {
  if (error instanceof ProfileError) return error;
  let current = error;
  let statusCode: number | undefined;
  let credentialsRejected = false;
  let timedOut = false;
  let modelUnavailable = false;
  let invalidResponse = false;
  const causes: string[] = [];
  let validationIssues = 0;
  const validationCodes = new Set<string>();
  for (let depth = 0; depth < 5 && current && typeof current === "object"; depth++) {
    const failure = current as { statusCode?: number; responseBody?: string; name?: string; cause?: unknown; lastError?: unknown; issues?: { code?: unknown }[] };
    if (failure.name && ["AI_NoObjectGeneratedError", "AI_TypeValidationError", "AI_JSONParseError", "ZodError"].includes(failure.name)) causes.push(failure.name);
    if (Array.isArray(failure.issues)) {
      validationIssues += failure.issues.length;
      for (const issue of failure.issues) if (typeof issue.code === "string" && /^(?:invalid_[a-z_]+|too_(?:small|big)|unrecognized_keys|custom|not_[a-z_]+)$/.test(issue.code)) validationCodes.add(issue.code);
    }
    if (typeof failure.statusCode === "number") statusCode = failure.statusCode;
    if (typeof failure.responseBody === "string" && /API_KEY_(?:INVALID|EXPIRED|SERVICE_BLOCKED|HTTP_REFERRER_BLOCKED|IP_ADDRESS_BLOCKED)/.test(failure.responseBody)) credentialsRejected = true;
    if (typeof failure.responseBody === "string" && /model_not_found|model_decommissioned|model.*(?:does not exist|not found|not supported|unsupported)/i.test(failure.responseBody)) modelUnavailable = true;
    if (failure.name === "AbortError" || failure.name === "TimeoutError") timedOut = true;
    if (["AI_NoObjectGeneratedError", "AI_TypeValidationError", "AI_JSONParseError"].includes(failure.name || "")) invalidResponse = true;
    current = failure.cause || failure.lastError;
  }
  const failure = credentialsRejected || statusCode === 401 || statusCode === 403
    ? new ProfileError(503, "AI_AUTH_ERROR")
    : statusCode === 429
      ? new ProfileError(429, "AI_RATE_LIMIT")
      : modelUnavailable || statusCode === 404
        ? new ProfileError(503, "AI_MODEL_UNAVAILABLE")
        : timedOut
        ? new ProfileError(504, "AI_TIMEOUT")
        : statusCode !== undefined && statusCode >= 500
          ? new ProfileError(503, "AI_PROVIDER_UNAVAILABLE")
        : invalidResponse
          ? new ProfileError(502, "AI_INVALID_RESPONSE")
        : new ProfileError(502, "AI_FAILED");
  // Log the category only; provider errors can contain keys or document contents.
  console.error("AI request failed", { code: failure.code, statusCode, errorName: error instanceof Error ? error.name : "UnknownError",
    ...(invalidResponse ? { causes, validationIssues, validationCodes: [...validationCodes] } : {}) });
  return failure;
}

export function profileErrorResponse(error: unknown) {
  if (error instanceof ProfileError) return NextResponse.json({ error: error.code }, { status: error.status });
  if (error instanceof ZodError) return NextResponse.json({ error: "VALIDATION", issues: error.issues.map(x => ({ path: x.path.join("."), message: x.message })) }, { status: 400 });
  if (error instanceof SyntaxError) return NextResponse.json({ error: "INVALID_JSON" }, { status: 400 });
  if (typeof error === "object" && error && "code" in error && error.code === "P2002") return NextResponse.json({ error: "EMAIL_TAKEN" }, { status: 409 });
  console.error("Career profile request failed", error instanceof Error ? error.name : "UnknownError");
  return NextResponse.json({ error: "UNAVAILABLE" }, { status: 500 });
}
export async function boundedBody(req: Pick<Request, "body" | "headers">, max: number) {
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
