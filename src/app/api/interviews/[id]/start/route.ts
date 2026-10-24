import { NextResponse } from "next/server";
import { requireUser } from "@/lib/career/auth-user";
import { apiError } from "@/lib/career/api";
import { startPreparedInterview } from "@/lib/career/interview";
export async function POST(_:Request,{params}:{params:Promise<{id:string}>}){
  try{const user=await requireUser();const {id}=await params;return NextResponse.json(await startPreparedInterview(user.id,id));}
  catch(error){return apiError(error);}
}
