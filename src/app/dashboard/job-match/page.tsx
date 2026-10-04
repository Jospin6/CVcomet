"use client";
import {useState} from "react";
import {ArrowUpRight,BriefcaseBusiness,CheckCircle2,CircleHelp,Globe2,Link2,LoaderCircle,ShieldCheck,Sparkles} from "lucide-react";
import {PageHeader} from "@/components/ui/page-header";
import {Button} from "@/components/ui/button";
import {Input} from "@/components/ui/input";
import {ScoreRing} from "@/components/ui/score-ring";
type R={overallScore:number;skillScore:number;keywordScore:number;experienceScore:number;matchedSkills:string[];missingSkills:string[];recommendations:string[];extractionSource?:string;job:{title:string;company?:string|null;location?:string|null;seniority:string;sourceUrl?:string|null}};
export default function JobMatch(){
 const[url,setUrl]=useState("");const[r,setR]=useState<R|null>(null);const[busy,setBusy]=useState(false);const[error,setError]=useState("");
 const valid=(()=>{try{const u=new URL(url);return ["http:","https:"].includes(u.protocol)}catch{return false}})();
 const run=async()=>{setBusy(true);setError("");setR(null);try{const x=await fetch("/api/job-match",{method:"POST",headers:{"content-type":"application/json"},body:JSON.stringify({url})});const data=await x.json();if(!x.ok)throw new Error(data.error||"We couldn't analyze this job posting.");setR(data)}catch(e){setError(e instanceof Error?e.message:"We couldn't analyze this job posting.")}finally{setBusy(false)}};
 return <div className="space-y-7">
  <PageHeader title="Job Match" description="Paste a public job link. CVcomet reads the posting, extracts the requirements and compares them with your confirmed Career Profile."/>
  <section className="relative overflow-hidden rounded-2xl border border-border/70 bg-card shadow-sm">
   <div className="absolute inset-x-0 top-0 h-1 bg-primary"/>
   <div className="grid gap-8 p-6 lg:grid-cols-[1fr_320px] lg:p-8">
    <div>
     <div className="mb-5 flex size-11 items-center justify-center rounded-xl bg-primary/10 text-primary"><Globe2 className="size-5"/></div>
     <p className="text-xs font-semibold uppercase tracking-[.16em] text-primary">Job intelligence</p>
     <h2 className="mt-2 text-2xl font-semibold tracking-tight">Analyze an opportunity from its URL</h2>
     <p className="mt-2 max-w-2xl text-sm leading-6 text-muted-foreground">Use the employer's public job page whenever possible. No copying and cleaning long descriptions by hand.</p>
     <label htmlFor="job-url" className="mt-7 block text-sm font-medium">Job posting URL</label>
     <div className="mt-2 flex flex-col gap-3 sm:flex-row">
      <div className="relative flex-1"><Link2 className="absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground"/><Input id="job-url" type="url" autoComplete="url" className="h-11 pl-10" value={url} onChange={e=>setUrl(e.target.value)} onKeyDown={e=>{if(e.key==="Enter"&&valid&&!busy)run()}} placeholder="https://careers.company.com/jobs/role"/></div>
      <Button className="h-11 px-5" disabled={!valid||busy} onClick={run}>{busy?<LoaderCircle className="animate-spin"/>:<Sparkles/>}{busy?"Reading job…":"Analyze job"}</Button>
     </div>
     {url&&!valid&&<p className="mt-2 text-xs text-destructive">Enter a complete http:// or https:// job URL.</p>}
     {error&&<div role="alert" className="mt-4 rounded-xl border border-destructive/20 bg-destructive/5 p-4 text-sm text-destructive"><p className="font-medium">We couldn't read this posting</p><p className="mt-1 text-destructive/80">{error}</p><p className="mt-2 text-xs text-muted-foreground">Some job boards require sign-in or block automated access. Try the employer's public careers page.</p></div>}
    </div>
    <div className="rounded-xl border border-border/60 bg-muted/35 p-5">
     <p className="text-sm font-semibold">What CVcomet reads</p>
     <div className="mt-4 space-y-3">{["Role, company & location","Responsibilities & seniority","Required & preferred skills","Technologies, education & experience"].map(x=><div key={x} className="flex gap-2.5 text-sm text-muted-foreground"><CheckCircle2 className="mt-0.5 size-4 shrink-0 text-primary"/><span>{x}</span></div>)}</div>
     <div className="mt-5 border-t border-border/60 pt-4"><div className="flex items-start gap-2 text-xs leading-5 text-muted-foreground"><ShieldCheck className="mt-0.5 size-4 shrink-0 text-primary"/><span>Public web pages only. Private/local network addresses are blocked and job-page content is treated as untrusted data.</span></div></div>
    </div>
   </div>
  </section>
  {r&&<>
   <section className="grid gap-5 lg:grid-cols-[260px_1fr]"><div className="app-section flex flex-col items-center"><ScoreRing value={r.overallScore} label="Job match"/><p className="mt-3 text-xs text-muted-foreground">Estimated alignment</p></div><div className="app-section"><div className="flex flex-wrap items-start justify-between gap-4"><div className="flex items-start gap-3"><div className="rounded-lg bg-primary/10 p-2 text-primary"><BriefcaseBusiness className="size-5"/></div><div><h2 className="type-h2">{r.job.title}</h2><p className="mt-1 text-sm text-muted-foreground">{[r.job.company,r.job.location,r.job.seniority].filter(Boolean).join(" · ")}</p></div></div>{r.job.sourceUrl&&<a className="inline-flex items-center gap-1.5 text-sm font-medium text-primary hover:underline" href={r.job.sourceUrl} target="_blank" rel="noreferrer">Original posting<ArrowUpRight className="size-4"/></a>}</div><div className="mt-5 grid gap-3 sm:grid-cols-3">{[["Skills",r.skillScore],["Keywords",r.keywordScore],["Experience",r.experienceScore]].map(([k,v])=><div className="rounded-lg bg-muted p-4" key={String(k)}><p className="text-xs text-muted-foreground">{k}</p><b className="text-xl">{v}%</b></div>)}</div><p className="mt-4 text-xs text-muted-foreground">Posting read from {r.extractionSource==="json-ld"?"structured job data":"the public page"}. Scores are estimates, not a hiring guarantee.</p></div></section>
   <section className="grid gap-5 md:grid-cols-2"><div className="app-section"><h3 className="font-semibold">Verified matches</h3><div className="mt-4 flex flex-wrap gap-2">{r.matchedSkills.length?r.matchedSkills.map(x=><span key={x} className="inline-flex items-center gap-1 rounded-full bg-success/10 px-3 py-1 text-xs text-success"><CheckCircle2 className="size-3"/>{x}</span>):<p className="text-sm text-muted-foreground">No explicit skill match detected.</p>}</div></div><div className="app-section"><h3 className="font-semibold">Missing / unverified</h3><div className="mt-4 flex flex-wrap gap-2">{r.missingSkills.map(x=><span key={x} className="inline-flex items-center gap-1 rounded-full bg-warning/10 px-3 py-1 text-xs text-warning"><CircleHelp className="size-3"/>{x}</span>)}</div><p className="mt-4 text-xs text-muted-foreground">Confirm real experience before adding any of these to your profile or resume.</p></div></section>
  </>}
 </div>
}
