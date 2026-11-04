"use client";

import { Suspense, useCallback, useEffect, useRef, useState } from "react";
import Link from "next/link";
import { useTranslation } from "react-i18next";
import { applicationCopy, applicationLocale, applicationErrorLabel, applicationInterviewStatusLabel } from "@/lib/career/application-copy";
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
const tabs: Tab[] = ["overview", "documents", "analysis", "interviews", "activity"];

const dateLabel = (value: string | null | undefined, language: "fr" | "en") =>
  value ? new Date(value).toLocaleDateString(applicationLocale(language), { day: "numeric", month: "short", year: "numeric" }) : applicationCopy[language].notScheduled;

// Imported source links mistakenly stored in notes are not personal notes.
const userNotes = (value: string | null) =>
  value && !/^\s*(?:(?:https?:\/\/|www\.)\S+|Original offer:\s*https?:\/\/\S+)\s*$/i.test(value)
    ? value
    : "";

function GrowTextarea({ value, onChange, placeholder }: { value: string; onChange: (value: string) => void; placeholder: string }) {
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
      placeholder={placeholder}
    />
  );
}

export default function ApplicationWorkspace() {
  return <Suspense fallback={<div className="h-64 animate-pulse rounded-xl bg-muted" />}><ApplicationWorkspaceContent /></Suspense>;
}

