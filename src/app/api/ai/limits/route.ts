import { NextResponse } from "next/server";
import { requireUser } from "@/lib/career/auth-user";
import { apiError } from "@/lib/career/api";
import { aiQuotaStatus } from "@/lib/ai/quota-service";

export const dynamic = "force-dynamic";
export async function GET() {
  try {
    const user = await requireUser();
    return NextResponse.json(await aiQuotaStatus(user.id), { headers: { "Cache-Control": "private, no-store" } });
  } catch (error) { return apiError(error); }
}
