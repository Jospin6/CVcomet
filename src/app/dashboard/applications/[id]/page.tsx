"use client";

import { Suspense, useCallback, useEffect, useRef, useState } from "react";
import Link from "next/link";
import { useParams, useRouter, useSearchParams } from "next/navigation";
import {
  ArrowLeft, ArrowRight, Check, Clock3, ExternalLink,
  FileCheck2, FileText, MessageCircle, Plus, ScanSearch,
} from "lucide-react";
import { ApplicationDocuments } from "@/components/applications/application-documents";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { applicationStatusLabel, applicationStatusTone, applicationStatuses, applicationStages, applicationStageIndex } from "@/lib/career/application-workspace";

type Reminder = { id: string; dueAt: string; note: string | null; completedAt: string | null };
type History = { id: string; status: string; note: string | null; createdAt: string };
type Match = { id: string; cvId: string | null; overallScore: number | null; createdAt: string };
type Packet = { id: string; cvId: string; status: string; updatedAt: string };
type Interview = { id: string; title: string; status: string; scheduledAt: string | null };
type AtsReport = {
  id: string;
  createdAt: string;
  content?: { score: number | null };
  technical?: { score: number | null; status: string };
  jobMatch?: { score: number | null };
  issues?: { id: string; title: string; suggestion: string }[];
  legacy?: boolean;
};
type Application = {
  id: string;
  company: string;
  jobTitle: string;
  location: string | null;
  status: string;
  notes: string | null;
  nextAction: string | null;
  updatedAt: string;
  appliedAt: string | null;
  jobUrl: string | null;
  jobId: string | null;
  cvId: string | null;
  coverLetterId: string | null;
  cv: { id: string; title: string; revision: number } | null;
  coverLetter: { id: string; positionTitle: string | null; companyName: string | null } | null;
  job: {
    id: string;
    title: string;
    description: string;
    sourceUrl: string | null;
    matches: Match[];
    applicationPackets: Packet[];
  } | null;
  statusEvents: History[];
  reminders: Reminder[];
  interviews: Interview[];
};

type Tab = "overview" | "documents" | "analysis" | "interviews" | "activity";
const tabs: { id: Tab; name: string }[] = [
  { id: "overview", name: "Vue d'ensemble" },
  { id: "documents", name: "Documents" },
  { id: "analysis", name: "Analyse ATS" },
  { id: "interviews", name: "Entretiens" },
  { id: "activity", name: "Suivi" },
];

const dateLabel = (value?: string | null) =>
  value ? new Date(value).toLocaleDateString("fr-FR", { day: "numeric", month: "short", year: "numeric" }) : "À définir";

// Imported source links mistakenly stored in notes are not personal notes.
const userNotes = (value: string | null) =>
  value && !/^\s*(?:(?:https?:\/\/|www\.)\S+|Original offer:\s*https?:\/\/\S+)\s*$/i.test(value)
    ? value
    : "";

function GrowTextarea({ value, onChange }: { value: string; onChange: (value: string) => void }) {
  const ref = useRef<HTMLTextAreaElement>(null);
  useEffect(() => {
    const field = ref.current;
    if (!field) return;
    field.style.height = "44px";
    field.style.height = `${Math.min(240, Math.max(44, field.scrollHeight))}px`;
  }, [value]);
  return (
    <textarea
      ref={ref}
      id="application-notes"
      rows={1}
      value={value}
      maxLength={12000}
      onChange={event => onChange(event.target.value)}
      className="min-h-11 w-full resize-none overflow-y-auto rounded-md border bg-background px-3 py-2 text-sm outline-none focus-visible:ring-2 focus-visible:ring-ring"
      placeholder="Vos notes personnelles…"
    />
  );
}

export default function ApplicationWorkspace() {
  return <Suspense fallback={<div className="h-64 animate-pulse rounded-xl bg-muted" />}><ApplicationWorkspaceContent /></Suspense>;
}

