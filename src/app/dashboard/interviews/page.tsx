"use client";

import { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import { useTranslation } from "react-i18next";
import {
  ArrowLeft, BriefcaseBusiness, Check, ClipboardList, FileText,
  LoaderCircle, Mic, MoreHorizontal, Phone, Play, Plus,
  Send, Trash2, Volume2,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { AtsResumePreview, type AtsResumeRecord } from "@/components/resumes/ats-resume-preview";
import { ScreeningCall, type VoiceConnection } from "@/components/interviews/screening-call";

type Feedback = {
  status: "evaluated" | "unavailable";
  score: number | null;
  strength: string;
  improvement: string;
  nextExercise: string;
};
type Question = { question: string; suggestedAnswer: string; focus: string };
type Message = { id: string; role: string; content: string; feedback?: Feedback | null };
type Report = {
  kind?: "AI_SCREENING";
  status?: string;
  overallScore?: number | null;
  dimensions?: Record<string, number | null> | null;
  summary?: string;
  strengths?: string[];
  improvements?: string[];
  recommendedAction?: string;
  reason?: string;
};
type Session = {
  id: string;
  title: string;
  status: string;
  type: string;
  createdAt?: string;
  currentQuestion: number;
  overallScore: number | null;
  messages?: Message[];
  configuration?: {
    mode?: string;
    language?: "fr" | "en";
    questionSet?: { questions: Question[] };
  };
  report?: Report | null;
};
type Application = {
  id: string;
  company: string;
  jobTitle: string;
  jobId?: string | null;
  cvId?: string | null;
};
type ApplicationDetail = Application & {
  job?: { description?: string | null } | null;
};

type Mode = "basic" | "personalized";
const levels = ["Junior", "Mid", "Senior"] as const;
const screeningDimensions: Record<string, { fr: string; en: string }> = {
  cvConsistency: { fr: "Cohérence avec le CV", en: "CV consistency" },
  jobRelevance: { fr: "Pertinence pour le poste", en: "Job relevance" },
  communication: { fr: "Communication", en: "Communication" },
  motivation: { fr: "Motivation", en: "Motivation" },
  experience: { fr: "Expérience", en: "Experience" },
  professionalism: { fr: "Professionnalisme", en: "Professionalism" },
};

async function jsonRequest<T>(url: string, method = "GET", body?: unknown): Promise<T> {
  const result = await fetch(url, {
    method,
    cache: "no-store",
    headers: body === undefined ? undefined : { "content-type": "application/json" },
    body: body === undefined ? undefined : JSON.stringify(body),
  });
  const payload: unknown = await result.json().catch(() => ({}));
  if (!result.ok) {
    const cause = payload && typeof payload === "object" && "error" in payload
      ? String(payload.error) : "REQUEST_FAILED";
    throw new Error(cause);
  }
  return payload as T;
}

export default function InterviewsPage() {
  const { i18n } = useTranslation();
  const language: "fr" | "en" = i18n.resolvedLanguage?.startsWith("fr") ? "fr" : "en";
  const fr = language === "fr";
  const [sessions, setSessions] = useState<Session[]>([]);
  const [current, setCurrent] = useState<Session | null>(null);
  const [dialog, setDialog] = useState<"questions" | "screening" | null>(null);
  const [mode, setMode] = useState<Mode>("basic");
  const [role, setRole] = useState("");
  const [level, setLevel] = useState<string>("Mid");
  const [cvId, setCvId] = useState("");
  const [applicationId, setApplicationId] = useState("");
  const [description, setDescription] = useState("");
  const [resumes, setResumes] = useState<AtsResumeRecord[]>([]);
  const [applications, setApplications] = useState<Application[]>([]);
  const [selectedDetail, setSelectedDetail] = useState<ApplicationDetail | null>(null);
  const [connection, setConnection] = useState<VoiceConnection | null>(null);
  const [endingId, setEndingId] = useState("");
  const [consent, setConsent] = useState(false);
  const [answer, setAnswer] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [showActions, setShowActions] = useState<string | null>(null);

  const loadSessions = useCallback(async () => {
    const data = await jsonRequest<Session[]>("/api/interviews");
    setSessions(data);
    return data;
  }, []);

  useEffect(() => {
    void loadSessions().catch(() => setError("INTERVIEWS_UNAVAILABLE"));
    const controller = new AbortController();
    void Promise.all([
      fetch("/api/cvs?mine=1", { signal: controller.signal, cache: "no-store" })
        .then(r => r.ok ? r.json() : []),
      fetch("/api/applications?pageSize=100", { signal: controller.signal, cache: "no-store" })
        .then(r => r.ok ? r.json() : { items: [] }),
    ]).then(([cvData, appData]) => {
      if (controller.signal.aborted) return;
      setResumes(Array.isArray(cvData) ? cvData : []);
      setApplications(Array.isArray(appData?.items) ? appData.items : []);
    }).catch(() => {/* The user can still create a basic interview. */});
    const fromApplication = new URLSearchParams(window.location.search).get("applicationId");
    if (fromApplication && /^[0-9a-f-]{36}$/i.test(fromApplication)) {
      setApplicationId(fromApplication);
      setMode("personalized");
    }
    return () => controller.abort();
  }, [loadSessions]);

  useEffect(() => {
    if (!applicationId) { setSelectedDetail(null); return; }
    const controller = new AbortController();
    void fetch(`/api/applications/${encodeURIComponent(applicationId)}`, {
      signal: controller.signal, cache: "no-store",
    }).then(async response => {
      if (!response.ok) throw new Error("APPLICATION_NOT_FOUND");
      return response.json() as Promise<ApplicationDetail>;
    }).then(item => {
      if (controller.signal.aborted) return;
      setSelectedDetail(item);
      setRole(item.jobTitle);
      setCvId(item.cvId ?? "");
      setDescription(item.job?.description?.slice(0, 12000) ?? "");
    }).catch(() => { if (!controller.signal.aborted) setError("APPLICATION_NOT_FOUND"); });
    return () => controller.abort();
  }, [applicationId]);

  useEffect(() => {
    if (!endingId) return;
    let cancelled = false;
    let attempts = 0;
    const timer = setInterval(() => {
      attempts += 1;
      void jsonRequest<Session>(`/api/interviews/${encodeURIComponent(endingId)}`)
        .then(value => {
          if (cancelled) return;
          if (["COMPLETED", "VOICE_UNGRADED", "VOICE_UNAVAILABLE"].includes(value.status)) {
            setCurrent(value);
            setEndingId("");
            void loadSessions();
          }
        }).catch(() => {/* Allow the user to retry manually. */});
      if (attempts >= 24) {
        clearInterval(timer);
        if (!cancelled) {
          setEndingId("");
          setError("Report still processing. Open the saved interview later to check its status.");
          void loadSessions();
        }
      }
    }, 3500);
    return () => { cancelled = true; clearInterval(timer); };
  }, [endingId, loadSessions]);

  const execute = async (task: () => Promise<void>) => {
    setBusy(true);
    setError("");
    try { await task(); }
    catch (reason) { setError(reason instanceof Error ? reason.message : "REQUEST_FAILED"); }
    finally { setBusy(false); }
  };

  const prepare = () => execute(async () => {
    const personalized = mode === "personalized";
    const session = await jsonRequest<Session>("/api/interviews", "POST", {
      mode: "PREPARATION",
      role: role.trim(),
      level,
      language,
      questionCount: 20,
      ...(personalized && cvId ? { cvId } : {}),
      ...(personalized && applicationId ? { applicationId } : {}),
      ...(personalized && !applicationId && description.trim()
        ? { jobDescription: description.trim() } : {}),
    });
    setDialog(null);
    setCurrent(session);
    void loadSessions();
  });

  const startPrepared = (session: Session) => execute(async () => {
    const started = await jsonRequest<Session>(`/api/interviews/${session.id}/start`, "POST");
    setCurrent(started);
    void loadSessions();
  });

  const send = () => execute(async () => {
    if (!current || !answer.trim()) return;
    await jsonRequest(`/api/interviews/${current.id}/message`, "POST", { answer: answer.trim() });
    setAnswer("");
    setCurrent(await jsonRequest<Session>(`/api/interviews/${current.id}`));
    void loadSessions();
  });

  const finish = () => execute(async () => {
    if (!current) return;
    setCurrent(await jsonRequest<Session>(`/api/interviews/${current.id}/finish`, "POST"));
    void loadSessions();
  });

  const createScreening = () => execute(async () => {
    const response = await jsonRequest<VoiceConnection>("/api/interviews/screening/start", "POST", {
      applicationId, language, consent,
    });
    setDialog(null);
    setConnection(response);
  });

  const deleteSession = (id: string) => execute(async () => {
    await jsonRequest(`/api/interviews/${id}`, "DELETE");
    if (current?.id === id) setCurrent(null);
    setShowActions(null);
    await loadSessions();
  });

  const selectApplication = (id: string) => {
    setApplicationId(id);
    setConsent(false);
  };
  const openSession = async (session: Session) => {
    setError("");
    await execute(async () => {
      setCurrent(await jsonRequest<Session>(`/api/interviews/${session.id}`));
    });
  };
  const goBack = () => {
    setCurrent(null);
    setAnswer("");
    setError("");
    void loadSessions();
  };

  const header = (
    <div className="flex flex-wrap items-center justify-between gap-3">
      <h1 className="text-xl font-semibold">{fr ? "Entretiens" : "Job Interviews"}</h1>
      <div className="flex items-center gap-2">
        <Button variant="outline" size="sm" onClick={() => setDialog("screening")}>
          <Phone className="size-4" /> AI Screening Call
        </Button>
        <Button size="sm" onClick={() => { setError(""); setDialog("questions"); }}>
          <Plus className="size-4" /> {fr ? "Créer" : "Create New"}
        </Button>
      </div>
    </div>
  );

  const report = current?.report;
  const isVoice = current?.configuration?.mode === "AI_SCREENING_VOICE";
  const questions = current?.configuration?.questionSet?.questions ?? [];
  const answered = current?.messages?.filter(message => message.role === "user").length ?? 0;
  const isPrepared = current?.status === "PREPARATION";
  const isActive = current?.status === "ACTIVE";
  const readyToFinish = current?.status === "READY_TO_FINISH";
  const t = (en: string, french: string) => fr ? french : en;

  return (
    <div className="mx-auto max-w-6xl space-y-5 pb-10">
      {current || connection ? (
        <div className="flex items-center gap-3">
          <Button variant="ghost" size="sm" onClick={goBack} disabled={Boolean(connection)}>
            <ArrowLeft className="size-4" /> {t("All interviews", "Tous les entretiens")}
          </Button>
          <span className="min-w-0 truncate text-sm font-medium">{current?.title || "AI Screening Interview"}</span>
        </div>
      ) : header}

      {error && <p role="alert" className="rounded-lg border border-destructive/25 p-3 text-sm text-destructive">{error}</p>}

      {connection ? (
        <ScreeningCall
          language={language}
          connection={connection}
          onClosed={(id) => {
            setConnection(null);
            setEndingId(id);
            void loadSessions();
          }}
        />
      ) : endingId ? (
        <section className="rounded-xl border p-8 text-center">
          <LoaderCircle className="mx-auto mb-3 size-6 animate-spin text-primary" />
          <p className="text-sm">{t("Preparing your screening report…", "Préparation de votre rapport d'entretien…")}</p>
          <Button variant="outline" className="mt-4" onClick={() => void loadSessions()}>
            {t("Refresh", "Actualiser")}
          </Button>
        </section>
      ) : current ? (
        <div className="space-y-5 rounded-2xl border bg-card p-5">
          <div className="flex flex-wrap items-center justify-between gap-2 border-b pb-4">
            <div>
              <h2 className="font-semibold">{current.title}</h2>
              <p className="text-xs text-muted-foreground">
                {isVoice ? "AI Screening Call" : `${answered} / ${questions.length || 20} questions`}
              </p>
            </div>
            {isPrepared ? (
              <Button disabled={busy} onClick={() => void startPrepared(current)}>
                <Play className="size-4" /> {t("Start practice", "Commencer")}
              </Button>
            ) : (isActive || readyToFinish) && (
              <Button variant="outline" disabled={busy} onClick={() => void finish()}>
                {t("Finish", "Terminer")}
              </Button>
            )}
          </div>

          {isPrepared && (
            <div className="space-y-2">
              {questions.map((question, index) => (
                <details key={index} className="rounded-lg border p-3">
                  <summary className="cursor-pointer text-sm font-medium">
                    {index + 1}. {question.question}
                  </summary>
                  <p className="mt-2 text-sm text-muted-foreground">{question.suggestedAnswer}</p>
                </details>
              ))}
            </div>
          )}

          {(isActive || readyToFinish || (!isVoice && current.status === "COMPLETED")) && (
            <div className="space-y-3">
              {current.messages?.map(message => (
                <div key={message.id} className={`rounded-xl p-3 text-sm ${message.role === "user" ? "ml-5 bg-primary/10" : "mr-5 bg-muted/60"}`}>
                  <p className="whitespace-pre-wrap">{message.content}</p>
                  {message.feedback?.improvement && (
                    <p className="mt-2 border-t pt-2 text-xs text-muted-foreground">
                      {message.feedback.improvement}
                    </p>
                  )}
                </div>
              ))}
              {isActive && (
                <div className="space-y-2">
                  <label htmlFor="interview-answer" className="text-sm font-medium">
                    {t("Your answer", "Votre réponse")}
                  </label>
                  <Textarea
                    id="interview-answer"
                    rows={3}
                    maxLength={8000}
                    value={answer}
                    onChange={event => setAnswer(event.target.value)}
                    className="min-h-[72px] resize-y"
                  />
                  <div className="flex justify-end gap-2">
                    <Button variant="outline" size="sm" onClick={() => {
                      const last = [...(current.messages || [])].reverse().find(message => message.role === "assistant");
                      if (last && "speechSynthesis" in window) {
                        window.speechSynthesis.cancel();
                        const voice = new SpeechSynthesisUtterance(last.content);
                        voice.lang = language === "fr" ? "fr-FR" : "en-US";
                        window.speechSynthesis.speak(voice);
                      }
                    }}>
                      <Volume2 className="size-4" /> {t("Listen", "Écouter")}
                    </Button>
                    <Button size="sm" disabled={!answer.trim() || busy} onClick={() => void send()}>
                      <Send className="size-4" /> {t("Submit", "Envoyer")}
                    </Button>
                  </div>
                </div>
              )}
            </div>
          )}

          {report && (
            <div className="space-y-5">
              <div className="flex items-center gap-5 rounded-xl bg-muted/40 p-4">
                <div>
                  <p className="text-3xl font-semibold tabular-nums">
                    {typeof current.overallScore === "number" ? `${current.overallScore}/100` : "—"}
                  </p>
                  <p className="text-xs text-muted-foreground">{t("Practice score", "Score d'entraînement")}</p>
                </div>
                <p className="max-w-xl text-sm text-muted-foreground">
                  {report.summary || t("No evaluation was available.", "Évaluation indisponible.")}
                </p>
              </div>
              {report.kind === "AI_SCREENING" && report.dimensions && (
                <div className="grid gap-3 sm:grid-cols-2">
                  {Object.entries(screeningDimensions).map(([key, names]) => {
                    const value = report.dimensions?.[key];
                    return (
                      <div key={key} className="space-y-2 rounded-lg border p-3">
                        <div className="flex justify-between text-sm">
                          <span>{names[language]}</span>
                          <span className="tabular-nums">{typeof value === "number" ? `${value}/100` : "—"}</span>
                        </div>
                        <div className="h-1.5 overflow-hidden rounded-full bg-muted">
                          <div className="h-full bg-primary" style={{ width: `${typeof value === "number" ? value : 0}%` }} />
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}
              {report.kind === "AI_SCREENING" && (
                <div className="grid gap-4 md:grid-cols-2">
                  <div className="rounded-xl bg-emerald-500/10 p-4">
                    <p className="mb-2 text-sm font-semibold">{t("Strengths", "Points forts")}</p>
                    {report.strengths?.map((item, i) => <p key={i} className="mb-2 text-sm">{item}</p>)}
                  </div>
                  <div className="rounded-xl bg-red-500/10 p-4">
                    <p className="mb-2 text-sm font-semibold">{t("To improve", "À améliorer")}</p>
                    {report.improvements?.map((item, i) => <p key={i} className="mb-2 text-sm">{item}</p>)}
                  </div>
                </div>
              )}
              {report.recommendedAction && <p className="rounded-lg border p-3 text-sm">{report.recommendedAction}</p>}
              <p className="text-xs text-muted-foreground">
                {t("Educational feedback only, not a prediction of hiring.", "Retour pédagogique uniquement, pas une prédiction d'embauche.")}
              </p>
            </div>
          )}
          {current.status === "VOICE_ENDING" && <p className="text-sm text-muted-foreground">{t("Report pending.", "Rapport en préparation.")}</p>}
        </div>
      ) : (
        <div className="rounded-2xl bg-muted/25 p-5 sm:p-7">
          <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-4">
            <button type="button"
              className="flex min-h-44 flex-col items-center justify-center gap-2 rounded-xl border border-dashed border-primary/55 text-sm text-primary transition hover:bg-primary/5"
              onClick={() => setDialog("questions")}
            >
              <Plus className="size-6" /> {t("New Interview", "Nouvel entretien")}
            </button>
            {sessions.map(item => (
              <div key={item.id} className="relative flex min-h-44 flex-col justify-between rounded-xl border bg-card p-4">
                <button type="button" className="min-w-0 text-left" onClick={() => void openSession(item)}>
                  <p className="line-clamp-2 text-sm font-medium">{item.title}</p>
                  <p className="mt-1 text-xs text-muted-foreground">
                    {item.configuration?.mode === "AI_SCREENING_VOICE" ? "AI Screening Call" : "Practice"}
                  </p>
                </button>
                <div className="flex items-end justify-between gap-2">
                  {item.configuration?.mode === "AI_SCREENING_VOICE"
                    ? <Phone className="size-6 text-primary" />
                    : <ClipboardList className="size-6 text-primary" />}
                  <div className="relative">
                    <button type="button" aria-label={t("More actions", "Autres actions")}
                      onClick={() => setShowActions(showActions === item.id ? null : item.id)}
                      className="rounded-md p-1 hover:bg-muted">
                      <MoreHorizontal className="size-4" />
                    </button>
                    {showActions === item.id && (
                      <div className="absolute bottom-full right-0 z-10 min-w-28 rounded-md border bg-popover p-1 shadow-lg">
                        <Button variant="ghost" size="sm" onClick={() => void deleteSession(item.id)} disabled={busy}>
                          <Trash2 className="size-4" /> {t("Delete", "Supprimer")}
                        </Button>
                      </div>
                    )}
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      <Dialog open={dialog === "questions"} onOpenChange={open => !open && setDialog(null)}>
        <DialogContent className="max-w-[460px] gap-4 p-5 sm:p-6">
          <DialogHeader>
            <DialogTitle>{t("Job Interview Questions", "Questions d'entretien")}</DialogTitle>
            <DialogDescription className="sr-only">
              {t("Prepare 20 interview questions.", "Préparer 20 questions d'entretien.")}
            </DialogDescription>
          </DialogHeader>
          <div className="grid grid-cols-2 rounded-lg border p-1" role="tablist" aria-label="Interview mode">
            {(["basic", "personalized"] as const).map(item => (
              <button key={item} type="button" role="tab" aria-selected={mode === item}
                onClick={() => setMode(item)}
                className={`rounded-md px-3 py-2 text-sm ${mode === item ? "bg-primary text-primary-foreground" : "text-muted-foreground"}`}>
                {item === "basic" ? "Basic" : "Personalized"}
              </button>
            ))}
          </div>
          <div className="space-y-3">
            <div className="space-y-1">
              <label htmlFor="interview-role" className="text-xs font-medium">{t("Job title", "Métier")}</label>
              <Input id="interview-role" maxLength={160} value={role}
                onChange={event => setRole(event.target.value)}
                placeholder={t("e.g. Software Engineer", "Ex. Développeur logiciel")}
                disabled={mode === "personalized" && Boolean(applicationId)} />
            </div>
            <div className="space-y-2">
              <span className="text-xs font-medium">{t("Seniority", "Niveau")}</span>
              <div className="grid grid-cols-3 overflow-hidden rounded-lg border">
                {levels.map(item => (
                  <button key={item} type="button" onClick={() => setLevel(item)}
                    aria-pressed={level === item}
                    className={`py-2 text-sm ${level === item ? "bg-primary/10 font-medium text-primary" : "text-muted-foreground"}`}>
                    {item}
                  </button>
                ))}
              </div>
            </div>
          </div>
          {mode === "personalized" && (
            <div className="space-y-3 border-t pt-3">
              <div className="space-y-1">
                <label htmlFor="personalized-application" className="text-xs font-medium">
                  {t("Application (optional)", "Candidature (facultative)")}
                </label>
                <select id="personalized-application" value={applicationId}
                  onChange={event => {
                    setApplicationId(event.target.value);
                    if (!event.target.value) { setCvId(""); setDescription(""); }
                  }} className="h-9 w-full rounded-md border bg-background px-2 text-sm">
                  <option value="">{t("No application", "Sans candidature")}</option>
                  {applications.map(item => <option key={item.id} value={item.id}>
                    {item.jobTitle} · {item.company}
                  </option>)}
                </select>
              </div>
              <p className="text-xs font-medium">{t("Select a resume", "Choisir un CV")}</p>
              <div className="flex gap-2 overflow-x-auto pb-2">
                {resumes.map(item => (
                  <button key={item.id} type="button" disabled={Boolean(applicationId)}
                    onClick={() => setCvId(item.id)}
                    aria-pressed={cvId === item.id}
                    className={`w-28 shrink-0 overflow-hidden rounded-lg border p-1 text-left ${cvId === item.id ? "border-primary ring-1 ring-primary" : "border-border"}`}>
                    <div className="h-28 overflow-hidden rounded-sm bg-muted/20">
                      <AtsResumePreview record={item} language={language} />
                    </div>
                    <p className="truncate px-1 pt-1 text-xs">{item.title}</p>
                  </button>
                ))}
                {resumes.length === 0 && (
                  <Link href="/dashboard/resumes" className="flex h-28 items-center rounded-lg border border-dashed p-3 text-xs">
                    <FileText className="mr-2 size-4" /> {t("Create a resume", "Créer un CV")}
                  </Link>
                )}
              </div>
              {!applicationId && (
                <div className="space-y-1">
                  <label htmlFor="personalized-job" className="text-xs font-medium">
                    {t("Job description (optional)", "Description du poste (facultative)")}
                  </label>
                  <Textarea id="personalized-job" value={description}
                    onChange={event => setDescription(event.target.value)}
                    rows={2} maxLength={12000} className="min-h-12 max-h-48 resize-y" />
                </div>
              )}
              {applicationId && selectedDetail && !selectedDetail.cvId && (
                <p className="text-xs text-destructive">{t("Attach a resume to this application first.", "Associez d'abord un CV à cette candidature.")}</p>
              )}
            </div>
          )}
          <div className="flex items-center justify-between pt-2">
            <span className="text-xs text-muted-foreground">20 {t("questions", "questions")}</span>
            <Button disabled={busy || role.trim().length < 2 || (mode === "personalized" && !cvId)}
              onClick={() => void prepare()}>
              {busy && <LoaderCircle className="size-4 animate-spin" />}
              {t("Generate with AI", "Générer avec l'IA")}
            </Button>
          </div>
        </DialogContent>
      </Dialog>

      <Dialog open={dialog === "screening"} onOpenChange={open => !open && setDialog(null)}>
        <DialogContent className="max-w-[480px] gap-4 p-5 sm:p-6">
          <DialogHeader>
            <DialogTitle>AI Screening Interview</DialogTitle>
            <DialogDescription>
              {t("Choose an application with a resume and job posting.", "Choisissez une candidature avec un CV et une offre.")}
            </DialogDescription>
          </DialogHeader>
          <div className="max-h-52 space-y-2 overflow-y-auto">
            {applications.map(item => (
              <button key={item.id} type="button" onClick={() => selectApplication(item.id)}
                aria-pressed={applicationId === item.id}
                className={`flex w-full items-center gap-3 rounded-lg border p-3 text-left ${applicationId === item.id ? "border-primary" : "border-border"}`}>
                <BriefcaseBusiness className="size-5 shrink-0 text-primary" />
                <span className="min-w-0 flex-1">
                  <span className="block truncate text-sm font-medium">{item.jobTitle}</span>
                  <span className="block truncate text-xs text-muted-foreground">{item.company}</span>
                </span>
                {applicationId === item.id && <Check className="size-4 text-primary" />}
              </button>
            ))}
            {applications.length === 0 && <p className="text-sm text-muted-foreground">
              {t("No applications yet.", "Aucune candidature enregistrée.")}
            </p>}
          </div>
          {applicationId && selectedDetail && (
            <p className="text-xs text-muted-foreground">
              {selectedDetail.cvId && selectedDetail.job?.description?.trim()
                ? t("Resume and job posting ready.", "CV et description de poste disponibles.")
                : t("This application needs a resume and job description.", "Cette candidature nécessite un CV et une description de poste.")}
            </p>
          )}
          <label className="flex items-start gap-2 text-xs leading-relaxed">
            <input type="checkbox" className="mt-0.5 accent-primary" checked={consent}
              onChange={event => setConsent(event.target.checked)} />
            {t(
              "I agree to the voice interview and saving its text transcript and coaching report. CVComet does not store audio recordings.",
              "J'accepte l'entretien vocal ainsi que l'enregistrement de sa transcription et du rapport pédagogique. CVComet ne conserve pas l'audio.",
            )}
          </label>
          <div className="flex justify-end">
            <Button disabled={busy || !consent || !selectedDetail?.cvId || !selectedDetail?.job?.description?.trim()}
              onClick={() => void createScreening()}>
              {busy ? <LoaderCircle className="size-4 animate-spin" /> : <Mic className="size-4" />}
              {t("Start call", "Démarrer l'appel")}
            </Button>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}
