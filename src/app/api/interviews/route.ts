import { NextResponse } from "next/server";
import prisma from "../../../../prisma/prisma";
import { requireUser } from "@/lib/career/auth-user";
import { apiError } from "@/lib/career/api";
import { z } from "zod";
import { createPreparation, preparationInput } from "@/lib/career/interview";
import { runInterviewPreparationAgent } from "@/lib/agentic/agents/interview-text/agent/interview-text.agent";

const input=z.object({type:z.enum(["HR","BEHAVIORAL","TECHNICAL","LEADERSHIP"]),applicationId:z.string().uuid().optional(),title:z.string().trim().min(1).max(160),language:z.enum(["fr","en"]).optional()}).strict();
export async function GET(){
  try{const user=await requireUser();return NextResponse.json(await prisma.interviewSession.findMany({where:{userId:user.id},include:{messages:{orderBy:{createdAt:"asc"},take:42}},orderBy:{createdAt:"desc"},take:30}));}
  catch(error){return apiError(error);}
}
export async function POST(req:Request){
  try{
    const user=await requireUser(),raw=await req.json();
    if(raw?.mode==="PREPARATION"){
      const {mode:_mode,...preparation}=raw;
      return NextResponse.json(await createPreparation(user.id,preparationInput.parse(preparation)),{status:201});
    }
    const body=input.parse(raw);
    const requestedLanguage = body.language ?? (/^fr(\b|-)/i.test(req.headers.get("accept-language") || "") ? "fr" : "en");
    const { language: _requestedLocale, ...savedBody } = body;
    const application=body.applicationId?await prisma.jobApplication.findFirst({where:{id:body.applicationId,userId:user.id},select:{id:true}}):null;
    if(body.applicationId&&!application)return NextResponse.json({error:"APPLICATION_NOT_FOUND"},{status:404});
    // Basic text practice also flows through LangGraph, without a provider call or quota.
    const prepared=await runInterviewPreparationAgent({actorId:user.id,
      input:{role:body.title.trim().length>=2 ? body.title : "General interview",level:"",language:requestedLanguage,questionCount:5,
        jobDescription:"",resumeContext:"",profile:"{}",factsFromProfile:[]},deps:{}});
    const questions=prepared.questions;
    const session=await prisma.interviewSession.create({data:{...savedBody,userId:user.id,status:"ACTIVE",configuration:{role:body.title,language:requestedLanguage,questionCount:5,questionSet:{questions,recruiterQuestions:[]}},messages:{create:{role:"assistant",content:questions[0].question}}},include:{messages:true}});
    return NextResponse.json(session,{status:201});
  }catch(error){return apiError(error);}
}
