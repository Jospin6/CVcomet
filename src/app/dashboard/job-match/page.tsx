"use client";
import { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import { useTranslation } from "react-i18next";
import { ArrowUpRight, BriefcaseBusiness, Copy, FileText, LoaderCircle, Mail, Save, Sparkles } from "lucide-react";
import { PageHeader } from "@/components/ui/page-header";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { ScoreRing } from "@/components/ui/score-ring";
import { useApi } from "@/components/career/data-state";
import { JobAnalysisForm, jobRequest as request, useJobAnalysisForm } from "@/components/career/job-analysis-form";
import { type JobAnalysis, type JobSource, type MatchResult, type TailorProposal } from "@/lib/career/job-schema";
import type { z } from "zod";
import type { coverLetterSchema } from "@/helpers/schema";

type Letter = z.infer<typeof coverLetterSchema>["coverLetter"];
type Email = { subject: string; body: string };
type Result = { id: string; cvId: string | null; tailoredCvId?: string | null; result: MatchResult | null; tailoring?: TailorProposal | null; job: {
  id: string; title: string; company: string | null; description: string; originalText?: string | null; sourceUrl?: string | null; sourceType: JobSource["type"]; sourceName?: string | null; analysis: JobAnalysis | null;
  documentDrafts?: { letter?: { draft: Letter }; email?: { draft: Email } } | null; applications?: { id: string }[]; coverLetters?: { id: string; cvId: string | null }[];
} };
type History = { id: string; overallScore: number | null; job: { title: string; company: string | null } };
export default function JobMatch() {
  const { i18n } = useTranslation();
  const history = useApi<History[]>("/api/job-match");
  const [result, setResult] = useState<Result | null>(null);
  const [category, setCategory] = useState(""), [status, setStatus] = useState("");
  const [proposal, setProposal] = useState<TailorProposal | null>(null), [paths, setPaths] = useState<string[]>([]);
  const [language, setLanguage] = useState<"fr" | "en">(i18n.resolvedLanguage?.startsWith("fr") ? "fr" : "en"), [notes, setNotes] = useState("");
  const [letter, setLetter] = useState<Letter | null>(null), [email, setEmail] = useState<Email | null>(null), [letterConversation, setLetterConversation] = useState(""), [applicationId, setApplicationId] = useState("");
  const form = useJobAnalysisForm<Result>({
    language,
    onTextChanged: () => setResult(null),
    onExtracted: () => { setResult(null); setProposal(null); setLetter(null); setEmail(null); },
    onAnalyzed: async data => {
      setResult(data); setProposal(null); setLetter(null); setEmail(null); setApplicationId(""); setLetterConversation("");
      window.history.replaceState(null, "", "?analysis=" + data.id); await history.reload();
    },
  });
  const { c, resumes, cvId, setCvId, setText, setSource, setConfirmed, busy, setBusy, error, setError, message, setMessage, act, errorText } = form;
  const loadMatch = useCallback(async (id: string) => {
    setBusy("history"); setError(""); setMessage("");
    try {
      const data = await request<Result>("/api/job-match?id=" + encodeURIComponent(id));
      setResult(data); setText(data.job.description); setSource({ type: data.job.sourceType || "TEXT", url: data.job.sourceUrl || undefined, name: data.job.sourceName || undefined, originalText: data.job.originalText || data.job.description }); setConfirmed(false); setCvId(data.cvId || "");
      setProposal(data.tailoredCvId ? null : data.tailoring || null); setPaths(data.tailoring?.changes.map(change => change.path) || []);
      setLetter(data.job.documentDrafts?.letter?.draft || null); setEmail(data.job.documentDrafts?.email?.draft || null); setLetterConversation(data.job.coverLetters?.find(item => item.cvId === (data.tailoredCvId || data.cvId))?.id || ""); setApplicationId(data.job.applications?.[0]?.id || "");
      if (!data.result || !data.job.analysis) setError("JOB_REANALYZE");
      window.history.replaceState(null, "", "?analysis=" + id);
    } catch (failure) { setError(failure instanceof Error ? failure.message : "UNAVAILABLE"); }
    finally { setBusy(""); }
  }, [setBusy, setError, setMessage, setText, setSource, setConfirmed, setCvId]);
  useEffect(() => { const id = new URL(window.location.href).searchParams.get("analysis"); if (id) void loadMatch(id); }, [loadMatch]);
  const generateProposal = (mode: "TAILOR" | "IMPROVE") => act("tailor", async () => {
    if (!result || !cvId) return;
    const data = await request<TailorProposal>("/api/tailor-resume", { action: "PROPOSE", mode, matchId: result.id, cvId, language });
    setProposal(data); setPaths(data.changes.map(change => change.path));
  });
  const saveProposal = () => act("accept", async () => {
    if (!result || !proposal) return;
    const data = await request<{ cvId: string }>("/api/tailor-resume", { action: "ACCEPT", matchId: result.id, proposalId: proposal.id, paths });
    setResult({ ...result, tailoredCvId: data.cvId }); setProposal(null); setMessage(c.saved); await resumes.reload();
  });
  const documentBody = () => ({ jobId: result!.job.id, cvId: result!.tailoredCvId || cvId || undefined, language, notes });
  const generateLetter = () => act("letter", async () => { const data = await request<{ draft: Letter }>("/api/generate-cover-letter", { ...documentBody(), action: "GENERATE" }); setLetter(data.draft); });
  const generateEmail = () => act("email", async () => { setEmail(await request<Email>("/api/application-email", { ...documentBody(), action: "GENERATE" })); });
  const saveLetter = () => act("save-letter", async () => { const data = await request<{ letterId: string }>("/api/generate-cover-letter", { ...documentBody(), action: "SAVE", draft: letter }); setLetterConversation(data.letterId); setMessage(c.saved); });
  const saveEmail = () => act("save-email", async () => { await request("/api/application-email", { ...documentBody(), action: "SAVE", draft: email }); setMessage(c.saved); });
  const saveApplication = () => act("application", async () => { const data = await request<{ id: string }>("/api/applications", { jobId: result!.job.id, cvId: result!.tailoredCvId || cvId || undefined }); setApplicationId(data.id); setMessage(c.saved); });
  const copy = (value: string) => act("copy", async () => { await navigator.clipboard.writeText(value); setMessage(c.copied); });
  const analysis = result?.job.analysis, match = result?.result;
  const requirements = match?.requirements.filter(item => (!category || item.category === category) && (!status || item.status === status)) || [];

  return <div className="space-y-7">
    <PageHeader title={c.title} description={c.description} />
    {error && <div role="alert" className="rounded-xl border border-destructive/25 bg-destructive/5 p-4 text-sm text-destructive">{errorText}{error === "FEATURE_NOT_AVAILABLE" && <Link className="ml-2 underline" href="/upgrade">{c.upgrade}</Link>}</div>}
    {busy && <p role="status" aria-live="polite" className="flex items-center gap-2 text-sm text-muted-foreground"><LoaderCircle className="size-4 animate-spin" />{busy === "extract" ? c.extracting : busy === "analyze" ? c.analyzing : c.working}</p>}
    {message && <p role="status" className="text-sm text-primary">{message}</p>}
    <section className="app-section" aria-label={c.title}><JobAnalysisForm form={form} /></section>
    {result && analysis && match && <>
      <section className="app-section space-y-5">
        <div className="flex flex-col justify-between gap-5 sm:flex-row"><div><h2 className="text-xl font-semibold">{analysis.title || c.unspecified}</h2><p className="mt-1 text-sm text-muted-foreground">{analysis.company || c.unspecified}{analysis.location && " · " + analysis.location}</p><p className="mt-3 text-sm leading-7">{analysis.summary}</p></div>{match.overallScore !== null ? <ScoreRing value={match.overallScore} label={c.score} /> : <div className="rounded-xl bg-muted p-4 sm:max-w-64"><p className="font-medium">{c.unavailable}</p><p className="mt-2 text-xs leading-5 text-muted-foreground">{c.scoreMissing}</p></div>}</div>
        <p className="text-xs text-muted-foreground">{match.evaluatedCount} / {match.totalCount} {c.evaluated} · {match.unverifiedCount} {c.toVerify.toLowerCase()}</p>
        {(match.unverifiedCount > 0 || !match.totalCount || analysis.warnings.length > 0) && <p role="status" className="rounded-lg bg-muted p-3 text-sm">{c.partial} {analysis.warnings.join(" ")}</p>}
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">{(Object.keys(match.components) as (keyof MatchResult["components"])[]).map(key => <div key={key} className="rounded-lg border p-3"><p className="text-xs text-muted-foreground">{c[key]}</p><p className="mt-2 text-lg font-semibold">{match.components[key] === null ? "—" : match.components[key] + "%"}</p></div>)}</div>
        <details className="text-sm"><summary className="cursor-pointer font-medium">{c.score}</summary><p className="mt-2 leading-6 text-muted-foreground">{c.method}</p></details>
        <div className="grid gap-5 md:grid-cols-3">{([{ title: c.strengths, items: match.matchedSkills }, { title: c.gaps, items: match.missingSkills }, { title: c.toVerify, items: match.unverifiedSkills }]).map(group => <div key={group.title}><h3 className="text-sm font-semibold">{group.title}</h3>{group.items.length ? <ul className="mt-2 list-disc space-y-1 pl-4 text-sm text-muted-foreground">{group.items.slice(0, 8).map(item => <li key={item}>{item}</li>)}</ul> : <p className="mt-2 text-xs text-muted-foreground">{c.none}</p>}</div>)}</div>
        <Link className="inline-flex items-center gap-2 text-sm text-primary underline" href="/dashboard/profile">{c.updateProfile}<ArrowUpRight className="size-4" /></Link>
        <details><summary className="cursor-pointer text-sm font-medium">{c.duties} · {c.conditions}</summary><div className="mt-3 space-y-3 text-sm"><p>{analysis.objective && c.objective + ": " + analysis.objective}</p><p>{[analysis.workMode, analysis.contractType, analysis.seniority].filter(Boolean).join(" · ") || c.unspecified}</p><ul className="list-disc space-y-1 pl-4">{analysis.responsibilities.map((item, index) => <li key={index}>{item}</li>)}</ul><p><b>{c.technical} :</b> {analysis.technologies.join(", ") || c.unspecified}</p></div></details>
        <p className="break-all text-xs text-muted-foreground">{c.source} : {result.job.sourceType} {result.job.sourceName}{result.job.sourceUrl && <a className="ml-2 underline" href={result.job.sourceUrl} target="_blank" rel="noopener noreferrer">{result.job.sourceUrl}</a>}</p>
        <details><summary className="cursor-pointer text-sm">{c.original}</summary><pre className="mt-3 max-h-80 overflow-auto whitespace-pre-wrap break-words rounded-lg bg-muted p-3 font-sans text-xs leading-6">{result.job.originalText || result.job.description}</pre></details>
      </section>
      <section className="app-section space-y-4"><h2 className="type-h2">{c.requirements}</h2><div className="flex flex-wrap gap-3"><label className="text-xs">{c.category}<select className="ml-2 rounded-md border bg-background p-2" value={category} onChange={event => setCategory(event.target.value)}><option value="">{c.all}</option>{Object.entries(c.categories).map(([key, label]) => <option key={key} value={key}>{label}</option>)}</select></label><label className="text-xs">{c.status}<select className="ml-2 rounded-md border bg-background p-2" value={status} onChange={event => setStatus(event.target.value)}><option value="">{c.all}</option>{Object.entries(c.statuses).map(([key, label]) => <option key={key} value={key}>{label}</option>)}</select></label></div>
        {!requirements.length && <p className="text-sm text-muted-foreground">{c.none}</p>}
        {requirements.map(item => <article key={item.id} className="rounded-xl border p-4"><div className="flex flex-wrap items-start justify-between gap-2"><div><h3 className="text-sm font-semibold">{item.title}</h3><p className="mt-1 text-xs text-muted-foreground">{c.categories[item.category]} · {c.priorities[item.priority]}</p></div><span className={`rounded-full px-2.5 py-1 text-xs ${item.status === "DEMONSTRATED" ? "bg-primary/10 text-primary" : "bg-muted text-muted-foreground"}`}>{c.statuses[item.status]}</span></div><p className="mt-3 text-sm">{item.description}</p><details className="mt-3 text-sm"><summary className="cursor-pointer text-primary">{c.evidence}</summary><p className="mt-3">{c.explanations[item.explanation as keyof typeof c.explanations]}</p><p className="mt-3 text-xs font-semibold">{c.jobEvidence}</p><blockquote className="mt-1 border-l-2 border-primary/30 pl-3 text-muted-foreground">{item.evidence}</blockquote>{item.ambiguity && <p className="mt-2">{item.ambiguity}</p>}<p className="mt-3 text-xs font-semibold">{c.profileEvidence}</p>{item.evidenceSources.length ? item.evidenceSources.map(evidence => <blockquote key={evidence.path} className="mt-2 border-l-2 pl-3"><p className="text-xs font-medium">{evidence.label}</p><p className="mt-1 whitespace-pre-wrap text-muted-foreground">{evidence.quote}</p></blockquote>) : <p className="mt-2 text-muted-foreground">{c.noEvidence}</p>}</details></article>)}
      </section>
      <section className="app-section space-y-4"><h2 className="type-h2">{c.actions}</h2><p className="text-sm leading-6 text-muted-foreground">{c.honest}</p><div className="flex flex-wrap gap-3"><Button disabled={!!busy || !cvId} onClick={() => void generateProposal("TAILOR")}><Sparkles />{c.tailor}</Button><Button variant="outline" disabled={!!busy || !cvId} onClick={() => void generateProposal("IMPROVE")}><Sparkles />{c.improve}</Button>{cvId && <Button variant="outline" asChild><Link href={"/dashboard/resumes/" + cvId}><FileText />{c.manual}</Link></Button>}{result.tailoredCvId && <Button asChild><Link href={"/dashboard/resumes/" + result.tailoredCvId}>{c.adapted}<ArrowUpRight /></Link></Button>}</div>{!cvId && <p className="text-xs text-muted-foreground">{c.chooseResume}</p>}
        {proposal && <div className="space-y-4 rounded-xl border p-4"><h3 className="font-semibold">{c.proposal}</h3>{proposal.rejectedCount > 0 && <p className="text-xs text-muted-foreground">{c.rejected}</p>}{proposal.changes.map(change => <div key={change.path} className="space-y-2 border-b pb-4"><label className="flex items-center gap-2 text-sm font-medium"><input type="checkbox" checked={paths.includes(change.path)} onChange={event => setPaths(current => event.target.checked ? [...current, change.path] : current.filter(path => path !== change.path))} />{change.path.startsWith("summary") ? c.summary : change.path.startsWith("experiences") ? c.experience : c.essentialSkills}</label><div className="grid gap-3 md:grid-cols-2"><div><p className="text-xs text-muted-foreground">{c.before}</p><p className="mt-1 whitespace-pre-wrap text-sm">{change.current}</p></div><div><p className="text-xs text-primary">{c.after}</p><p className="mt-1 whitespace-pre-wrap text-sm">{change.proposed}</p></div></div><p className="text-xs text-muted-foreground">{change.reason}</p><blockquote className="border-l-2 pl-3 text-xs text-muted-foreground">{change.evidence}</blockquote></div>)}<div className="flex flex-wrap gap-3"><Button disabled={!!busy || !paths.length} onClick={() => void saveProposal()}>{c.accept}</Button><Button variant="outline" disabled={!!busy} onClick={() => void act("discard", async () => { await request("/api/tailor-resume", { action: "REJECT", matchId: result.id }); setProposal(null); })}>{c.discard}</Button></div></div>}
        <div className="grid gap-4 border-t pt-4 sm:grid-cols-[1fr_160px]"><div><label htmlFor="job-notes" className="text-sm">{c.notes}</label><Textarea id="job-notes" className="mt-2" value={notes} maxLength={4000} onChange={event => setNotes(event.target.value)} /></div><div><label htmlFor="job-language" className="text-sm">{c.language}</label><select id="job-language" className="mt-2 h-10 w-full rounded-md border bg-background px-3 text-sm" value={language} onChange={event => setLanguage(event.target.value as "fr" | "en")}><option value="fr">Français</option><option value="en">English</option></select></div></div>
        <div className="flex flex-wrap gap-3"><Button variant="outline" disabled={!!busy} onClick={() => void generateLetter()}><Mail />{c.letter}</Button><Button variant="outline" disabled={!!busy} onClick={() => void generateEmail()}><Mail />{c.email}</Button>{applicationId ? <Button asChild><Link href={"/dashboard/applications?application=" + applicationId}>{c.viewApplication}<ArrowUpRight /></Link></Button> : <Button disabled={!!busy} onClick={() => void saveApplication()}><BriefcaseBusiness />{c.application}</Button>}</div>
      </section>
      {letter && <section className="app-section space-y-4"><h2 className="type-h2">{c.letter}</h2><p className="text-xs text-muted-foreground">{c.documentReview}</p>{([{ key: "introduction", label: c.intro }, { key: "body", label: c.body }, { key: "conclusion", label: c.closing }] as const).map(({ key, label }) => <div key={key}><label htmlFor={"job-letter-" + key} className="text-sm">{label}</label><Textarea id={"job-letter-" + key} className="mt-2 min-h-28" value={letter[key]} onChange={event => setLetter({ ...letter, [key]: event.target.value })} /></div>)}<div className="flex flex-wrap gap-3"><Button disabled={!!busy} onClick={() => void saveLetter()}><Save />{c.saveLetter}</Button><Button variant="outline" disabled={!!busy} onClick={() => void copy([letter.introduction, letter.body, letter.conclusion, letter.senderName].join("\n\n"))}><Copy />{c.copy}</Button>{letterConversation && <Button variant="outline" asChild><Link href={"/dashboard/cover-letters/" + letterConversation}>{c.openLetter}<ArrowUpRight /></Link></Button>}</div></section>}
      {email && <section className="app-section space-y-4"><h2 className="type-h2">{c.email}</h2><p className="text-xs text-muted-foreground">{c.documentReview}</p><div><label htmlFor="job-email-subject" className="text-sm">{c.subject}</label><Input id="job-email-subject" className="mt-2" value={email.subject} maxLength={300} onChange={event => setEmail({ ...email, subject: event.target.value })} /></div><div><label htmlFor="job-email-body" className="text-sm">{c.body}</label><Textarea id="job-email-body" className="mt-2 min-h-56" value={email.body} maxLength={12000} onChange={event => setEmail({ ...email, body: event.target.value })} /></div><div className="flex flex-wrap gap-3"><Button disabled={!!busy} onClick={() => void saveEmail()}><Save />{c.saveEmail}</Button><Button variant="outline" disabled={!!busy} onClick={() => void copy(email.subject + "\n\n" + email.body)}><Copy />{c.copy}</Button></div></section>}
    </>}
    <section className="app-section"><h2 className="type-h2">{c.history}</h2>{history.loading ? <p role="status" className="mt-3 text-sm text-muted-foreground">{c.loading}</p> : history.error ? <div role="alert" className="mt-3 text-sm"><p>{c.genericError}</p><Button variant="outline" className="mt-2" onClick={() => void history.reload()}>{c.retry}</Button></div> : history.data?.length ? <div className="mt-4 divide-y">{history.data.map(item => <button key={item.id} className="flex w-full items-center justify-between gap-3 py-3 text-left text-sm hover:text-primary disabled:opacity-50" disabled={!!busy} onClick={() => void loadMatch(item.id)}><span>{item.job.title || c.unspecified}{item.job.company && " · " + item.job.company}</span><span className="shrink-0 text-xs text-muted-foreground">{item.overallScore === null ? "—" : item.overallScore + "%"}</span></button>)}</div> : <p className="mt-3 text-sm text-muted-foreground">{c.noHistory}</p>}</section>
  </div>;
}
