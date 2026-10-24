import { NextResponse } from "next/server";
import { ZodError } from "zod";
import { ProfileError } from "@/lib/career-profile/http";
import { CareerContractError, careerEnvelope } from "./contracts";
import { finishCareerTrace, startCareerTrace } from "./telemetry";

export async function withCareerHttp<T>(operation: string, action: () => Promise<T>, status = 200) {
  const trace = startCareerTrace(operation);
  const headers = {
    "Cache-Control": "private, no-store",
    "X-CVComet-Request-ID": trace.requestId,
    "X-CVComet-API-Version": "v1",
  };
  try {
    const data = await action();
    finishCareerTrace(trace, "ok");
    return NextResponse.json(careerEnvelope(trace.requestId, data), { status, headers });
  } catch (error) {
    const failure = error instanceof CareerContractError || error instanceof ProfileError ? error : null;
    const code = failure?.code || (error instanceof ZodError || error instanceof SyntaxError ? "VALIDATION" : "INTERNAL_ERROR");
    const httpStatus = failure?.status || (code === "VALIDATION" ? 400 : 500);
    finishCareerTrace(trace, "error", code);
    return NextResponse.json({ apiVersion: "v1", requestId: trace.requestId, error: { code } }, { status: httpStatus, headers });
  }
}
