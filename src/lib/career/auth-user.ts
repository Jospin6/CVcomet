import prisma from "../../../prisma/prisma";
import { getSessionUser } from "@/lib/auth";
export async function requireUser(){ const session=await getSessionUser(); if(!session) throw Object.assign(new Error("Unauthorized"),{status:401}); return session; }
export async function userPlan(userId:string){ const sub=await prisma.subscription.findUnique({where:{userId}}); return sub?.status === "ACTIVE" || sub?.status === "TRIALING" ? sub.plan : "FREE"; }
