import { NextResponse } from "next/server";
import prisma from "../../../../prisma/prisma";
import { getSessionUser } from "@/lib/auth";
import { ProfileError, profileErrorResponse } from "@/lib/career-profile/http";
import { readResumeUploads, resumeDocumentSelect } from "@/lib/resume-files";

export const runtime = "nodejs";

export async function GET() {
  try {
    const user = await getSessionUser();
    if (!user) throw new ProfileError(401, "UNAUTHORIZED");
    const documents = await prisma.uploadedResume.findMany({ where: { userId: user.id }, select: resumeDocumentSelect, orderBy: { createdAt: "desc" } });
    return NextResponse.json(documents, { headers: { "Cache-Control": "private, no-store" } });
  } catch (error) { return profileErrorResponse(error); }
}

export async function POST(req: Request) {
  try {
    const user = await getSessionUser();
    if (!user) throw new ProfileError(401, "UNAUTHORIZED");
    const uploads = await readResumeUploads(req);
    const documents = await prisma.$transaction(uploads.map(data => prisma.uploadedResume.create({ data: { ...data, userId: user.id }, select: resumeDocumentSelect })));
    return NextResponse.json(documents, { status: 201, headers: { "Cache-Control": "private, no-store" } });
  } catch (error) { return profileErrorResponse(error); }
}
