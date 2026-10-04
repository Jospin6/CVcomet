import { NextResponse } from "next/server";
import prisma from "../../../../prisma/prisma";
import { getSessionUser } from "@/lib/auth";
import { z } from "zod";
import { certificationSchema } from "@/lib/career-profile/schema";
import { ProfileError, profileErrorResponse, profileJson } from "@/lib/career-profile/http";

const compatibleSchema = certificationSchema.extend({
  organization: z.preprocess(value => value ?? "", certificationSchema.shape.organization),
  date: z.preprocess(value => value ?? "", certificationSchema.shape.date),
  description: z.preprocess(value => value ?? "", certificationSchema.shape.description)
});
const inputSchema = compatibleSchema.omit({ id: true }).extend({ userId: z.string().uuid().optional() });

export async function GET(req: Request) {
  try {
    const session = await getSessionUser();
    if (!session) throw new ProfileError(401, "UNAUTHORIZED");
    const userId = new URL(req.url).searchParams.get("userId") || session.id;
    if (userId !== session.id) throw new ProfileError(403, "FORBIDDEN");
    return NextResponse.json(await prisma.certification.findMany({ where: { userId } }));
  } catch (error) { return profileErrorResponse(error); }
}
export async function POST(req: Request) {
  try {
    const session = await getSessionUser();
    if (!session) throw new ProfileError(401, "UNAUTHORIZED");
    const { userId, ...data } = inputSchema.parse(await profileJson(req));
    if (userId && userId !== session.id) throw new ProfileError(403, "FORBIDDEN");
    const result = await prisma.$transaction(async tx => {
      await tx.user.update({ where: { id: session.id }, data: { profileRevision: { increment: 1 } } });
      return tx.certification.create({ data: { ...data, userId: session.id } });
    });
    return NextResponse.json(result, { status: 201 });
  } catch (error) { return profileErrorResponse(error); }
}
