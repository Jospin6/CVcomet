"use client";

import { useCallback, useEffect, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import { useTranslation } from "react-i18next";
import Link from "next/link";
import { ArrowLeft, Loader2, FileCheck2, ShieldCheck } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";

type Entry = Record<string, string>;
type Facts = { name: string; email: string; phone: string; address: string; headline: string; summary: string; skills: string; languages: string; hobbies: string; linkedin: string; github: string; portfolio: string; targetMarket: string; referralSource: string; experiences: Entry[]; education: Entry[]; projects: Entry[]; certifications: Entry[]; awards: Entry[]; professionalLinks: Entry[] };
const sections = [
  { key: "experiences", title: "experiences", fields: ["title", "company", "location", "start", "end", "description"] },
  { key: "education", title: "education", fields: ["degree", "school", "start", "end", "description"] },
  { key: "projects", title: "projects", fields: ["title", "start", "end", "url", "description"] },
  { key: "certifications", title: "certifications", fields: ["name", "organization", "date", "description"] },
  { key: "awards", title: "awards", fields: ["title", "organization", "date", "description"] },
  { key: "professionalLinks", title: "professionalLinks", fields: ["label", "url"] },
] as const;
export default function ResumeImportReview() {
  const { id } = useParams<{ id: string }>();
  const router = useRouter();
  const { t, i18n } = useTranslation();
  const language = i18n.resolvedLanguage?.startsWith("fr") ? "fr" : "en";
  const tr = (key: string) => t(`resumeImport.${key}`);
  const [facts, setFacts] = useState<Facts | null>(null);
  const [name, setName] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [confirmed, setConfirmed] = useState(false);
  const [applicationId, setApplicationId] = useState("");
  useEffect(() => { setApplicationId(new URLSearchParams(window.location.search).get("applicationId") || ""); }, []);
  const request = useCallback(async (payload: unknown) => {
    const response = await fetch(`/api/resume-documents/${encodeURIComponent(id)}/convert`, { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify(payload) });
    const value = await response.json().catch(() => ({}));
    if (!response.ok) throw new Error(value.code || value.error || `HTTP_${response.status}`);
    return value;
  }, [id]);
  useEffect(() => {
    let active = true;
    void request({ action: "preview" }).then(result => { if (active) { setFacts(result.extracted); setName(result.source.name); } }).catch(err => { if (active) setError(err.message); });
    return () => { active = false; };
  }, [request]);
  const update = (key: keyof Facts, value: string) => { setConfirmed(false); setFacts(current => current ? { ...current, [key]: value } : null); };
  const updateEntry = (section: keyof Facts, index: number, field: string, value: string) => {
    setConfirmed(false);
    setFacts(current => current ? { ...current, [section]: (current[section] as Entry[]).map((item, i) => i === index ? { ...item, [field]: value } : item) } : null);
  };
  const save = async () => {
    if (!facts || !confirmed || busy) return;
    setBusy(true); setError("");
    try {
      const result = await request({ action: "confirm", extracted: facts, language });
      if (applicationId) {
        const response = await fetch(`/api/applications/${encodeURIComponent(applicationId)}`, { method: "PATCH", headers: { "content-type": "application/json" }, body: JSON.stringify({ cvId: result.id, coverLetterId: null }) });
        if (!response.ok) throw new Error(tr("linkFailed"));
      }
      router.push(`/dashboard/resumes/${result.id}${applicationId ? `?applicationId=${encodeURIComponent(applicationId)}` : ""}`);
    }
    catch (err) { setError(err instanceof Error ? err.message : tr("createFailed")); setBusy(false); }
  };
  return <main className="mx-auto max-w-4xl space-y-6 pb-16">
    <Link href={applicationId ? `/dashboard/applications/${encodeURIComponent(applicationId)}?tab=documents` : "/dashboard/resumes"} className="inline-flex items-center gap-2 text-sm text-muted-foreground hover:text-foreground"><ArrowLeft className="size-4"/>{tr("myResumes")}</Link>
    <header><h1 className="text-2xl font-semibold">{tr("title")}</h1><p className="mt-2 text-sm text-muted-foreground">{tr("source")} {name || tr("importedDocument")}. {tr("explanation")}</p></header>
    {!facts && !error && <p role="status" className="flex items-center gap-2 text-sm"><Loader2 className="size-4 animate-spin"/> {tr("extracting")}</p>}
    {error && <div role="alert" className="rounded-lg border border-destructive/30 p-4 text-sm text-destructive">{error}<Button className="ml-4" size="sm" variant="outline" onClick={() => { setError(""); void request({ action: "preview" }).then(result => { setFacts(result.extracted); setName(result.source.name); }).catch(err => setError(err.message)); }}>{tr("retry")}</Button></div>}
    {facts && <><section className="grid gap-4 rounded-xl border p-5 sm:grid-cols-2"><h2 className="font-semibold sm:col-span-2">{tr("identity")}</h2>{([ ["name", tr("name")], ["email", tr("email")], ["headline", tr("headline")], ["phone", tr("phone")], ["address", tr("location")], ["linkedin", "LinkedIn"], ["github", "GitHub"], ["portfolio", "Portfolio"] ] as const).map(([key, label]) => <label key={key} className="grid gap-1 text-sm">{label}<Input value={facts[key]} onChange={e => update(key, e.target.value)}/></label>)}{([ ["summary", tr("summary")], ["skills", tr("skills")], ["languages", tr("languages")], ["hobbies", tr("hobbies")] ] as const).map(([key, label]) => <label key={key} className="grid gap-1 text-sm sm:col-span-2">{label}<Textarea rows={3} value={facts[key]} onChange={e => update(key, e.target.value)}/></label>)}</section>
      {sections.map(section => <section key={section.key} className="rounded-xl border p-5"><div className="flex items-center justify-between"><h2 className="font-semibold">{tr(section.title)}</h2><Button variant="outline" size="sm" onClick={() => { setConfirmed(false); setFacts(old => old ? { ...old, [section.key]: [...old[section.key], Object.fromEntries(section.fields.map(field => [field, ""]))] } : old); }}>{tr("add")}</Button></div><div className="mt-4 space-y-3">{facts[section.key].map((entry, index) => <div key={index} className="grid gap-3 rounded-lg bg-muted/30 p-4 sm:grid-cols-2">{section.fields.map(field => <label key={field} className={`grid gap-1 text-xs ${field === "description" ? "sm:col-span-2" : ""}`}>{tr(`fields.${field}`)}{field === "description" ? <Textarea value={entry[field] ?? ""} rows={3} onChange={e => updateEntry(section.key, index, field, e.target.value)}/> : <Input value={entry[field] ?? ""} onChange={e => updateEntry(section.key, index, field, e.target.value)}/>}</label>)}<Button variant="ghost" size="sm" className="text-destructive" onClick={() => { setConfirmed(false); setFacts(old => old ? { ...old, [section.key]: old[section.key].filter((_, i) => i !== index) } : old); }}>{tr("remove")}</Button></div>)}</div></section>)}
      <section className="rounded-xl border p-5"><p className="flex gap-2 text-sm"><ShieldCheck className="size-5 text-primary"/> {tr("disclaimer")}</p><label className="mt-4 flex items-center gap-2 text-sm"><input type="checkbox" checked={confirmed} onChange={e => setConfirmed(e.target.checked)}/> {tr("consent")}</label><Button className="mt-4" disabled={!confirmed || busy} onClick={() => void save()}>{busy ? <Loader2 className="size-4 animate-spin"/> : <FileCheck2 className="size-4"/>} {tr("create")}</Button></section>
    </>}
  </main>;
}
