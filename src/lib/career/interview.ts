import { profileFacts } from "@/lib/career-profile/ai-facts";
import { AgenticError } from "@/lib/agentic/core/errors";
import { runInterviewPreparationAgent, runInterviewEvaluationAgent } from "@/lib/agentic/agents/interview-text/agent/interview-text.agent";
import { defaultPreparation } from "@/lib/agentic/agents/interview-text/tools/validation.tool";
import { interviewQuestionSystemPrompt, interviewQuestionPrompt } from "@/lib/agentic/agents/interview-text/prompts/preparation.prompt";
import { interviewEvaluationSystemPrompt, interviewEvaluationPrompt } from "@/lib/agentic/agents/interview-text/prompts/evaluation.prompt";
import type { InterviewPreparationInput, InterviewEvaluationInput } from "@/lib/agentic/agents/interview-text/tools/contracts.tool";
import { z } from "zod";
import prisma from "../../../prisma/prisma";
import { getCareerProfile, careerProfileContext } from "@/lib/career-profile/service";
import { getAIModel } from "@/lib/ai/model";
import { generateObject } from "ai";
import { reserveProfileAI } from "@/lib/career-profile/ai";
import { ProfileError } from "@/lib/career-profile/http";
import {
  boundedQuestions, COACH_DISCLAIMER, fallbackQuestions, rubricScore,
  summarizeInterview, ungradedFeedback,
  type CoachFeedback, type CoachLanguage, type CoachQuestion,
} from "./interview-coach-policy";

export const preparationInput = z.object({
  role:z.string().trim().min(2).max(160),
  level:z.string().max(80).default(""),
  language:z.enum(["fr","en"]).default("en"),
  questionCount:z.union([z.literal(5),z.literal(10),z.literal(15),z.literal(20)]).default(20),
  cvId:z.string().uuid().optional(),
  applicationId:z.string().uuid().optional(),
  jobDescription:z.string().max(12000).optional(),
}).strict();
const questionOutput = z.object({
  questions:z.array(z.object({question:z.string().min(5).max(500),suggestedAnswer:z.string().max(1500),focus:z.string().max(120)})).min(5).max(20),
  recruiterQuestions:z.array(z.string().min(5).max(400)).max(10),
});
const evaluationOutput = z.object({
  relevance:z.number().int().min(0).max(4),
  specificity:z.number().int().min(0).max(4),
  structure:z.number().int().min(0).max(4),
  clarity:z.number().int().min(0).max(4),
  strength:z.string().trim().max(240),
  improvement:z.string().trim().min(5).max(300),
  nextExercise:z.string().trim().min(5).max(300),
  evidenceQuote:z.string().max(160),
});

type SessionConfig = {language?: CoachLanguage; role?: string; questionCount?: number; questionSet?: {questions?: CoachQuestion[]; recruiterQuestions?: string[]}};
function configOf(value:unknown):SessionConfig {
  if (!value || typeof value !== "object" || Array.isArray(value)) return {};
  return value as SessionConfig;
}
function langOf(value:unknown):CoachLanguage { return configOf(value).language === "en" ? "en" : "fr"; }
export function questionsOf(value:unknown):CoachQuestion[] {
  const c=configOf(value), count=[5,10,15,20].includes(c.questionCount||0) ? c.questionCount! : Math.max(1,Math.min(20,c.questionSet?.questions?.length||5));
  return boundedQuestions(c.questionSet?.questions,count,langOf(value));
}

/** Model invocation runs only through the generation node of the interview-text graph.
 * Quota is reserved by the already-authenticated service before graph entry. */
async function generatePreparationQuestions(input: InterviewPreparationInput, signal: AbortSignal) {
  const r=await generateObject({model:await getAIModel({structuredOutputs:true}),schema:questionOutput,
    temperature:0,maxTokens:3200,maxRetries:1,
    abortSignal:AbortSignal.any([signal,AbortSignal.timeout(40000)]),
    system:interviewQuestionSystemPrompt, prompt:interviewQuestionPrompt(input)});
  return r.object;
}

