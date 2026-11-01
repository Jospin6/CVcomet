import { NextResponse } from "next/server";
import { AgenticError } from "@/lib/agentic/core/errors";
import { ProfileError, profileErrorResponse } from "@/lib/career-profile/http";

/** API-safe error classification. Never return Prisma/provider internals or candidate data. */
export function careerMapErrorResponse(error: unknown) {
  if (error instanceof ProfileError || error instanceof SyntaxError) return profileErrorResponse(error);
  const prismaCode = error && typeof error === "object" && "code" in error &&
    typeof error.code === "string" ? error.code : "";
  if (error instanceof AgenticError) {
    const status = error.code === "AGENT_DEADLINE_EXCEEDED" ? 504 :
      error.code === "AGENT_CANCELLED" ? 408 : 503;
    const code = error.code === "AGENT_DEADLINE_EXCEEDED" ? "CAREER_MAP_TIMEOUT" :
      error.code === "AGENT_CANCELLED" ? "CAREER_MAP_CANCELLED" : "CAREER_MAP_GRAPH_FAILED";
    console.error("Career Map agent failure", { code: error.code });
    return NextResponse.json({ error: code }, { status });
  }
  if (["P2021", "P2022", "P1014"].includes(prismaCode)) {
    console.error("Career Map schema mismatch", { code: prismaCode });
    return NextResponse.json({ error: "CAREER_MAP_MIGRATION_REQUIRED" }, { status: 503 });
  }
  if (["P1000", "P1001", "P1002", "P1003", "P1017"].includes(prismaCode)) {
    console.error("Career Map database connection failed", { code: prismaCode });
    return NextResponse.json({ error: "CAREER_MAP_DB_UNAVAILABLE" }, { status: 503 });
  }
  if (prismaCode === "P2003") {
    console.error("Career Map database constraint failed", { code: prismaCode });
    return NextResponse.json({ error: "CAREER_MAP_DB_CONSTRAINT" }, { status: 409 });
  }
  // Other known request errors (including validation) use the existing shared contract.
  if (error && typeof error === "object" && "issues" in error) return profileErrorResponse(error);
  console.error("Career Map unexpected failure", {
    errorName: error instanceof Error ? error.name : "Unknown",
    ...(prismaCode ? { code: prismaCode.slice(0, 20) } : {}),
  });
  return NextResponse.json({ error: "CAREER_MAP_INTERNAL_ERROR" }, { status: 500 });
}
