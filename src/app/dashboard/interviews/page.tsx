"use client";
import { translateCentral } from "@/lib/i18n/central-copy";

import { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import { useTranslation } from "react-i18next";
import {
  ArrowLeft, BriefcaseBusiness, Check, ClipboardList, FileText,
  LoaderCircle, Mic, MoreHorizontal, Phone, PhoneOff, Play, Plus,
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
  evidence?: Array<{ dimension: string; quote: string }>;
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
const screeningDimensionKeys = ["cvConsistency", "jobRelevance", "communication", "motivation", "experience", "professionalism"] as const;

// Match the API's 30-minute protection: a stale, unrecoverable call remains
// removable without letting an active recording be deleted prematurely.
function voiceDeletionLocked(session: Session): boolean {
  if (session.configuration?.mode !== "AI_SCREENING_VOICE" ||
      !["VOICE_ACTIVE", "VOICE_ENDING", "VOICE_EVALUATING"].includes(session.status)) return false;
  if (!session.createdAt) return true;
  const created = Date.parse(session.createdAt);
  return !Number.isFinite(created) || created > Date.now() - 30 * 60_000;
}

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
  const { i18n, t: tI18n } = useTranslation();
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

  const execute = async (task: () => Promise<void>) => {
    setBusy(true);
    setError("");
    try { await task(); }
    catch (reason) {
      const code = reason instanceof Error ? reason.message : "REQUEST_FAILED";
      setError(code === "FINISH_VOICE_CALL_FIRST"
        ? tI18n("interviews.finishVoiceCallFirst") : code);
    }
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

  // Cancel immediately, not "finish -> wait for report". Also works for calls
  // left active by a page refresh, network failure, or an old deployment.
  const endVoiceCall = (id: string) => execute(async () => {
    await jsonRequest(`/api/interviews/screening/${encodeURIComponent(id)}/end`, "POST", {
      action: "cancel",
    });
    setCurrent(null);
    setShowActions(null);
    await loadSessions();
  });

  const cancelLiveCall = (id: string, reason: "hangup" | "error" | "disconnected") => {
    // Unmount LiveKit without waiting for the network or for the AI worker.
    setConnection(null);
    setCurrent(null);
    setError(reason === "error" ? tI18n("interviews.voiceConnectionFailed")
      : reason === "disconnected" ? tI18n("interviews.voiceDisconnected") : "");
    setSessions(items => items.map(item => item.id === id
      ? { ...item, status: "VOICE_CANCELLED", report: null, overallScore: null } : item));
    void jsonRequest(`/api/interviews/screening/${encodeURIComponent(id)}/end`, "POST", {
      action: "cancel",
    }).then(() => loadSessions()).catch(() => {
      setError(tI18n("interviews.voiceEndRequestFailed"));
      void loadSessions();
    });
  };

  const finishLiveCall = async (id: string) => {
    try {
      // Server changes ACTIVE -> ENDING before disconnecting the LiveKit room.
      // Only this explicit action can result in a saved screening report.
      await jsonRequest(`/api/interviews/screening/${encodeURIComponent(id)}/end`, "POST", {
        action: "finish",
      });
    } catch {
      // If requesting the report failed, never keep an active call around.
      await jsonRequest(`/api/interviews/screening/${encodeURIComponent(id)}/end`, "POST", {
        action: "cancel",
      }).catch(() => undefined);
      setError(tI18n("interviews.voiceEndRequestFailed"));
    } finally {
      setConnection(null);
      setCurrent(null);
      void loadSessions();
    }
  };

  const createScreening = () => execute(async () => {
    const response = await jsonRequest<VoiceConnection>("/api/interviews/screening/start", "POST", {
      applicationId, language, consent,
    });
    setDialog(null);
    setCurrent(null);
    setConnection(response);
  });

  const deleteSession = (id: string) => execute(async () => {
    const saved = sessions.find(item => item.id === id);
    if (saved && voiceDeletionLocked(saved)) {
      // Don't offer a delete action that the API correctly rejects.
      setCurrent(await jsonRequest<Session>(`/api/interviews/${encodeURIComponent(id)}`));
      setShowActions(null);
      setError(tI18n("interviews.finishVoiceCallFirst"));
      return;
    }
    await jsonRequest(`/api/interviews/${encodeURIComponent(id)}`, "DELETE");
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
    if (connection) { cancelLiveCall(connection.sessionId, "hangup"); return; }
    setCurrent(null);
    setAnswer("");
    setError("");
    void loadSessions();
  };

  const header = (
    <div className="flex flex-wrap items-center justify-between gap-3">
      <h1 className="text-xl font-semibold">{translateCentral(fr ? "fr" : "en", "uiText.app_dashboard_interviews_page.text001")}</h1>
      <div className="flex items-center gap-2">
        <Button variant="outline" size="sm" onClick={() => setDialog("screening")}>
          <Phone className="size-4" /> AI Screening Call
        </Button>
        <Button size="sm" onClick={() => { setError(""); setDialog("questions"); }}>
          <Plus className="size-4" /> {translateCentral(fr ? "fr" : "en", "uiText.app_dashboard_interviews_page.text002")}
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
  const voiceCanEnd = isVoice && ["VOICE_ACTIVE", "VOICE_ENDING", "VOICE_EVALUATING"].includes(current?.status ?? "");

  return (
    <div className="mx-auto max-w-6xl space-y-5 pb-10">
      {current || connection ? (
        <div className="flex items-center gap-3">
          <Button variant="ghost" size="sm" onClick={goBack}>
            <ArrowLeft className="size-4" /> {tI18n("interviews.label001")}
          </Button>
          <span className="min-w-0 truncate text-sm font-medium">{current?.title || "AI Screening Interview"}</span>
        </div>
      ) : header}

      {error && <p role="alert" className="rounded-lg border border-destructive/25 p-3 text-sm text-destructive">{error}</p>}

      {connection ? (
        <ScreeningCall
          language={language}
          connection={connection}
          onCancel={cancelLiveCall}
          onFinish={finishLiveCall}
        />
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
                <Play className="size-4" /> {tI18n("interviews.label004")}
              </Button>
            ) : voiceCanEnd ? (
              <Button variant="destructive" disabled={busy} onClick={() => void endVoiceCall(current.id)}>
                {busy ? <LoaderCircle className="size-4 animate-spin" /> : <PhoneOff className="size-4" />}
                {tI18n("interviews.finishVoiceCall")}
              </Button>
            ) : (isActive || readyToFinish) && (
              <Button variant="outline" disabled={busy} onClick={() => void finish()}>
                {tI18n("interviews.label005")}
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
                    {tI18n("interviews.label006")}
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
                      <Volume2 className="size-4" /> {tI18n("interviews.label007")}
                    </Button>
                    <Button size="sm" disabled={!answer.trim() || busy} onClick={() => void send()}>
                      <Send className="size-4" /> {tI18n("interviews.label008")}
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
                  <p className="text-xs text-muted-foreground">{tI18n("interviews.label009")}</p>
                </div>
                <p className="max-w-xl text-sm text-muted-foreground">
                  {report.summary || tI18n("interviews.label010")}
                </p>
              </div>
              {report.kind === "AI_SCREENING" && report.dimensions && (
                <div className="grid gap-3 sm:grid-cols-2">
                  {screeningDimensionKeys.map((key) => {
                    const value = report.dimensions?.[key];
                    return (
                      <div key={key} className="space-y-2 rounded-lg border p-3">
                        <div className="flex justify-between text-sm">
                          <span>{tI18n(`interviewDimensions.${key}`)}</span>
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
                    <p className="mb-2 text-sm font-semibold">{tI18n("interviews.label011")}</p>
                    {report.strengths?.map((item, i) => <p key={i} className="mb-2 text-sm">{item}</p>)}
                  </div>
                  <div className="rounded-xl bg-red-500/10 p-4">
                    <p className="mb-2 text-sm font-semibold">{tI18n("interviews.label012")}</p>
                    {report.improvements?.map((item, i) => <p key={i} className="mb-2 text-sm">{item}</p>)}
                  </div>
                </div>
              )}
              {report.kind === "AI_SCREENING" && Array.isArray(report.evidence) && report.evidence.length > 0 && (
                <div className="space-y-2 rounded-xl border p-4">
                  <p className="text-sm font-semibold">{tI18n("interviews.label013")}</p>
                  {report.evidence.slice(0, 6).map((item, index) => (
                    <p key={index} className="text-sm text-muted-foreground">
                      <span className="font-medium">{screeningDimensionKeys.includes(item.dimension as typeof screeningDimensionKeys[number]) ? tI18n(`interviewDimensions.${item.dimension}`) : item.dimension}:</span>{" "}
                      <span className="italic">“{item.quote}”</span>
                    </p>
                  ))}
                </div>
              )}
              {report.recommendedAction && <p className="rounded-lg border p-3 text-sm">{report.recommendedAction}</p>}
              <p className="text-xs text-muted-foreground">
                {tI18n("interviews.label014")}
              </p>
            </div>
          )}
          {isVoice && ["VOICE_CANCELLED", "VOICE_UNAVAILABLE"].includes(current.status) && (
            <p role="status" className="text-sm text-muted-foreground">
              {tI18n("interviews.voiceCallCancelled")}
            </p>
          )}
          {isVoice && ["VOICE_ACTIVE", "VOICE_ENDING", "VOICE_EVALUATING"].includes(current.status) && (
            <p role="status" className="text-sm text-muted-foreground">
              {tI18n(current.status === "VOICE_ACTIVE" ? "interviews.voiceCallActive"
                : current.status === "VOICE_ENDING" ? "interviews.voiceCallEnding"
                : "interviews.voiceCallEvaluating")}
            </p>
          )}
        </div>
      ) : (
        <div className="rounded-2xl bg-muted/25 p-5 sm:p-7">
          <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-4">
            <button type="button"
              className="flex min-h-44 flex-col items-center justify-center gap-2 rounded-xl border border-dashed border-primary/55 text-sm text-primary transition hover:bg-primary/5"
              onClick={() => setDialog("questions")}
            >
              <Plus className="size-6" /> {tI18n("interviews.label016")}
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
                  {item.configuration?.mode === "AI_SCREENING_VOICE" &&
                    ["VOICE_ACTIVE", "VOICE_ENDING", "VOICE_EVALUATING"].includes(item.status) && (
                    <Button variant="outline" size="sm" disabled={busy}
                      onClick={() => void endVoiceCall(item.id)}>
                      <PhoneOff className="size-4" />
                      {tI18n("interviews.finishVoiceCall")}
                    </Button>
                  )}
                  <div className="relative">
                    <button type="button" aria-label={tI18n("interviews.label017")}
                      onClick={() => setShowActions(showActions === item.id ? null : item.id)}
                      className="rounded-md p-1 hover:bg-muted">
                      <MoreHorizontal className="size-4" />
                    </button>
                    {showActions === item.id && (
                      <div className="absolute bottom-full right-0 z-10 min-w-28 rounded-md border bg-popover p-1 shadow-lg">
                        <Button variant="ghost" size="sm" onClick={() => void deleteSession(item.id)}
                          disabled={busy || voiceDeletionLocked(item)}>
                          <Trash2 className="size-4" /> {tI18n("interviews.label018")}
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
            <DialogTitle>{tI18n("interviews.label019")}</DialogTitle>
            <DialogDescription className="sr-only">
              {tI18n("interviews.label020")}
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
              <label htmlFor="interview-role" className="text-xs font-medium">{tI18n("interviews.label021")}</label>
              <Input id="interview-role" maxLength={160} value={role}
                onChange={event => setRole(event.target.value)}
                placeholder={tI18n("interviews.label022")}
                disabled={mode === "personalized" && Boolean(applicationId)} />
            </div>
            <div className="space-y-2">
              <span className="text-xs font-medium">{tI18n("interviews.label023")}</span>
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
                  {tI18n("interviews.label024")}
                </label>
                <select id="personalized-application" value={applicationId}
                  onChange={event => {
                    setApplicationId(event.target.value);
                    if (!event.target.value) { setCvId(""); setDescription(""); }
                  }} className="h-9 w-full rounded-md border bg-background px-2 text-sm">
                  <option value="">{tI18n("interviews.label025")}</option>
                  {applications.map(item => <option key={item.id} value={item.id}>
                    {item.jobTitle} · {item.company}
                  </option>)}
                </select>
              </div>
              <p className="text-xs font-medium">{tI18n("interviews.label026")}</p>
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
                    <FileText className="mr-2 size-4" /> {tI18n("interviews.label027")}
                  </Link>
                )}
              </div>
              {!applicationId && (
                <div className="space-y-1">
                  <label htmlFor="personalized-job" className="text-xs font-medium">
                    {tI18n("interviews.label028")}
                  </label>
                  <Textarea id="personalized-job" value={description}
                    onChange={event => setDescription(event.target.value)}
                    rows={2} maxLength={12000} className="min-h-12 max-h-48 resize-y" />
                </div>
              )}
              {applicationId && selectedDetail && !selectedDetail.cvId && (
                <p className="text-xs text-destructive">{tI18n("interviews.label029")}</p>
              )}
            </div>
          )}
          <div className="flex items-center justify-between pt-2">
            <span className="text-xs text-muted-foreground">20 {tI18n("interviews.label030")}</span>
            <Button disabled={busy || role.trim().length < 2 || (mode === "personalized" && !cvId)}
              onClick={() => void prepare()}>
              {busy && <LoaderCircle className="size-4 animate-spin" />}
              {tI18n("interviews.label031")}
            </Button>
          </div>
        </DialogContent>
      </Dialog>

      <Dialog open={dialog === "screening"} onOpenChange={open => !open && setDialog(null)}>
        <DialogContent className="max-w-[480px] gap-4 p-5 sm:p-6">
          <DialogHeader>
            <DialogTitle>AI Screening Interview</DialogTitle>
            <DialogDescription>
              {tI18n("interviews.label032")}
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
              {tI18n("interviews.label033")}
            </p>}
          </div>
          {applicationId && selectedDetail && (
            <p className="text-xs text-muted-foreground">
              {selectedDetail.cvId && selectedDetail.job?.description?.trim()
                ? tI18n("interviews.label034")
                : tI18n("interviews.label035")}
            </p>
          )}
          <label className="flex items-start gap-2 text-xs leading-relaxed">
            <input type="checkbox" className="mt-0.5 accent-primary" checked={consent}
              onChange={event => setConsent(event.target.checked)} />
            {tI18n("interviews.label036")}
          </label>
          <div className="flex justify-end">
            <Button disabled={busy || !consent || !selectedDetail?.cvId || !selectedDetail?.job?.description?.trim()}
              onClick={() => void createScreening()}>
              {busy ? <LoaderCircle className="size-4 animate-spin" /> : <Mic className="size-4" />}
              {tI18n("interviews.label037")}
            </Button>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}