export async function createPreparation(userId:string,input:z.infer<typeof preparationInput>) {
  const application=input.applicationId?await prisma.jobApplication.findFirst({where:{id:input.applicationId,userId},include:{job:{select:{description:true}}}}):null;
  if(input.applicationId&&!application)throw new ProfileError(404,"APPLICATION_NOT_FOUND");
  if (application?.cvId && input.cvId && application.cvId !== input.cvId) {
    throw new ProfileError(409, "APPLICATION_RESUME_MISMATCH");
  }
  const cvId=application?.cvId || input.cvId;
  const cv = cvId ? await prisma.cv.findFirst({
    where: { id: cvId, conversation: { userId } },
    select: { title: true, summary: true, skills: true, experiences: true,
      educations: true, projects: true, certifications: true },
  }) : null;
  if (cvId && !cv) throw new ProfileError(404,"RESUME_NOT_FOUND");
  const resumeContext = cv ? JSON.stringify(cv).slice(0,12000) : "";
  const jobDescription = application?.job?.description?.slice(0,12000)
    || input.jobDescription?.slice(0,12000) || "";
  const role=application?.jobTitle||input.role;
  const careerProfile = await getCareerProfile(userId);
  const profile=careerProfileContext(careerProfile);
  // Contact data and personal identifiers are unnecessary to coaching.
  const professionalProfile=JSON.stringify({headline:profile.headline,summary:profile.summary,
    skills:profile.skills,experienceLevel:profile.experienceLevel,
    experiences:profile.experiences,education:profile.education,
    projects:profile.projects,certifications:profile.certifications}).slice(0,12000);
  const factsFromProfile = profileFacts(careerProfile, 30);
  const graphInput:InterviewPreparationInput={role,level:input.level,language:input.language,
    questionCount:input.questionCount,jobDescription,resumeContext,profile:professionalProfile,factsFromProfile};
  let questionSet=defaultPreparation(input.questionCount,input.language);
  try {
    await reserveProfileAI(userId,"INTERVIEW_PREPARATION");
    questionSet=await runInterviewPreparationAgent({actorId:userId,input:graphInput,
      deps:{generateQuestions:generatePreparationQuestions}});
  } catch(error) {
    if(error instanceof ProfileError && error.status===429) throw error;
    if(error instanceof AgenticError) throw error; // Graph/identity errors must not be hidden.
    // A temporary AI failure must not create fictional questions or answers.
    // Other authorization checks have already happened before the graph.
  }
  return prisma.interviewSession.create({data:{userId,type:"BEHAVIORAL",title:`${role} practice`,applicationId:application?.id,status:"PREPARATION",
    configuration:{...input,jobDescription:jobDescription.slice(0,12000),role,cvId,
      questionSet:{questions:questionSet.questions,recruiterQuestions:questionSet.recruiterQuestions}}}});
}

/** Activate a prepared session itself, retaining its original questions and application. */
export async function startPreparedInterview(userId:string,id:string) {
  const session=await prisma.interviewSession.findFirst({where:{id,userId},select:{id:true,status:true,configuration:true}});
  if(!session) throw new ProfileError(404,"NOT_FOUND");
  if(session.status!=="PREPARATION") throw new ProfileError(409,"INTERVIEW_ALREADY_STARTED");
  const questions=questionsOf(session.configuration);
  return prisma.$transaction(async tx => {
    const claimed=await tx.interviewSession.updateMany({where:{id,userId,status:"PREPARATION"},data:{status:"ACTIVE",currentQuestion:0}});
    if(claimed.count!==1)throw new ProfileError(409,"INTERVIEW_ALREADY_STARTED");
    await tx.interviewMessage.create({data:{sessionId:id,role:"assistant",content:questions[0].question}});
    return tx.interviewSession.findFirstOrThrow({where:{id,userId},include:{messages:{orderBy:{createdAt:"asc"}}}});
  });
}

async function generateEvaluation(input:InterviewEvaluationInput,signal:AbortSignal) {
  const {object}=await generateObject({model:await getAIModel({structuredOutputs:true}),schema:evaluationOutput,
    temperature:0,maxTokens:850,maxRetries:1,
    abortSignal:AbortSignal.any([signal,AbortSignal.timeout(20000)]),
    system:interviewEvaluationSystemPrompt, prompt:interviewEvaluationPrompt(input)});
  // Early rubric validation: scores are NEVER taken from model-provided overall grades.
  const criteria={relevance:object.relevance,specificity:object.specificity,structure:object.structure,clarity:object.clarity};
  rubricScore(criteria);
  return object;
}

