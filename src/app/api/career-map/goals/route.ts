import { NextResponse } from "next/server";
import { getSessionUser } from "@/lib/auth";
import { profileErrorResponse, profileJson, ProfileError } from "@/lib/career-profile/http";
import { createGoal, goalInputSchema } from "@/lib/career-map/service";
export async function POST(req: Request) { try { const user = await getSessionUser(); if (!user) throw new ProfileError(401, "UNAUTHORIZED"); return NextResponse.json(await createGoal(user.id, goalInputSchema.parse(await profileJson(req)))); } catch (e) { return profileErrorResponse(e); } }
