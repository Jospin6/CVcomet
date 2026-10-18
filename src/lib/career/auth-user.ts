import prisma from "../../../prisma/prisma";
import { getSessionUser } from "@/lib/auth";
export async function requireUser(){ const session=await getSessionUser(); if(!session) throw Object.assign(new Error("Unauthorized"),{status:401}); return session; }
export async function userPlan(userId:string){
  const sub=await prisma.subscription.findUnique({where:{userId}});
  if(sub) return sub.status === "ACTIVE" || sub.status === "TRIALING" ? sub.plan : "FREE";
  // Historical paid accounts used the existing boolean before Subscription.
  const user=await prisma.user.findUnique({where:{id:userId},select:{isSubscribed:true}});
  return user?.isSubscribed ? "PRO" as const : "FREE" as const;
}
