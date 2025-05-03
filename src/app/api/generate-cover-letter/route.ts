import { NextResponse } from "next/server";
import { streamObject } from "ai";
import { gemini } from "@/lib/gemini";
import { z } from "zod";
import { generateCoverLetterPrompt, generateCoverLetterSystemPrompt } from "@/helpers/helpers";
import { coverLetterSchema } from "@/helpers/schema";
export async function POST(req: Request) {
    const { description, user } = await req.json()
    const prompt = generateCoverLetterPrompt({ description, user })
    const system = generateCoverLetterSystemPrompt()
    try {
        const result = await streamObject({
            model: gemini("gemini-1.5-flash"),
            output: 'object',
            schema: coverLetterSchema,
            system: system,
            prompt: prompt,
        });
    
        return result.toTextStreamResponse();
    } catch (error) {
        console.error("Error while generating the cover letter:", error);
        return new NextResponse(
            JSON.stringify({ error: "Failed to generate cover letter" }),
            { status: 500, headers: { "Content-Type": "application/json" } }
        );
    }
}