function ApplicationWorkspaceContent() {
  const { id } = useParams<{ id: string }>();
  const router = useRouter();
  const requestedTab = useSearchParams().get("tab");
  const [tab, setTab] = useState<Tab>(tabs.some(item => item.id === requestedTab) ? requestedTab as Tab : "overview");
  const [application, setApplication] = useState<Application | null>(null);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [notes, setNotes] = useState("");
  const [nextAction, setNextAction] = useState("");
  const [reminderDate, setReminderDate] = useState("");
  const [reminderNote, setReminderNote] = useState("");
  const [atsReports, setAtsReports] = useState<AtsReport[]>([]);
  const [atsLoading, setAtsLoading] = useState(false);

  const selectTab = (next: Tab) => {
    setTab(next);
    router.replace(`/dashboard/applications/${encodeURIComponent(id)}?tab=${next}`, { scroll: false });
  };
  useEffect(() => {
    if (tabs.some(item => item.id === requestedTab)) setTab(requestedTab as Tab);
  }, [requestedTab]);

  const load = useCallback(async (signal?: AbortSignal): Promise<Application> => {
    const response = await fetch(`/api/applications/${encodeURIComponent(id)}`, { cache: "no-store", signal });
    if (!response.ok) throw new Error(response.status === 404 ? "Candidature introuvable." : "Impossible de charger cette candidature.");
    return response.json() as Promise<Application>;
  }, [id]);

  const updateLocal = (value: Application, resetForm = false) => {
    setApplication(value);
    if (resetForm) {
      setNotes(userNotes(value.notes));
      setNextAction(value.nextAction || "");
    }
  };

  useEffect(() => {
    const controller = new AbortController();
    setLoading(true);
    void load(controller.signal).then(value => {
      if (!controller.signal.aborted) { updateLocal(value, true); setError(""); }
    }).catch(failure => {
      if (!controller.signal.aborted) setError(failure instanceof Error ? failure.message : "Chargement impossible.");
    }).finally(() => { if (!controller.signal.aborted) setLoading(false); });
    return () => controller.abort();
  }, [load]);

  useEffect(() => {
    const refresh = () => {
      if (document.visibilityState === "visible") void load().then(value => updateLocal(value)).catch(() => {});
    };
    window.addEventListener("focus", refresh);
    return () => window.removeEventListener("focus", refresh);
  }, [load]);

  useEffect(() => {
    if (tab !== "analysis" || !application?.cvId) return;
    const controller = new AbortController();
    setAtsLoading(true);
    void fetch(`/api/ats?cvId=${encodeURIComponent(application.cvId)}`, {
      cache: "no-store",
      signal: controller.signal,
    }).then(async response => {
      if (!response.ok) throw new Error("ATS unavailable");
      return response.json() as Promise<AtsReport[]>;
    }).then(rows => {
      if (!controller.signal.aborted) setAtsReports(rows);
    }).catch(() => {
      if (!controller.signal.aborted) setAtsReports([]);
    }).finally(() => {
      if (!controller.signal.aborted) setAtsLoading(false);
    });
    return () => controller.abort();
  }, [tab, application?.cvId]);

  const patch = async (data: Record<string, unknown>) => {
    setBusy(true);
    setError("");
    try {
      const response = await fetch(`/api/applications/${encodeURIComponent(id)}`, {
        method: "PATCH",
        headers: { "content-type": "application/json" },
        body: JSON.stringify(data),
      });
      if (!response.ok) {
        const payload = await response.json().catch(() => ({})) as { error?: string };
        throw new Error(payload.error || "Impossible de modifier le dossier.");
      }
      const updated = await load();
      updateLocal(updated, "notes" in data || "nextAction" in data);
    } catch (failure) {
      const message = failure instanceof Error ? failure.message : "Modification impossible.";
      setError(message);
      throw new Error(message);
    } finally {
      setBusy(false);
    }
  };

  const addReminder = async (event: React.FormEvent) => {
    event.preventDefault();
    if (!reminderDate) return;
    setBusy(true); setError("");
    try {
      const response = await fetch(`/api/applications/${encodeURIComponent(id)}/reminders`, {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ dueAt: new Date(reminderDate).toISOString(), note: reminderNote.trim() }),
      });
      if (!response.ok) throw new Error("Rappel non enregistré.");
      setReminderDate(""); setReminderNote("");
      updateLocal(await load());
    } catch (failure) {
      setError(failure instanceof Error ? failure.message : "Rappel non enregistré.");
    } finally { setBusy(false); }
  };

  if (loading) return <div className="h-64 animate-pulse rounded-xl bg-muted" aria-label="Chargement du dossier" />;
  if (!application) return (
    <div className="space-y-3">
      <Link href="/dashboard/applications">← Mes candidatures</Link>
      <p role="alert" className="text-destructive">{error || "Candidature introuvable."}</p>
    </div>
  );

  const app = application;
  const stage = applicationStageIndex(app.status);
  const context = `applicationId=${encodeURIComponent(app.id)}`;
  const match = app.job?.matches.find(item => item.cvId === app.cvId) ?? null;
  const packet = app.job?.applicationPackets.find(item => item.cvId === app.cvId) ?? null;
  const lastAts = atsReports[0];
  const packetHref = `/dashboard/application-agent?${context}`;
  const interviewHref = `/dashboard/interviews?${context}&role=${encodeURIComponent(app.jobTitle)}`;
  const canAnalyze = Boolean(
  app.jobId &&
  (app.job?.description?.trim().length ?? 0) >= 100 &&
  app.cvId
);
  const analysisHref = `/dashboard/job-match?${context}`;

  const goToAnalysis = () => {
    if (!app.jobId || !app.job?.description?.trim() || app.job.description.trim().length < 100) {
      setError("La description complète de cette offre est absente. Enregistrez une offre avec sa description avant d'analyser le CV.");
      selectTab("overview");
      return;
    }
    if (!app.cvId) {
      setError("Choisissez d'abord un CV pour cette candidature.");
      selectTab("documents");
      return;
    }
    router.push(analysisHref);
  };

  const documents = (
    <div className="grid gap-3 sm:grid-cols-2">
      <ApplicationDocuments
        kind="resume"
        selectedId={app.cvId}
        applicationId={app.id}
        disabled={busy}
        onSelect={cvId => patch({ cvId })}
      />
      <ApplicationDocuments
        kind="letter"
        selectedId={app.coverLetterId}
        applicationId={app.id}
        cvId={app.cvId}
        jobId={app.jobId}
        disabled={busy}
        onSelect={coverLetterId => patch({ coverLetterId })}
      />
    </div>
  );

  return (
    <main className="mx-auto max-w-6xl space-y-5 pb-10">
      <Link href="/dashboard/applications" className="inline-flex items-center gap-1 text-xs text-muted-foreground hover:text-foreground">
        <ArrowLeft className="size-3.5" /> Mes candidatures
      </Link>
      <header className="flex flex-wrap items-start justify-between gap-3">
        <div className="min-w-0">
          <p className="text-xs text-muted-foreground">{app.company}{app.location ? ` · ${app.location}` : ""}</p>
          <h1 className="mt-1 text-2xl font-semibold">{app.jobTitle}</h1>
          <span className={`mt-2 inline-flex rounded-md px-2 py-1 text-xs ${applicationStatusTone(app.status)}`}>
            {applicationStatusLabel(app.status)}
          </span>
        </div>
        <div className="flex gap-2">
          <select
            aria-label="Statut de candidature"
            disabled={busy}
            className="h-9 rounded-lg border bg-card px-2 text-xs"
            value={app.status}
            onChange={event => void patch({ status: event.target.value }).catch(() => {})}
          >
            {applicationStatuses.map(status => <option key={status} value={status}>{applicationStatusLabel(status)}</option>)}
          </select>
          {(app.jobUrl || app.job?.sourceUrl) && (
            <Button size="sm" variant="outline" asChild>
              <a href={app.jobUrl || app.job?.sourceUrl || "#"} target="_blank" rel="noopener noreferrer">
                Offre <ExternalLink className="size-3.5" />
              </a>
            </Button>
          )}
        </div>
      </header>

      <ol className="grid grid-cols-5 gap-1.5" aria-label="Progression">
        {applicationStages.map((status, index) => (
          <li key={status} className="min-w-0">
            <span className={`mb-1.5 block h-1.5 rounded-full ${stage >= index ? "bg-primary" : "bg-muted"}`} />
            <span className={`block truncate text-[10px] sm:text-xs ${stage === index ? "font-semibold" : "text-muted-foreground"}`}>
              {applicationStatusLabel(status)}
            </span>
          </li>
        ))}
      </ol>

      <nav role="tablist" aria-label="Dossier de candidature" className="flex gap-1 overflow-x-auto border-b">
        {tabs.map(item => (
          <button
            key={item.id}
            type="button"
            role="tab"
            id={`application-tab-${item.id}`}
            aria-selected={tab === item.id}
            aria-controls={`application-panel-${item.id}`}
            onClick={() => selectTab(item.id)}
            className={`shrink-0 border-b-2 px-3 py-2.5 text-sm ${tab === item.id ? "border-primary font-medium text-foreground" : "border-transparent text-muted-foreground"}`}
          >{item.name}</button>
        ))}
      </nav>
      {error && <p role="alert" className="rounded-md bg-destructive/10 px-3 py-2 text-sm text-destructive">{error}</p>}

      <section id={`application-panel-${tab}`} role="tabpanel" aria-labelledby={`application-tab-${tab}`}>
        {tab === "overview" && (
          <div className="space-y-4">
            <div className="flex items-center justify-between">
              <h2 className="text-sm font-semibold">Votre dossier</h2>
              <span className="text-xs text-muted-foreground">{[app.cvId, app.coverLetterId, match, packet].filter(Boolean).length}/4</span>
            </div>
            {documents}
            <div className="grid gap-3 sm:grid-cols-2">
              <button onClick={goToAnalysis} className="flex items-center justify-between rounded-xl border p-4 text-left text-sm hover:border-primary/40">
                <span className="flex items-center gap-2"><ScanSearch className="size-4" /> {match ? "Voir l'analyse" : "Analyser l'offre"}</span>
                <ArrowRight className="size-4 text-muted-foreground" />
              </button>
              <button onClick={() => { if (canAnalyze) router.push(packetHref); else goToAnalysis(); }} className="flex items-center justify-between rounded-xl border p-4 text-left text-sm hover:border-primary/40">
                <span className="flex items-center gap-2"><FileCheck2 className="size-4" /> {packet ? "Ouvrir le dossier préparé" : "Préparer le dossier"}</span>
                <ArrowRight className="size-4 text-muted-foreground" />
              </button>
            </div>
          </div>
        )}

        {tab === "documents" && (
          <div className="space-y-4">
            {documents}
            <div className="flex flex-wrap gap-2">
              <Button size="sm" onClick={() => { if (app.cvId && app.jobId && app.job?.description?.trim()) router.push(packetHref); else goToAnalysis(); }}>
                <FileCheck2 className="size-4" /> Préparer le dossier
              </Button>
              <Button size="sm" variant="outline" asChild>
                <Link href={`/dashboard/assistant?${context}`}>Career Agent <ArrowRight className="size-4" /></Link>
              </Button>
            </div>
          </div>
        )}

        {tab === "analysis" && (
          <div className="grid gap-3 md:grid-cols-2">
            <div className="space-y-3 rounded-xl border bg-card p-5">
              <div className="flex items-center gap-2">
                <FileText className="size-5 text-primary" />
                <h2 className="text-base font-semibold">Analyse ATS du CV</h2>
              </div>
              {atsLoading ? (
                <p className="text-sm text-muted-foreground">Chargement du diagnostic…</p>
              ) : lastAts && !lastAts.legacy ? (
                <div className="space-y-3">
                  <p className="text-xs text-muted-foreground">Dernière vérification : {dateLabel(lastAts.createdAt)}</p>
                  <div className="grid grid-cols-2 gap-2">
                    <div className="rounded-lg bg-muted/30 p-3">
                      <p className="text-xs text-muted-foreground">Contenu</p>
                      <p className="mt-1 text-lg font-semibold">{lastAts.content?.score ?? "—"}{lastAts.content?.score === null || lastAts.content?.score === undefined ? "" : "/100"}</p>
                    </div>
                    <div className="rounded-lg bg-muted/30 p-3">
                      <p className="text-xs text-muted-foreground">PDF</p>
                      <p className="mt-1 text-lg font-semibold">{lastAts.technical?.score ?? "—"}{lastAts.technical?.score === null || lastAts.technical?.score === undefined ? "" : "/100"}</p>
                    </div>
                  </div>
                  {lastAts.issues?.slice(0, 3).map(item => (
                    <div key={item.id} className="border-l-2 border-destructive/30 pl-3 text-xs">
                      <p className="font-medium">{item.title}</p>
                      <p className="mt-1 text-muted-foreground">{item.suggestion}</p>
                    </div>
                  ))}
                </div>
              ) : (
                <p className="text-sm text-muted-foreground">Aucun diagnostic ATS récent pour ce CV.</p>
              )}
              {app.cvId ? (
                <Button size="sm" asChild>
                  <Link href={`/dashboard/resumes/${encodeURIComponent(app.cvId)}?ats=1&${context}`}>
                    Vérifier ou refaire l'analyse ATS
                  </Link>
                </Button>
              ) : (
                <Button size="sm" variant="outline" onClick={() => selectTab("documents")}>
                  Choisir un CV
                </Button>
              )}
            </div>
            <div className="space-y-3 rounded-xl border bg-card p-5">
            <div className="flex items-center gap-2">
              <ScanSearch className="size-5 text-primary" />
              <h2 className="text-base font-semibold">Analyse du CV pour cette offre</h2>
            </div>
            {match ? (
              <>
                <p className="text-3xl font-semibold">{match.overallScore === null ? "—" : `${match.overallScore}%`}</p>
                <p className="text-xs text-muted-foreground">Correspondance indicative basée sur les documents.</p>
                <div className="flex flex-wrap gap-2">
                  <Button size="sm" onClick={() => router.push(`${analysisHref}&analysis=${encodeURIComponent(match.id)}`)}>Voir l'analyse</Button>
                  <Button size="sm" variant="outline" disabled={!canAnalyze} onClick={() => router.push(`${analysisHref}&reanalyze=1`)}>Réévaluer</Button>
                </div>
              </>
            ) : (
              <>
                <p className="text-sm text-muted-foreground">Aucune analyse enregistrée pour le CV associé.</p>
                <Button size="sm" onClick={goToAnalysis}>Analyser l'offre <ArrowRight className="size-4" /></Button>
              </>
            )}
            </div>
          </div>
        )}

        {tab === "interviews" && (
          <div className="max-w-3xl rounded-xl border bg-card p-5">
            <div className="flex items-center justify-between gap-3">
              <h2 className="text-sm font-semibold">Entretiens</h2>
              <Button size="sm" asChild><Link href={interviewHref}><MessageCircle className="size-4" /> Préparer</Link></Button>
            </div>
            {app.interviews.length ? (
              <div className="mt-3 divide-y text-sm">{app.interviews.map(item => (
                <div key={item.id} className="flex justify-between gap-3 py-3">
                  <span>{item.title}</span>
                  <span className="text-xs text-muted-foreground">{dateLabel(item.scheduledAt)} · {item.status}</span>
                </div>
              ))}</div>
            ) : <p className="mt-4 text-sm text-muted-foreground">Aucun entretien associé.</p>}
          </div>
        )}

        {tab === "activity" && (
          <div className="grid gap-4 lg:grid-cols-2">
            <div className="space-y-3 rounded-xl border bg-card p-4">
              <h2 className="text-sm font-semibold">Notes et prochaine action</h2>
              <label htmlFor="application-action" className="block text-xs text-muted-foreground">Prochaine action</label>
              <Input id="application-action" maxLength={1000} value={nextAction} onChange={event => setNextAction(event.target.value)} />
              <label htmlFor="application-notes" className="block text-xs text-muted-foreground">Notes personnelles</label>
              <GrowTextarea value={notes} onChange={setNotes} />
              <Button size="sm" disabled={busy || (notes === userNotes(app.notes) && nextAction === (app.nextAction ?? ""))} onClick={() => void patch({ notes, nextAction }).catch(() => {})}>
                <Check className="size-4" /> Enregistrer
              </Button>
            </div>
            <div className="space-y-3 rounded-xl border bg-card p-4">
              <h2 className="text-sm font-semibold">Rappels</h2>
              <form onSubmit={addReminder} className="space-y-2">
                <label htmlFor="reminder-date" className="block text-xs text-muted-foreground">Date du rappel</label>
                <Input id="reminder-date" type="datetime-local" required value={reminderDate} onChange={event => setReminderDate(event.target.value)} />
                <Input aria-label="Note du rappel" placeholder="Ex. Relancer le recruteur" maxLength={1000} value={reminderNote} onChange={event => setReminderNote(event.target.value)} />
                <Button type="submit" size="sm" variant="outline" disabled={busy || !reminderDate}><Plus className="size-4" /> Ajouter</Button>
              </form>
              <div className="space-y-2">{app.reminders.map(item => (
                <p key={item.id} className="flex gap-2 text-xs"><Clock3 className="size-4 text-muted-foreground" />{dateLabel(item.dueAt)} · {item.note || "Rappel"}</p>
              ))}</div>
            </div>
            <div className="rounded-xl border bg-card p-4 lg:col-span-2">
              <h2 className="text-sm font-semibold">Historique</h2>
              <div className="mt-3 divide-y">{app.statusEvents.map(item => (
                <div key={item.id} className="flex justify-between gap-3 py-2 text-xs">
                  <span>{applicationStatusLabel(item.status)}{item.note ? ` · ${item.note}` : ""}</span>
                  <time className="text-muted-foreground">{dateLabel(item.createdAt)}</time>
                </div>
              ))}</div>
            </div>
          </div>
        )}
      </section>
    </main>
  );
}
