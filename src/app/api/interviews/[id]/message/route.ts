import { NextResponse } from "next/server";
import { requireUser } from "@/lib/career/auth-user";
import { apiError } from "@/lib/career/api";
import { recordInterviewAnswer } from "@/lib/career/interview";
import { z } from "zod";

const input=z.object({answer:z.string().trim().min(2).max(8000)}).strict();
export async function POST(req:Request,{params}:{params:Promise<{id:string}>}){
  try{
    const user=await requireUser();
    const {id}=await params;
    const {answer}=input.parse(await req.json());
    return NextResponse.json(await recordInterviewAnswer(user.id,id,answer));
  }catch(error){return apiError(error);}
}
