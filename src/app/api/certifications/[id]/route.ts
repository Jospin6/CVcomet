import { NextResponse } from "next/server";
import prisma from "../../../../../prisma/prisma";
import { getSessionUser } from "@/lib/auth";
import { z } from "zod";
import { certificationSchema } from "@/lib/career-profile/schema";
import { ProfileError, profileErrorResponse, profileJson } from "@/lib/career-profile/http";

const compatibleSchema = certificationSchema.extend({
  organization: z.preprocess(value => value ?? "", certificationSchema.shape.organization),
  date: z.preprocess(value => value ?? "", certificationSchema.shape.date),
  description: z.preprocess(value => value ?? "", certificationSchema.shape.description)
});
const inputSchema = compatibleSchema.extend({ userId: z.string().uuid().optional() });
async function owned(req: Request) {
  const session = await getSessionUser();
  if (!session) throw new ProfileError(401, "UNAUTHORIZED");
  const id = z.string().uuid().parse(new URL(req.url).pathname.split("/").pop());
  const item = await prisma.certification.findFirst({ where: { id, userId: session.id } });
  if (!item) throw new ProfileError(404, "NOT_FOUND");
  return { session, item };
}
export async function GET(req: Request) {
  try { return NextResponse.json((await owned(req)).item); }
  catch (error) { return profileErrorResponse(error); }
}
export async function PUT(req: Request) {
  try {
    const { session, item } = await owned(req);
    const { userId, id, ...data } = inputSchema.parse(await profileJson(req));
    if ((userId && userId !== session.id) || (id && id !== item.id)) throw new ProfileError(403, "FORBIDDEN");
    const result = await prisma.$transaction(async tx => {
      await tx.user.update({ where: { id: session.id }, data: { profileRevision: { increment: 1 } } });
      return tx.certification.update({ where: { id: item.id, userId: session.id }, data });
    });
    return NextResponse.json(result);
  } catch (error) { return profileErrorResponse(error); }
}
export async function DELETE(req: Request) {
  try {
    const { session, item } = await owned(req);
    await prisma.$transaction(async tx => {
      await tx.user.update({ where: { id: session.id }, data: { profileRevision: { increment: 1 } } });
      await tx.certification.delete({ where: { id: item.id, userId: session.id } });
    });
    return NextResponse.json({ message: "Deleted" });
  } catch (error) { return profileErrorResponse(error); }
}
