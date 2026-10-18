"use client";
import { useEffect, useState } from "react";
import Link from "next/link";
import { useTranslation } from "react-i18next";
import { ClipboardList, Plus, Trash2, FileText, Mail, BriefcaseBusiness } from "lucide-react";
import { PageHeader } from "@/components/ui/page-header";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { useApi } from "@/components/career/data-state";
import { jobCopy } from "@/lib/career/job-copy";

type Application = { id: string; company: string; jobTitle: string; location?: string; status: string; updatedAt: string;
  job?: { matches: { id: string }[] } | null; cv?: { id: string; title: string } | null; coverLetter?: { conversationId: string } | null };
const statuses = ["SAVED", "APPLIED", "INTERVIEW", "TECHNICAL_INTERVIEW", "OFFER", "REJECTED", "WITHDRAWN"];
export default function Applications() {
  const { i18n } = useTranslation(); const fr = i18n.resolvedLanguage?.startsWith("fr"); const c = jobCopy[fr ? "fr" : "en"];
  const api = useApi<Application[]>("/api/applications");
  const [form, setForm] = useState({ company: "", jobTitle: "" }), [error, setError] = useState(""), [busy, setBusy] = useState(false), [selected, setSelected] = useState("");
  useEffect(() => { setSelected(new URL(window.location.href).searchParams.get("application") || ""); }, []);
  const mutate = async (url: string, method: string, body?: unknown) => {
    setBusy(true); setError("");
    try {
      const response = await fetch(url, { method, headers: { "Content-Type": "application/json" }, ...(body ? { body: JSON.stringify(body) } : {}) });
      if (!response.ok) throw new Error();
      if (method === "POST") setForm({ company: "", jobTitle: "" });
      await api.reload();
    } catch { setError(c.genericError); } finally { setBusy(false); }
  };
  return <div className="space-y-7">
    <PageHeader title={fr ? "Mes candidatures" : "Applications"} description={fr ? "Retrouvez vos offres, vos analyses et les documents de chaque candidature." : "Track opportunities with their job analysis and application documents."} />
    {(error || api.error) && <div role="alert" className="app-section text-sm text-destructive">{error || c.genericError}{api.error && <Button variant="outline" className="ml-3" onClick={() => void api.reload()}>{c.retry}</Button>}</div>}
    <section className="app-section"><h2 className="type-h2">{fr ? "Ajouter une candidature" : "Add application"}</h2><form className="mt-4 grid gap-3 md:grid-cols-[1fr_1fr_auto]" onSubmit={event => { event.preventDefault(); void mutate("/api/applications", "POST", form); }}><Input required maxLength={300} aria-label={fr ? "Entreprise" : "Company"} placeholder={fr ? "Entreprise" : "Company"} value={form.company} onChange={event => setForm({ ...form, company: event.target.value })} /><Input required maxLength={300} aria-label={fr ? "Poste" : "Job title"} placeholder={fr ? "Poste" : "Job title"} value={form.jobTitle} onChange={event => setForm({ ...form, jobTitle: event.target.value })} /><Button type="submit" disabled={busy || !form.company.trim() || !form.jobTitle.trim()}><Plus />{fr ? "Ajouter" : "Add"}</Button></form></section>
    {api.loading && <p role="status" className="text-sm text-muted-foreground">{c.loading}</p>}
    <section className="grid gap-4 xl:grid-cols-3">{api.data?.map(application => <article key={application.id} id={"application-" + application.id} className={`min-w-0 rounded-xl border bg-card p-5 ${selected === application.id ? "border-primary ring-1 ring-primary" : ""}`}><div className="flex justify-between"><ClipboardList className="size-5 text-primary" /><Button size="icon" variant="ghost" disabled={busy} onClick={() => void mutate("/api/applications/" + application.id, "DELETE")} aria-label={fr ? "Supprimer" : "Delete"}><Trash2 /></Button></div><h2 className="mt-5 break-words font-semibold">{application.jobTitle}</h2><p className="break-words text-sm text-muted-foreground">{application.company || c.unspecified}</p><select aria-label={fr ? "État de la candidature" : "Application status"} disabled={busy} className="mt-4 h-9 w-full rounded-md border bg-background px-2 text-sm" value={application.status} onChange={event => void mutate("/api/applications/" + application.id, "PATCH", { status: event.target.value })}>{statuses.map(status => <option key={status}>{status}</option>)}</select><div className="mt-4 flex flex-col items-start gap-3 text-xs text-primary">{application.job?.matches[0] && <Link className="inline-flex items-center gap-2 hover:underline" href={"/dashboard/job-match?analysis=" + application.job.matches[0].id}><BriefcaseBusiness className="size-4" />{c.title}</Link>}{application.cv && <Link className="inline-flex items-center gap-2 hover:underline" href={"/dashboard/resumes/" + application.cv.id}><FileText className="size-4" />{c.manual}</Link>}{application.coverLetter && <Link className="inline-flex items-center gap-2 hover:underline" href={"/g/" + application.coverLetter.conversationId}><Mail className="size-4" />{c.openLetter}</Link>}</div></article>)}</section>
    {!api.loading && !api.error && !api.data?.length && <div className="app-section text-sm text-muted-foreground">{fr ? "Aucune candidature enregistrée. Analysez une offre ou ajoutez votre premier poste." : "No applications yet. Analyze a job or add your first opportunity."}</div>}
  </div>;
}