function ApplicationWorkspaceContent() {
  const { i18n } = useTranslation();
  const language = i18n.resolvedLanguage?.startsWith("fr") ? "fr" : "en";
  const c = applicationCopy[language];
  const { id } = useParams<{ id: string }>();
  const router = useRouter();
  const requestedTab = useSearchParams().get("tab");
  const [tab, setTab] = useState<Tab>(tabs.some(item => item === requestedTab) ? requestedTab as Tab : "overview");
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
    if (tabs.some(item => item === requestedTab)) setTab(requestedTab as Tab);
  }, [requestedTab]);

  const load = useCallback(async (signal?: AbortSignal): Promise<Application> => {
    const response = await fetch(`/api/applications/${encodeURIComponent(id)}`, { cache: "no-store", signal });
    if (!response.ok) throw new Error(response.status === 404 ? "NOT_FOUND" : "LOAD_FAILED");
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
      if (!controller.signal.aborted) setError(failure instanceof Error ? failure.message : "LOAD_FAILED");
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
        throw new Error(payload.error || "UPDATE_FAILED");
      }
      const updated = await load();
      updateLocal(updated, "notes" in data || "nextAction" in data);
    } catch (failure) {
      const code = failure instanceof Error ? failure.message : "UPDATE_FAILED";
      setError(code);
      throw new Error(applicationErrorLabel(code, language, c.updateFailed));
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
      if (!response.ok) throw new Error("REMINDER_FAILED");
      setReminderDate(""); setReminderNote("");
      updateLocal(await load());
    } catch (failure) {
      setError("REMINDER_FAILED");
    } finally { setBusy(false); }
  };

  if (loading) return <div className="h-64 animate-pulse rounded-xl bg-muted" aria-label={c.loading} />;
  if (!application) return (
    <div className="space-y-3">
      <Link href="/dashboard/applications">← {c.applications}</Link>
      <p role="alert" className="text-destructive">{applicationErrorLabel(error, language, c.applicationNotFound)}</p>
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
      setError("JOB_DESCRIPTION_MISSING");
      selectTab("overview");
      return;
    }
    if (!app.cvId) {
      setError("RESUME_REQUIRED");
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
        <ArrowLeft className="size-3.5" /> {c.applications}
      </Link>
      <header className="flex flex-wrap items-start justify-between gap-3">
        <div className="min-w-0">
          <p className="text-xs text-muted-foreground">{app.company}{app.location ? ` · ${app.location}` : ""}</p>
          <h1 className="mt-1 text-2xl font-semibold">{app.jobTitle}</h1>
          <span className={`mt-2 inline-flex rounded-md px-2 py-1 text-xs ${applicationStatusTone(app.status)}`}>
            {applicationStatusLabel(app.status, language)}
          </span>
        </div>
        <div className="flex gap-2">
          <select
            aria-label={c.applicationStatus}
            disabled={busy}
            className="h-9 rounded-lg border bg-card px-2 text-xs"
            value={app.status}
            onChange={event => void patch({ status: event.target.value }).catch(() => {})}
          >
            {applicationStatuses.map(status => <option key={status} value={status}>{applicationStatusLabel(status, language)}</option>)}
          </select>
          {(app.jobUrl || app.job?.sourceUrl) && (
            <Button size="sm" variant="outline" asChild>
              <a href={app.jobUrl || app.job?.sourceUrl || "#"} target="_blank" rel="noopener noreferrer">
                {c.jobOffer} <ExternalLink className="size-3.5" />
              </a>
            </Button>
          )}
        </div>
      </header>

      <ol className="grid grid-cols-5 gap-1.5" aria-label={c.progress}>
        {applicationStages.map((status, index) => (
          <li key={status} className="min-w-0">
            <span className={`mb-1.5 block h-1.5 rounded-full ${stage >= index ? "bg-primary" : "bg-muted"}`} />
            <span className={`block truncate text-[10px] sm:text-xs ${stage === index ? "font-semibold" : "text-muted-foreground"}`}>
              {applicationStatusLabel(status, language)}
            </span>
          </li>
        ))}
      </ol>

      <nav role="tablist" aria-label={c.applicationWorkspace} className="flex gap-1 overflow-x-auto border-b">
        {tabs.map(item => (
          <button
            key={item}
            type="button"
            role="tab"
            id={`application-tab-${item}`}
            aria-selected={tab === item}
            aria-controls={`application-panel-${item}`}
            onClick={() => selectTab(item)}
            className={`shrink-0 border-b-2 px-3 py-2.5 text-sm ${tab === item ? "border-primary font-medium text-foreground" : "border-transparent text-muted-foreground"}`}
          >{c[item]}</button>
        ))}
      </nav>
      {error && <p role="alert" className="rounded-md bg-destructive/10 px-3 py-2 text-sm text-destructive">{
        error === "JOB_DESCRIPTION_MISSING" ? c.jobDescriptionMissing
        : error === "RESUME_REQUIRED" ? c.selectResumeFirst
        : error === "REMINDER_FAILED" ? c.reminderFailed
        : error === "LOAD_FAILED" ? c.loadApplicationFailed
        : applicationErrorLabel(error, language, c.updateFailed)
      }</p>}

      <section id={`application-panel-${tab}`} role="tabpanel" aria-labelledby={`application-tab-${tab}`}>
        {tab === "overview" && (
          <div className="space-y-4">
            <div className="flex items-center justify-between">
              <h2 className="text-sm font-semibold">{c.yourPacket}</h2>
              <span className="text-xs text-muted-foreground">{[app.cvId, app.coverLetterId, match, packet].filter(Boolean).length}/4</span>
            </div>
            {documents}
            <div className="grid gap-3 sm:grid-cols-2">
              <button onClick={goToAnalysis} className="flex items-center justify-between rounded-xl border p-4 text-left text-sm hover:border-primary/40">
                <span className="flex items-center gap-2"><ScanSearch className="size-4" /> {match ? c.viewAnalysis : c.analyzeOffer}</span>
                <ArrowRight className="size-4 text-muted-foreground" />
              </button>
              <button onClick={() => { if (canAnalyze) router.push(packetHref); else goToAnalysis(); }} className="flex items-center justify-between rounded-xl border p-4 text-left text-sm hover:border-primary/40">
                <span className="flex items-center gap-2"><FileCheck2 className="size-4" /> {packet ? c.openPreparedPacket : c.preparePacket}</span>
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
                <FileCheck2 className="size-4" /> {c.preparePacket}
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
                <h2 className="text-base font-semibold">{c.atsResume}</h2>
              </div>
              {atsLoading ? (
                <p className="text-sm text-muted-foreground">{c.loadingAssessment}</p>
              ) : lastAts && !lastAts.legacy ? (
                <div className="space-y-3">
                  <p className="text-xs text-muted-foreground">{c.lastCheck}: {dateLabel(lastAts.createdAt, language)}</p>
                  <div className="grid grid-cols-2 gap-2">
                    <div className="rounded-lg bg-muted/30 p-3">
                      <p className="text-xs text-muted-foreground">{c.content}</p>
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
                <p className="text-sm text-muted-foreground">{c.noRecentAts}</p>
              )}
              {app.cvId ? (
                <Button size="sm" asChild>
                  <Link href={`/dashboard/resumes/${encodeURIComponent(app.cvId)}?ats=1&${context}`}>
                    {c.checkAts}
                  </Link>
                </Button>
              ) : (
                <Button size="sm" variant="outline" onClick={() => selectTab("documents")}>
                  {c.chooseResume}
                </Button>
              )}
            </div>
            <div className="space-y-3 rounded-xl border bg-card p-5">
            <div className="flex items-center gap-2">
              <ScanSearch className="size-5 text-primary" />
              <h2 className="text-base font-semibold">{c.jobResumeAnalysis}</h2>
            </div>
            {match ? (
              <>
                <p className="text-3xl font-semibold">{match.overallScore === null ? "—" : `${match.overallScore}%`}</p>
                <p className="text-xs text-muted-foreground">{c.approximateMatch}</p>
                <div className="flex flex-wrap gap-2">
                  <Button size="sm" onClick={() => router.push(`${analysisHref}&analysis=${encodeURIComponent(match.id)}`)}>{c.viewAnalysis}</Button>
                  <Button size="sm" variant="outline" disabled={!canAnalyze} onClick={() => router.push(`${analysisHref}&reanalyze=1`)}>{c.reassess}</Button>
                </div>
              </>
            ) : (
              <>
                <p className="text-sm text-muted-foreground">{c.noMatch}</p>
                <Button size="sm" onClick={goToAnalysis}>{c.analyzeOffer} <ArrowRight className="size-4" /></Button>
              </>
            )}
            </div>
          </div>
        )}

        {tab === "interviews" && (
          <div className="max-w-3xl rounded-xl border bg-card p-5">
            <div className="flex items-center justify-between gap-3">
              <h2 className="text-sm font-semibold">{c.interviews}</h2>
              <Button size="sm" asChild><Link href={interviewHref}><MessageCircle className="size-4" /> {c.prepare}</Link></Button>
            </div>
            {app.interviews.length ? (
              <div className="mt-3 divide-y text-sm">{app.interviews.map(item => (
                <div key={item.id} className="flex justify-between gap-3 py-3">
                  <span>{item.title}</span>
                  <span className="text-xs text-muted-foreground">{dateLabel(item.scheduledAt, language)} · {applicationInterviewStatusLabel(item.status, language)}</span>
                </div>
              ))}</div>
            ) : <p className="mt-4 text-sm text-muted-foreground">{c.noInterviews}</p>}
          </div>
        )}

        {tab === "activity" && (
          <div className="grid gap-4 lg:grid-cols-2">
            <div className="space-y-3 rounded-xl border bg-card p-4">
              <h2 className="text-sm font-semibold">{c.notesAndNextAction}</h2>
              <label htmlFor="application-action" className="block text-xs text-muted-foreground">{c.nextAction}</label>
              <Input id="application-action" maxLength={1000} value={nextAction} onChange={event => setNextAction(event.target.value)} />
              <label htmlFor="application-notes" className="block text-xs text-muted-foreground">{c.personalNotes}</label>
              <GrowTextarea value={notes} onChange={setNotes} placeholder={c.personalNotesPlaceholder} />
              <Button size="sm" disabled={busy || (notes === userNotes(app.notes) && nextAction === (app.nextAction ?? ""))} onClick={() => void patch({ notes, nextAction }).catch(() => {})}>
                <Check className="size-4" /> {c.save}
              </Button>
            </div>
            <div className="space-y-3 rounded-xl border bg-card p-4">
              <h2 className="text-sm font-semibold">{c.reminders}</h2>
              <form onSubmit={addReminder} className="space-y-2">
                <label htmlFor="reminder-date" className="block text-xs text-muted-foreground">{c.reminderDate}</label>
                <Input id="reminder-date" type="datetime-local" required value={reminderDate} onChange={event => setReminderDate(event.target.value)} />
                <Input aria-label={c.reminderNote} placeholder={c.reminderExample} maxLength={1000} value={reminderNote} onChange={event => setReminderNote(event.target.value)} />
                <Button type="submit" size="sm" variant="outline" disabled={busy || !reminderDate}><Plus className="size-4" /> {c.add}</Button>
              </form>
              <div className="space-y-2">{app.reminders.map(item => (
                <p key={item.id} className="flex gap-2 text-xs"><Clock3 className="size-4 text-muted-foreground" />{dateLabel(item.dueAt, language)} · {item.note || c.reminder}</p>
              ))}</div>
            </div>
            <div className="rounded-xl border bg-card p-4 lg:col-span-2">
              <h2 className="text-sm font-semibold">{c.history}</h2>
              <div className="mt-3 divide-y">{app.statusEvents.map(item => (
                <div key={item.id} className="flex justify-between gap-3 py-2 text-xs">
                  <span>{applicationStatusLabel(item.status, language)}{item.note ? ` · ${item.note}` : ""}</span>
                  <time className="text-muted-foreground">{dateLabel(item.createdAt, language)}</time>
                </div>
              ))}</div>
            </div>
          </div>
        )}
      </section>
    </main>
  );
}
