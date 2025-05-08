import { NextResponse } from "next/server";
import prisma from "../../../../prisma/prisma";


export async function GET(req: Request) {
  try {

    const coverLetters = await prisma.coverLetter.findMany();

    return NextResponse.json(coverLetters, { status: 200 });
  } catch (error) {
    return NextResponse.json(
      { error: "Internal Server Error" },
      { status: 500 }
    );
  }
}

