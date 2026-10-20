import { NextResponse } from "next/server";
import { getSessionUser } from "@/lib/auth";
import { profileErrorResponse, profileJson, ProfileError } from "@/lib/career-profile/http";
import { careerMapStore, createMap, mapInputSchema } from "@/lib/career-map/service";
export async function GET(){try{const user=await getSessionUser();if(!user)throw new ProfileError(401,"UNAUTHORIZED");const store=careerMapStore();const[maps,goals]=await Promise.all([store.maps.findMany({where:{userId:user.id},orderBy:{updatedAt:"desc"}}),store.goals.findMany({where:{userId:user.id},orderBy:{updatedAt:"desc"}})]);return NextResponse.json({maps,goals},{headers:{"Cache-Control":"private, no-store"}})}catch(e){return profileErrorResponse(e)}}
export async function POST(req:Request){try{const user=await getSessionUser();if(!user)throw new ProfileError(401,"UNAUTHORIZED");const store=careerMapStore(),count=await store.maps.count({where:{userId:user.id,createdAt:{gte:new Date(Date.now()-3600000)}}});if(count>=5)throw new ProfileError(429,"MAP_LIMIT");return NextResponse.json(await createMap(user.id,mapInputSchema.parse(await profileJson(req))),{status:201})}catch(e){return profileErrorResponse(e)}}
