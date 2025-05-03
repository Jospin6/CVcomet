import { NextResponse, NextRequest } from "next/server";
import prisma from "../../../../prisma/prisma"
import axios from "axios";
import { generateObject, streamObject } from "ai";
import { gemini } from "@/lib/gemini";
import { z } from "zod";
import { generateCvPrompt, generateCvSystemPrompt } from "@/helpers/helpers";
import { cvSchema } from "@/helpers/schema";

export const maxDuration = 30;

export async function POST(req: Request) {
  const { description, user } = await req.json();
  const prompt = generateCvPrompt({ description, user })
  const system = generateCvSystemPrompt()
  try {
    const result = streamObject({
      model: gemini("gemini-1.5-flash"),
      output: 'object',
      schema: cvSchema,
      system: system,
      prompt: prompt
    });

    

    return result.toTextStreamResponse();
  } catch (error) {
    console.error("Error while generating the cv:", error);
    return new NextResponse(
      JSON.stringify({ error: "Failed to generate cv" }),
      { status: 500, headers: { "Content-Type": "application/json" } }
    );
  }
}