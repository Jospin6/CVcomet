import { NextResponse } from "next/server";
import prisma from "../../../../../prisma/prisma";
import { getSessionUser } from "@/lib/auth";
import { coverLetterPatchSchema } from "@/lib/cover-letter-editor";
import { ProfileError, profileErrorResponse, profileJson } from "@/lib/career-profile/http";

type Context = { params: Promise<{ id: string }> };
const mine = (id: string, userId: string) => ({ id, cv: { conversation: { userId } } });

export async function GET(_: Request, { params }: Context) {
  try {
    const user = await getSessionUser(); if (!user) throw new ProfileError(401, "UNAUTHORIZED");
    const { id } = await params;
    const letter = await prisma.coverLetter.findFirst({ where: mine(id, user.id), include: { cv: { select: { id: true, title: true, design: true } }, job: { select: { id: true, title: true, company: true, description: true } } } });
    if (!letter) throw new ProfileError(404, "NOT_FOUND");
    return NextResponse.json(letter, { headers: { "Cache-Control": "no-store" } });
  } catch (error) { return profileErrorResponse(error); }
}

export async function PATCH(req: Request, { params }: Context) {
  try {
    const user = await getSessionUser(); if (!user) throw new ProfileError(401, "UNAUTHORIZED");
    const { id } = await params, { revision, ...data } = coverLetterPatchSchema.parse(await profileJson(req));
    const letter = await prisma.coverLetter.findFirst({ where: mine(id, user.id) });
    if (!letter) throw new ProfileError(404, "NOT_FOUND");
    if (revision !== undefined && letter.revision !== revision) throw new ProfileError(409, "CONFLICT");
    const updated = await prisma.coverLetter.updateMany({ where: { ...mine(id, user.id), revision: letter.revision }, data: { ...data, revision: { increment: 1 } } });
    if (!updated.count) throw new ProfileError(409, "CONFLICT");
    return NextResponse.json(await prisma.coverLetter.findUniqueOrThrow({ where: { id } }), { headers: { "Cache-Control": "no-store" } });
  } catch (error) { return profileErrorResponse(error); }
}
