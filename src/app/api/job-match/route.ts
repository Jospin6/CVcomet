import { NextResponse } from "next/server";
import prisma from "../../../../prisma/prisma";
import { requireUser } from "@/lib/career/auth-user";
import { apiError } from "@/lib/career/api";
import { analyzeJobDescription,matchJob } from "@/lib/career/job-match";
import { scrapeJobUrl,JobScrapeError } from "@/lib/career/job-scraper";
import { careerProfileContext,getCareerProfile } from "@/lib/career-profile/service";
import { z } from "zod";
const input=z.object({url:z.string().trim().url().max(2048),cvId:z.string().uuid().optional()}).strict();
export async function GET(){try{const u=await requireUser();return NextResponse.json(await prisma.jobMatch.findMany({where:{userId:u.id},include:{job:true},orderBy:{createdAt:"desc"},take:20}))}catch(e){return apiError(e)}}
export async function POST(req:Request){try{const u=await requireUser();const b=input.parse(await req.json());if(b.cvId){const own=await prisma.cv.findFirst({where:{id:b.cvId,conversation:{userId:u.id}}});if(!own)return NextResponse.json({error:"Resume not found"},{status:404})}
 const scraped=await scrapeJobUrl(b.url);const parsed=await analyzeJobDescription(scraped.description,{title:scraped.title,company:scraped.company,location:scraped.location});const profile=careerProfileContext(await getCareerProfile(u.id));
 const job=await prisma.jobOpportunity.create({data:{userId:u.id,title:parsed.title,company:parsed.company||null,location:parsed.location||null,description:scraped.description,seniority:parsed.seniority,responsibilities:parsed.responsibilities,requiredSkills:parsed.requiredSkills,preferredSkills:parsed.preferredSkills,technologies:parsed.technologies,education:parsed.education,experience:parsed.experience,keywords:parsed.keywords,sourceUrl:scraped.url}});
 const m=matchJob(JSON.stringify(profile),parsed);const saved=await prisma.jobMatch.create({data:{...m,userId:u.id,jobId:job.id,cvId:b.cvId}});return NextResponse.json({...saved,job,extractionSource:scraped.source})
 }catch(e){if(e instanceof JobScrapeError)return NextResponse.json({error:e.message,code:e.code},{status:e.status});return apiError(e)}}
