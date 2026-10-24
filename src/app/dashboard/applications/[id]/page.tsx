"use client";

import { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import { useParams } from "next/navigation";
import { ArrowLeft, ArrowRight, CalendarDays, Check, Clock3, ExternalLink, FileCheck2, FileText, Mail, MessageCircle, Plus, ScanSearch, Sparkles, BriefcaseBusiness, Send, ShieldCheck } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { applicationStatusLabel, applicationStatusTone, applicationStatuses, applicationStages, applicationStageIndex } from "@/lib/career/application-workspace";

type Reminder = { id: string; dueAt: string; note: string | null; completedAt: string | null };
type History = { id: string; status: string; note: string | null; createdAt: string };
type Match = { id: string; cvId: string | null; overallScore: number | null; createdAt: string };
type Packet = { id: string; cvId: string; status: string; updatedAt: string };
type Interview = { id: string; title: string; status: string; scheduledAt: string | null };
type Application = { id: string; company: string; jobTitle: string; location: string | null; status: string; notes: string | null; nextAction: string | null; updatedAt: string; appliedAt: string | null; jobUrl: string | null; jobId: string | null; cvId: string | null; coverLetterId: string | null; cv: { id: string; title: string; revision: number } | null; coverLetter: { id: string; positionTitle: string | null; companyName: string | null } | null; job: { id: string; title: string; description: string; sourceUrl: string | null; matches: Match[]; applicationPackets: Packet[] } | null; statusEvents: History[]; reminders: Reminder[]; interviews: Interview[] };
type Tab = "overview" | "documents" | "analysis" | "interviews" | "activity";
const tabs: { id: Tab; name: string }[] = [{ id: "overview", name: "Vue d'ensemble" }, { id: "documents", name: "Documents" }, { id: "analysis", name: "Analyse ATS" }, { id: "interviews", name: "Entretiens" }, { id: "activity", name: "Suivi" }];
function dateLabel(date?: string | null) { return date ? new Date(date).toLocaleDateString("fr-FR", { day: "numeric", month: "short", year: "numeric" }) : "À définir"; }

function Tool({ href, icon: Icon, title, detail }: { href: string; icon: typeof FileText; title: string; detail?: string }) {
  return <Link href={href} className="ux-tool group flex min-w-0 items-center gap-3 rounded-xl border p-3 transition-[background-color,border-color,transform] hover:-translate-y-0.5 hover:border-primary/30 hover:bg-muted/30 focus-visible:outline-2 focus-visible:outline-ring">
    <span className="flex size-9 shrink-0 items-center justify-center rounded-lg bg-secondary text-primary"><Icon className="size-4" aria-hidden="true"/></span>
    <span className="min-w-0 flex-1"><span className="block truncate text-sm font-medium">{title}</span>{detail && <span className="mt-0.5 block truncate text-xs text-muted-foreground">{detail}</span>}</span><ArrowRight className="size-4 shrink-0 text-muted-foreground transition-transform group-hover:translate-x-0.5" aria-hidden="true"/>
  </Link>;
}

export default function ApplicationWorkspace() {
  const params = useParams<{ id: string }>();
  const id = params.id;
  const [application, setApplication] = useState<Application | null>(null);
  const [tab, setTab] = useState<Tab>("overview");
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [notes, setNotes] = useState("");
  const [nextAction, setNextAction] = useState("");
  const [choices, setChoices] = useState<{jobs:{id:string;title:string;company?:string|null}[];resumes:{id:string;title?:string}[];letters:{id:string;positionTitle?:string|null;companyName?:string|null;cvId?:string|null;jobId?:string|null}[]}>({jobs:[],resumes:[],letters:[]});
  const [selectedJob, setSelectedJob] = useState("");
  const [selectedCv, setSelectedCv] = useState("");
  const [selectedLetter, setSelectedLetter] = useState("");
  const [reminderDate, setReminderDate] = useState("");
  const [reminderNote, setReminderNote] = useState("");

  const load = useCallback(async (signal?: AbortSignal) => {
    const response = await fetch(`/api/applications/${encodeURIComponent(id)}`, { signal, cache: "no-store" });
    if (!response.ok) throw new Error(response.status === 404 ? "Candidature introuvable." : "Impossible de charger cette candidature.");
    return response.json() as Promise<Application>;
  }, [id]);
  useEffect(() => {
    const controller = new AbortController();
    setLoading(true);
    void load(controller.signal).then(value => { setApplication(value); setNotes(value.notes ?? ""); setNextAction(value.nextAction ?? ""); setSelectedJob(value.jobId ?? ""); setSelectedCv(value.cvId ?? ""); setSelectedLetter(value.coverLetterId ?? ""); setError(""); }).catch(failure => {
      if (!controller.signal.aborted) setError(failure instanceof Error ? failure.message : "Chargement impossible.");
    }).finally(() => { if (!controller.signal.aborted) setLoading(false); });
    return () => controller.abort();
  }, [load]);
  useEffect(() => {
    if (tab !== "documents" && tab !== "analysis") return;
    const controller = new AbortController();
    void fetch("/api/career/v1/application-packets/options", { cache: "no-store", signal: controller.signal }).then(async response => {
      if (!response.ok) throw new Error("UNAVAILABLE");
      return response.json();
    }).then(result => {
      if (!controller.signal.aborted && result?.data) setChoices({jobs: result.data.jobs ?? [], resumes: result.data.resumes ?? [], letters: result.data.letters ?? []});
    }).catch(() => {});
    return () => controller.abort();
  }, [tab]);
  const patch = async (data: unknown) => {
    setBusy(true); setError("");
    try {
      const response = await fetch(`/api/applications/${encodeURIComponent(id)}`, { method: "PATCH", headers: { "content-type": "application/json" }, body: JSON.stringify(data) });
      if (!response.ok) throw new Error("Modification impossible.");
      const updated = await load(); setApplication(updated); setNotes(updated.notes ?? ""); setNextAction(updated.nextAction ?? ""); setSelectedJob(updated.jobId ?? ""); setSelectedCv(updated.cvId ?? ""); setSelectedLetter(updated.coverLetterId ?? "");
    } catch (failure) { setError(failure instanceof Error ? failure.message : "Modification impossible."); }
    finally { setBusy(false); }
  };
  const addReminder = async (event: React.FormEvent) => {
    event.preventDefault(); if (!reminderDate) return;
    setBusy(true); setError("");
    try {
      const dueAt = new Date(reminderDate).toISOString();
      const response = await fetch(`/api/applications/${encodeURIComponent(id)}/reminders`, { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ dueAt, note: reminderNote.trim() }) });
      if (!response.ok) throw new Error("Rappel non enregistré.");
      setReminderDate(""); setReminderNote(""); setApplication(await load());
    } catch (failure) { setError(failure instanceof Error ? failure.message : "Rappel non enregistré."); }
    finally { setBusy(false); }
  };

  if (loading) return <div className="mx-auto max-w-6xl space-y-4" aria-label="Chargement du dossier"><div className="h-24 animate-pulse rounded-2xl bg-muted"/><div className="h-64 animate-pulse rounded-2xl bg-muted"/></div>;
  if (!application) return <div className="mx-auto max-w-4xl space-y-4"><Link href="/dashboard/applications" className="text-sm text-primary">← Mes candidatures</Link><p role="alert" className="text-sm text-destructive">{error || "Candidature introuvable."}</p></div>;
  const app = application;
  const stage = applicationStageIndex(app.status);
  const match = app.job?.matches[0];
  const packet = app.job?.applicationPackets[0];
  const packetHref = app.job && app.cvId ? `/dashboard/application-agent?jobId=${encodeURIComponent(app.job.id)}&cvId=${encodeURIComponent(app.cvId)}` : "/dashboard/application-agent";
  const interviewHref = `/dashboard/interviews?applicationId=${encodeURIComponent(app.id)}&role=${encodeURIComponent(app.jobTitle)}`;
  const suggested = app.status === "SAVED" ? { title: "Préparer votre candidature", tab: "documents" as Tab } : app.status === "APPLIED" ? { title: "Organiser une relance", tab: "activity" as Tab } : app.status === "INTERVIEW" || app.status === "TECHNICAL_INTERVIEW" ? { title: "Préparer un entretien", tab: "interviews" as Tab } : { title: "Mettre à jour le suivi", tab: "activity" as Tab };

  return <main className="mx-auto max-w-6xl space-y-5 pb-14">
    <Link href="/dashboard/applications" className="inline-flex items-center gap-1.5 text-xs text-muted-foreground transition-colors hover:text-foreground"><ArrowLeft className="size-3.5"/> Mes candidatures</Link>
    <header className="flex flex-wrap items-start justify-between gap-4">
      <div className="flex min-w-0 items-start gap-3.5"><span className="flex size-12 shrink-0 items-center justify-center rounded-2xl bg-secondary text-xl font-semibold text-primary" aria-hidden="true">{app.company.charAt(0).toUpperCase()}</span><div className="min-w-0"><p className="text-xs font-medium text-muted-foreground">{app.company}{app.location ? ` · ${app.location}` : ""}</p><h1 className="mt-1 break-words text-2xl font-semibold tracking-tight sm:text-3xl">{app.jobTitle}</h1><span className={`mt-2 inline-flex rounded-md px-2.5 py-1 text-xs font-medium ${applicationStatusTone(app.status)}`}>{applicationStatusLabel(app.status)}</span></div></div>
      <div className="flex items-center gap-2"><select aria-label="Changer le statut" disabled={busy} className="h-9 max-w-44 rounded-lg border bg-card px-2.5 text-xs" value={app.status} onChange={event => void patch({ status: event.target.value })}>{applicationStatuses.map(status => <option key={status} value={status}>{applicationStatusLabel(status)}</option>)}</select>{(app.jobUrl || app.job?.sourceUrl) && <Button size="sm" variant="outline" asChild><a href={app.jobUrl || app.job?.sourceUrl || "#"} target="_blank" rel="noopener noreferrer">Offre <ExternalLink className="size-3.5"/></a></Button>}</div>
    </header>

    <section className="ux-surface overflow-hidden p-3 sm:px-5 sm:py-4" aria-label="Progression de la candidature">
      <ol className="grid grid-cols-5 gap-1.5">{applicationStages.map((status, i) => <li key={status} className="min-w-0"><span className={`mb-2 block h-1.5 rounded-full transition-colors ${stage >= i ? "bg-primary" : "bg-muted"}`}/><span className={`block truncate text-[10px] sm:text-xs ${stage === i ? "font-semibold text-foreground" : "text-muted-foreground"}`}>{applicationStatusLabel(status)}</span></li>)}</ol>
    </section>

    <nav aria-label="Sections du dossier" className="ux-tabs flex gap-1 overflow-x-auto border-b pb-1" role="tablist">{tabs.map(item => <button type="button" key={item.id} id={`tab-${item.id}`} role="tab" aria-controls={`panel-${item.id}`} aria-selected={tab === item.id} onClick={() => setTab(item.id)} className={`shrink-0 rounded-lg px-3 py-2.5 text-xs font-medium transition-colors sm:text-sm ${tab === item.id ? "bg-primary/10 text-primary" : "text-muted-foreground hover:bg-muted hover:text-foreground"}`}>{item.name}</button>)}</nav>
    {error && <p role="alert" className="rounded-lg border border-destructive/30 p-3 text-sm text-destructive">{error}</p>}

    <section role="tabpanel" id={`panel-${tab}`} aria-labelledby={`tab-${tab}`} className="ux-enter" key={tab}>
      {tab === "overview" && <div className="grid gap-4 lg:grid-cols-[minmax(0,1.55fr)_minmax(250px,0.85fr)]">
        <div className="space-y-4"><div className="ux-surface p-5"><p className="text-xs font-medium text-muted-foreground">Prochaine étape</p><h2 className="mt-1 text-lg font-semibold">{app.nextAction?.trim() || suggested.title}</h2><Button size="sm" className="mt-4" onClick={() => setTab(suggested.tab)}>Continuer <ArrowRight className="size-4"/></Button></div>
          <div className="ux-surface p-5"><div className="flex items-center justify-between"><h2 className="text-sm font-semibold">Votre dossier</h2><span className="text-xs text-muted-foreground">{[app.cvId,app.coverLetterId,match,packet].filter(Boolean).length}/4 éléments</span></div>
            <div className="mt-4 grid gap-2 sm:grid-cols-2"><Tool href={app.cvId ? `/dashboard/resumes/${app.cvId}` : "/dashboard/resumes"} title={app.cv ? "CV associé" : "Ajouter un CV"} icon={FileText}/><Tool href={app.coverLetterId ? `/dashboard/cover-letters/${app.coverLetterId}` : "/dashboard/cover-letters"} title={app.coverLetter ? "Lettre associée" : "Créer une lettre"} icon={Mail}/><Tool href={match ? `/dashboard/job-match?analysis=${match.id}` : "/dashboard/job-match"} title={match ? "Analyse de l'offre" : "Analyser l'offre"} icon={ScanSearch}/><Tool href={packetHref} title={packet ? "Dossier de candidature" : "Préparer le dossier"} icon={FileCheck2}/></div>
          </div></div>
        <aside className="ux-surface p-5"><h2 className="text-sm font-semibold">À retenir</h2><div className="mt-4 space-y-4 text-sm"><div><p className="text-xs text-muted-foreground">Dernière activité</p><p className="mt-0.5 font-medium">{dateLabel(app.updatedAt)}</p></div><div><p className="text-xs text-muted-foreground">Envoyée le</p><p className="mt-0.5 font-medium">{dateLabel(app.appliedAt)}</p></div><div><p className="text-xs text-muted-foreground">Prochain rappel</p><p className="mt-0.5 font-medium">{dateLabel(app.reminders.find(item => !item.completedAt)?.dueAt)}</p></div></div><Button size="sm" variant="outline" className="mt-5 w-full" onClick={() => setTab("activity")}>Voir le suivi <ArrowRight className="size-4"/></Button></aside>
      </div>}

      {tab === "documents" && <div className="space-y-4"><section className="ux-surface p-4 sm:p-5"><h2 className="text-sm font-semibold">Documents de cette candidature</h2><form className="mt-3 grid gap-3 sm:grid-cols-[1fr_1fr_auto] sm:items-end" onSubmit={event => { event.preventDefault(); void patch({ cvId: selectedCv || null, coverLetterId: selectedLetter || null }); }}><label className="grid gap-1 text-xs text-muted-foreground">CV associé<select className="h-9 min-w-0 rounded-lg border bg-background px-2 text-sm text-foreground" value={selectedCv} onChange={event => setSelectedCv(event.target.value)}><option value="">Aucun CV</option>{choices.resumes.map(item => <option key={item.id} value={item.id}>{item.title || "Sans titre"}</option>)}</select></label><label className="grid gap-1 text-xs text-muted-foreground">Lettre associée<select className="h-9 min-w-0 rounded-lg border bg-background px-2 text-sm text-foreground" value={selectedLetter} onChange={event => setSelectedLetter(event.target.value)}><option value="">Aucune lettre</option>{choices.letters.filter(item => (!item.cvId || item.cvId === selectedCv) && (!item.jobId || item.jobId === (app.jobId ?? ""))).map(item => <option key={item.id} value={item.id}>{item.positionTitle || item.companyName || "Lettre"}</option>)}</select></label><Button size="sm" disabled={busy || (selectedCv === (app.cvId ?? "") && selectedLetter === (app.coverLetterId ?? ""))}><Check className="size-4"/> Associer</Button></form></section><div className="grid gap-3 md:grid-cols-2"><Tool icon={FileText} title={app.cv ? app.cv.title : "Créer un CV pour ce poste"} detail={app.cv ? `Version ${app.cv.revision} · Modifier et exporter` : "Choisissez un CV avant de préparer le dossier"} href={app.cvId ? `/dashboard/resumes/${app.cvId}` : "/dashboard/resumes"}/><Tool icon={Mail} title={app.coverLetter ? "Lettre de motivation" : "Rédiger une lettre"} detail="Personnaliser pour ce poste" href={app.coverLetterId ? `/dashboard/cover-letters/${app.coverLetterId}` : "/dashboard/cover-letters"}/><Tool icon={FileCheck2} title={packet ? "Ouvrir la préparation du dossier" : "Assembler le dossier"} detail={packet ? (packet.status === "READY" ? "Approuvé pour usage manuel" : "Brouillon") : "CV, lettre et email"} href={packetHref}/><Tool icon={Sparkles} title="Améliorer avec Career Agent" detail="Conseils adaptés à votre profil" href="/dashboard/assistant"/></div></div>}

      {tab === "analysis" && <div className="space-y-4"><div className="ux-surface p-4 sm:p-5"><h2 className="text-sm font-semibold">Offre liée à cette candidature</h2><form className="mt-3 flex flex-wrap items-end gap-2" onSubmit={event => {event.preventDefault(); void patch({jobId:selectedJob || null});}}><label className="grid min-w-0 flex-1 gap-1 text-xs text-muted-foreground">Offre analysée<select className="h-9 w-full rounded-lg border bg-background px-2 text-sm text-foreground" value={selectedJob} onChange={event => setSelectedJob(event.target.value)}><option value="">Aucune offre liée</option>{choices.jobs.map(item => <option key={item.id} value={item.id}>{item.title}{item.company ? ` — ${item.company}` : ""}</option>)}</select></label><Button size="sm" disabled={busy || selectedJob === (app.jobId ?? "")}><Check className="size-4"/> Associer</Button></form></div><div className="grid gap-4 md:grid-cols-[minmax(0,1fr)_minmax(240px,0.55fr)]"><div className="ux-surface p-5"><h2 className="text-base font-semibold">Adéquation avec le poste</h2>{match ? <><p className="mt-3 text-3xl font-semibold">{match.overallScore === null ? "—" : `${match.overallScore}%`}</p><p className="mt-1 text-xs text-muted-foreground">Estimation indicative, pas un score ATS officiel.</p><Button size="sm" className="mt-5" asChild><Link href={`/dashboard/job-match?analysis=${match.id}`}>Voir les recommandations <ArrowRight className="size-4"/></Link></Button></> : <><p className="mt-2 text-sm text-muted-foreground">Aucune analyse liée à ce poste pour l'instant.</p><Button size="sm" className="mt-4" variant="outline" asChild><Link href="/dashboard/job-match">Analyser une offre <ArrowRight className="size-4"/></Link></Button></>}</div><div className="ux-surface p-5"><h2 className="text-sm font-semibold">Offre de référence</h2>{app.job ? <p className="mt-3 line-clamp-6 whitespace-pre-line text-xs leading-5 text-muted-foreground">{app.job.description}</p> : <p className="mt-2 text-xs leading-5 text-muted-foreground">Reliez une offre analysée pour afficher ici ses exigences et ses diagnostics.</p>}</div></div></div>}

      {tab === "interviews" && <div className="ux-surface p-5"><div className="flex flex-wrap items-center justify-between gap-3"><div><h2 className="text-base font-semibold">Préparation aux entretiens</h2><p className="mt-1 text-xs text-muted-foreground">Simulations, questions et progression.</p></div><Button size="sm" asChild><Link href={interviewHref}><MessageCircle className="size-4"/> Préparer un entretien</Link></Button></div>{app.interviews.length > 0 ? <div className="mt-4 divide-y">{app.interviews.map(item => <div key={item.id} className="flex flex-wrap items-center justify-between gap-2 py-3 text-sm"><span className="font-medium">{item.title}</span><span className="text-xs text-muted-foreground">{dateLabel(item.scheduledAt)} · {item.status}</span></div>)}</div> : <p className="mt-5 text-sm text-muted-foreground">Aucun entretien lié à cette candidature.</p>}</div>}

      {tab === "activity" && <div className="grid gap-4 lg:grid-cols-2"><div className="ux-surface p-5"><h2 className="text-sm font-semibold">Notes et prochaine action</h2><div className="mt-3 space-y-3"><label className="block text-xs font-medium text-muted-foreground" htmlFor="application-action">Prochaine action</label><Input id="application-action" maxLength={1000} value={nextAction} onChange={e => setNextAction(e.target.value)}/><label className="block text-xs font-medium text-muted-foreground" htmlFor="application-notes">Notes personnelles</label><Textarea id="application-notes" rows={5} maxLength={12000} value={notes} onChange={e => setNotes(e.target.value)}/><Button size="sm" disabled={busy || (notes === (app.notes ?? "") && nextAction === (app.nextAction ?? ""))} onClick={() => void patch({ notes, nextAction })}><Check className="size-4"/> Enregistrer</Button></div></div>
      <div className="ux-surface p-5"><h2 className="text-sm font-semibold">Relances et rappels</h2><form onSubmit={addReminder} className="mt-3 space-y-2"><label className="block text-xs font-medium text-muted-foreground" htmlFor="reminder-date">Date du rappel</label><Input id="reminder-date" required type="datetime-local" value={reminderDate} onChange={e => setReminderDate(e.target.value)}/><Input maxLength={1000} aria-label="Note du rappel" placeholder="Ex. Relancer le recruteur" value={reminderNote} onChange={e => setReminderNote(e.target.value)}/><Button type="submit" size="sm" variant="outline" disabled={busy || !reminderDate}><Plus className="size-4"/> Ajouter un rappel</Button></form>{app.reminders.length > 0 && <div className="mt-4 space-y-2">{app.reminders.map(item => <div key={item.id} className="flex items-start gap-2 rounded-lg bg-muted/30 p-2.5 text-xs"><Clock3 className="mt-0.5 size-3.5 shrink-0 text-primary"/><span>{dateLabel(item.dueAt)} — {item.note || "Rappel"}</span></div>)}</div>}<p className="mt-3 text-xs text-muted-foreground">Les rappels sont enregistrés dans CVComet, sans envoi automatique.</p></div>
      <div className="ux-surface p-5 lg:col-span-2"><h2 className="text-sm font-semibold">Historique des statuts</h2><ol className="mt-4 space-y-3">{app.statusEvents.map(item => <li key={item.id} className="flex items-start gap-3 text-xs"><span className="mt-1 size-2 rounded-full bg-primary"/><span className="flex-1 font-medium">{applicationStatusLabel(item.status)}{item.note ? ` · ${item.note}` : ""}</span><time className="text-muted-foreground">{dateLabel(item.createdAt)}</time></li>)}</ol></div></div>}
    </section>
  </main>;
}