export async function evaluateInterviewAnswer(userId:string,question:string,answer:string,language:CoachLanguage,role:string):Promise<CoachFeedback> {
  try {
    await reserveProfileAI(userId,"INTERVIEW_PREPARATION");
    const result=await runInterviewEvaluationAgent({actorId:userId,
      input:{role:role.slice(0,160),question:question.slice(0,500),answer:answer.slice(0,8000),language},
      deps:{evaluateAnswer:generateEvaluation}});
    return result.feedback;
  } catch {
    // No fabricated fallback grade on provider errors, quota denial or timeout.
    return ungradedFeedback(language);
  }
}

export async function recordInterviewAnswer(userId:string,id:string,answer:string) {
  const session=await prisma.interviewSession.findFirst({where:{id,userId},include:{messages:{orderBy:{createdAt:"asc"},take:42}}});
  if(!session)throw new ProfileError(404,"NOT_FOUND");
  if(session.status!=="ACTIVE")throw new ProfileError(409,"INTERVIEW_NOT_ACTIVE");
  const questions=questionsOf(session.configuration),index=session.currentQuestion;
  if(index>=questions.length)throw new ProfileError(409,"INTERVIEW_FINISHED");
  // Older saved sessions may not have a questionSet: grade the question actually shown.
  const question=[...session.messages].reverse().find(message=>message.role==="assistant")?.content||questions[index].question;
  // No score until a real evaluator returned structured feedback.
  const feedback=await evaluateInterviewAnswer(userId,question,answer,langOf(session.configuration),session.title);
  const score=feedback.score;
  return prisma.$transaction(async tx=>{
    // Compare-and-swap: a stale or duplicate request can never advance the same question twice.
    const isLast=index+1>=questions.length;
    const claimed=await tx.interviewSession.updateMany({where:{id,userId,status:"ACTIVE",currentQuestion:index},data:{currentQuestion:{increment:1},status:isLast?"READY_TO_FINISH":"ACTIVE"}});
    if(claimed.count!==1)throw new ProfileError(409,"INTERVIEW_STATE_CHANGED");
    const userMsg=await tx.interviewMessage.create({data:{sessionId:id,role:"user",content:answer,score,feedback}});
    const next=isLast?null:await tx.interviewMessage.create({data:{sessionId:id,role:"assistant",content:questions[index+1].question}});
    const previous=session.messages.filter(m=>m.role==="user"&&typeof m.score==="number").map(m=>m.score as number);
    if(typeof score==="number")previous.push(score);
    const overall=previous.length?Math.round(previous.reduce((a,b)=>a+b,0)/previous.length):null;
    await tx.interviewSession.update({where:{id},data:{overallScore:overall,summary:COACH_DISCLAIMER}});
    return {answer:userMsg,next,feedback,progress:{answered:index+1,total:questions.length,completed:isLast},overallScore:overall,status:isLast?"READY_TO_FINISH":"ACTIVE"};
  });
}

export async function finishInterview(userId:string,id:string) {
  const session=await prisma.interviewSession.findFirst({where:{id,userId},include:{messages:{where:{role:"user"},orderBy:{createdAt:"asc"}}}});
  if(!session)throw new ProfileError(404,"NOT_FOUND");
  if(session.status==="PREPARATION")throw new ProfileError(409,"INTERVIEW_NOT_STARTED");
  if(session.status==="COMPLETED")return session;
  const report=summarizeInterview(session.messages.map(m=>({score:m.score,feedback:m.feedback as CoachFeedback|null})),langOf(session.configuration));
  const updated=await prisma.interviewSession.updateMany({where:{id,userId,status:{in:["ACTIVE","READY_TO_FINISH"]}},data:{status:"COMPLETED",overallScore:report.overallScore,summary:report.summary,report}});
  if(updated.count!==1)throw new ProfileError(409,"INTERVIEW_STATE_CHANGED");
  return prisma.interviewSession.findFirstOrThrow({where:{id,userId},include:{messages:{orderBy:{createdAt:"asc"}}}});
}
