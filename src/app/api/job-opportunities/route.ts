import { NextResponse } from "next/server";
import { z } from "zod";
import prisma from "../../../../prisma/prisma";
import { requireUser } from "@/lib/career/auth-user";
import { apiError } from "@/lib/career/api";
import { profileJson } from "@/lib/career-profile/http";
import { savedJobInput, savedJobTitle } from "@/lib/career/job-opportunities";

const query = z.object({ q: z.string().trim().max(200).default(""), cursor: z.string().uuid().optional() }).strict();
const select = { id: true, title: true, company: true, location: true, sourceName: true, createdAt: true, updatedAt: true } as const;
const summary = <T extends { title: string; sourceName?: string | null }>(job: T) => ({ ...job, title: savedJobTitle(job) });

export async function GET(req: Request) {
  try {
    const user = await requireUser();
    const { q, cursor } = query.parse(Object.fromEntries(new URL(req.url).searchParams));
    const rows = await prisma.jobOpportunity.findMany({
      where: { userId: user.id, ...(q ? { OR: [{ title: { contains: q, mode: "insensitive" as const } }, { company: { contains: q, mode: "insensitive" as const } }, { sourceName: { contains: q, mode: "insensitive" as const } }] } : {}) },
      select, orderBy: [{ createdAt: "desc" }, { id: "desc" }], take: 31,
      ...(cursor ? { cursor: { id: cursor }, skip: 1 } : {}),
    });
    return NextResponse.json({ items: rows.slice(0, 30).map(summary), nextCursor: rows.length > 30 ? rows[29].id : null }, { headers: { "Cache-Control": "no-store" } });
  } catch (error) { return apiError(error); }
}

export async function POST(req: Request) {
  try {
    const user = await requireUser();
    const body = savedJobInput.parse(await profileJson(req));
    const company = body.company || null;
    // Retrying a save must not create another entry for the same titled text.
    const existing = await prisma.jobOpportunity.findFirst({ where: { userId: user.id, title: body.title, company, description: body.description }, select });
    if (existing) return NextResponse.json(summary(existing), { headers: { "Cache-Control": "no-store" } });
    const job = await prisma.jobOpportunity.create({ data: { ...body, company, userId: user.id, originalText: body.description, sourceType: "TEXT" }, select });
    return NextResponse.json(summary(job), { status: 201, headers: { "Cache-Control": "no-store" } });
  } catch (error) { return apiError(error); }
}
