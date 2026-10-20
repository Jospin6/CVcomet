import { NextResponse } from "next/server";
import prisma from "../../../../../prisma/prisma";
import { getSessionUser } from "@/lib/auth";
import { profileErrorResponse, ProfileError } from "@/lib/career-profile/http";
export async function DELETE(_: Request, { params }: { params: Promise<{ id: string }> }) { try { const user = await getSessionUser(); if (!user) throw new ProfileError(401, "UNAUTHORIZED"); const { id } = await params; const result = await prisma.careerMap.deleteMany({ where: { id, userId: user.id } }); if (!result.count) throw new ProfileError(404, "MAP_NOT_FOUND"); return new NextResponse(null, { status: 204 }); } catch (e) { return profileErrorResponse(e); } }
