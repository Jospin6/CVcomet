import { NextResponse } from "next/server";
import prisma from "../../../../../prisma/prisma";
import { getSessionUser } from "@/lib/auth";

export async function GET(req: Request) {
  const session = await getSessionUser();

  if (!session) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const url = new URL(req.url);
  const id = url.pathname.split("/").pop() as string;
  const template = await prisma.template.findUnique({
    where: { id },
  });

  if (!template) {
    return NextResponse.json({ message: "Template not found" }, { status: 404 });
  }

  return NextResponse.json(template);
}
