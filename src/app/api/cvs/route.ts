import { NextResponse } from "next/server";import prisma from "../../../../prisma/prisma";import { getSessionUser,isAdmin } from "@/lib/auth";
import { z } from "zod";
import { getCareerProfile } from "@/lib/career-profile/service";
import { ProfileError, profileErrorResponse, profileJson } from "@/lib/career-profile/http";
import { resumeContactSchema, resumeDesignSchema } from "@/lib/resume-editor";
import { catalogById } from "@/lib/template-catalog";
export async function GET(req:Request){const session=await getSessionUser();if(!session)return NextResponse.json({message:"Unauthorized"},{status:401});const mine=new URL(req.url).searchParams.get("mine")==="1";if(!mine&&!isAdmin(session))return NextResponse.json({message:"Forbidden"},{status:403});const cvs=await prisma.cv.findMany({where:mine?{conversation:{userId:session.id}}:undefined,orderBy:{createdAt:"desc"},select:{id:true,title:true,summary:true,skills:true,experiences:true,educations:true,certifications:true,projects:true,languages:true,createdAt:true,updatedAt:true,revision:true,contact:true,design:true,templateId:true,conversationId:true,coverLetters:{orderBy:{updatedAt:"desc"},select:{id:true,positionTitle:true,companyName:true}}}});return NextResponse.json(cvs)}

const createInput = z.object({ source: z.enum(["PROFILE", "SCRATCH"]), templateId: z.string().max(160).optional() }).strict();
export async function POST(req: Request) {
  try {
    const user = await getSessionUser();
    if (!user) throw new ProfileError(401, "UNAUTHORIZED");
    const { source, templateId } = createInput.parse(await profileJson(req));
    const preset = templateId ? catalogById.get(templateId) : undefined;
    if (templateId && (!preset || preset.type !== "CV")) throw new ProfileError(400, "INVALID_TEMPLATE");
    const profile = source === "PROFILE" ? await getCareerProfile(user.id) : null;
    const title = profile?.headline || profile?.targetJobTitle || "My resume";
    const lines = (value: string) => value.split(/\n+/).map(line => line.trim()).filter(Boolean);
    const resume = await prisma.cv.create({ data: {
      title: source === "SCRATCH" ? "" : title, summary: profile?.summary ? [profile.summary] : [],
      contact: resumeContactSchema.parse(profile ? { name: profile.name, email: profile.email, phone: profile.phone, city: profile.address, linkedin: profile.linkedin, website: profile.portfolio } : { email: user.email }),
      design: resumeDesignSchema.parse({ documentName: title, ...(preset ? { templateId: preset.id, templateVersion: preset.version, composition: preset.composition, functionalType: preset.functionalType, layout: preset.layout, accent: preset.accent, font: preset.font, paper: preset.paper, padding: preset.layout === "modern" ? 40 : 44 } : {}) }),
      skills: profile?.skills ? [{ hardskills: profile.skills }] : [],
      experiences: profile?.experiences.map(({ id: _id, description, ...experience }) => ({ ...experience, description: lines(description) })) || [],
      educations: profile?.education.map(({ id: _id, description, ...education }) => ({ ...education, location: "", description: lines(description) })) || [],
      projects: profile?.projects.map(project => ({ title: project.title, description: project.description, link: project.url, technologies: "" })) || [],
      certifications: profile?.certifications.map(item => ({ title: item.name, issuer: item.organization, date: item.date, description: item.description })) || [],
      languages: profile?.languages ? [{ language: profile.languages, level: "" }] : [],
      conversation: { create: { title, content: source === "PROFILE" ? "Resume from confirmed career profile." : "Resume started from scratch.", userId: user.id } },
    } });
    return NextResponse.json(resume, { status: 201 });
  } catch (error) { return profileErrorResponse(error); }
}
