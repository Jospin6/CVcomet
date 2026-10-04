import { NextResponse } from "next/server";
export function apiError(error:unknown){ const e=error as {status?:number;message?:string}; return NextResponse.json({error:e.message||"Unexpected error"},{status:e.status||500}); }
