import { NextResponse } from "next/server";
import prisma from "../../../../../prisma/prisma";
import { getSessionUser } from "@/lib/auth";
import { resumePatchSchema } from "@/lib/resume-editor";
import { ProfileError, profileErrorResponse, profileJson } from "@/lib/career-profile/http";

type Context = { params: Promise<{ id: string }> };
export async function GET(_: Request, { params }: Context) {
  const user = await getSessionUser();
  if (!user) return NextResponse.json({ error: "UNAUTHORIZED" }, { status: 401 });
  const { id } = await params;
  const cv = await prisma.cv.findFirst({ where: { id, conversation: { userId: user.id } }, include: { coverLetters: { orderBy: { updatedAt: "desc" }, select: { id: true, positionTitle: true, companyName: true } } } });
  return cv ? NextResponse.json(cv, { headers: { "Cache-Control": "no-store" } }) : NextResponse.json({ error: "NOT_FOUND" }, { status: 404 });
}
export async function PATCH(req: Request, { params }: Context) {
  try {
    const user = await getSessionUser();
    if (!user) throw new ProfileError(401, "UNAUTHORIZED");
    const { id } = await params;
    const { revision, ...data } = resumePatchSchema.parse(await profileJson(req));
    const result = await prisma.$transaction(async tx => {
      const cv = await tx.cv.findFirst({ where: { id, conversation: { userId: user.id } } });
      if (!cv) throw new ProfileError(404, "NOT_FOUND");
      if (revision !== undefined && revision !== cv.revision) throw new ProfileError(409, "CONFLICT");
      if (!Object.keys(data).length) return cv;
      const updated = await tx.cv.updateMany({ where: { id, revision: cv.revision, conversation: { userId: user.id } }, data: { ...data, revision: { increment: 1 } } });
      if (!updated.count) throw new ProfileError(409, "CONFLICT");
      await tx.resumeVersion.create({ data: { cvId: id, label: "Before visual edit", snapshot: JSON.parse(JSON.stringify(cv)) } });
      return tx.cv.findUniqueOrThrow({ where: { id } });
    }, { maxWait: 10000, timeout: 20000 });
    return NextResponse.json(result, { headers: { "Cache-Control": "no-store" } });
  } catch (error) { return profileErrorResponse(error); }
}
export async function DELETE(_: Request, { params }: Context) {
  const user = await getSessionUser();
  if (!user) return NextResponse.json({ error: "UNAUTHORIZED" }, { status: 401 });
  const { id } = await params;
  const result = await prisma.cv.deleteMany({ where: { id, conversation: { userId: user.id } } });
  return result.count ? new NextResponse(null, { status: 204 }) : NextResponse.json({ error: "NOT_FOUND" }, { status: 404 });
}
