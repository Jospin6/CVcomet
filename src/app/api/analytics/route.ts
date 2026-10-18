import { NextResponse } from "next/server";
import { Prisma } from "@prisma/client";
import prisma from "../../../../prisma/prisma";
import { requireUser } from "@/lib/career/auth-user";
import { apiError } from "@/lib/career/api";
export async function GET() {
  try {
    const user = await requireUser();
    const [apps, ats, matches, interviews] = await Promise.all([
      prisma.jobApplication.findMany({ where: { userId: user.id } }),
      prisma.atsAnalysis.findMany({ where: { userId: user.id }, orderBy: { createdAt: "desc" }, take: 50 }),
      prisma.jobMatch.findMany({ where: { userId: user.id, overallScore: { not: null }, result: { not: Prisma.DbNull } }, orderBy: { createdAt: "desc" }, take: 50 }),
      prisma.interviewSession.findMany({ where: { userId: user.id } }),
    ]);
    const total = apps.length, interviewCount = apps.filter(app => ["INTERVIEW", "TECHNICAL_INTERVIEW", "OFFER"].includes(app.status)).length, offers = apps.filter(app => app.status === "OFFER").length;
    return NextResponse.json({ applications: total, interviews: interviewCount, offers,
      responseRate: total ? Math.round(apps.filter(app => app.status !== "SAVED" && app.status !== "APPLIED").length / total * 100) : 0,
      interviewRate: total ? Math.round(interviewCount / total * 100) : 0, offerRate: total ? Math.round(offers / total * 100) : 0,
      averageAts: ats.length ? Math.round(ats.reduce((sum, item) => sum + item.overallScore, 0) / ats.length) : 0,
      averageMatch: matches.length ? Math.round(matches.reduce((sum, item) => sum + (item.overallScore ?? 0), 0) / matches.length) : 0,
      practiceSessions: interviews.length });
  } catch (error) { return apiError(error); }
}
