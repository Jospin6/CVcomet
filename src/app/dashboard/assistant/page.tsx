"use client";

import {
  useCallback,
  useEffect,
  useRef,
  useState,
  type FormEvent,
  type KeyboardEvent,
} from "react";
import Link from "next/link";
import { useTranslation } from "react-i18next";
import { translateCentral } from "@/lib/i18n/central-copy";
import {
  ArrowUp,
  Check,
  ChevronRight,
  LoaderCircle,
  MessageSquare,
  Brain,
  PanelLeft,
  Plus,
  Paperclip, Mic, Square, Volume2, FileText, Image as ImageIcon,
  X,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import CareerMemoryPanel from "@/components/career/CareerMemoryPanel";
import CareerMissionProgress, { type MissionProgressEvent } from "@/components/career/CareerMissionProgress";

// The existing mission and agent APIs remain the source of truth.
// This page changes presentation and starts a saved chat on the first message.
type Step = { tool: string; status: "completed" };
type Message = {
  role: "user" | "assistant";
  content: string;
  steps?: Step[];
  attachments?: { name: string; kind: "image" | "document"; size: number }[];
  specialist?: string | null;
};
type Mission = {
  id: string;
  title: string;
  status: "ACTIVE" | "ARCHIVED";
  revision: number;
  busy: boolean;
  updatedAt: string;
};
type Run = {
  id: string;
  requestKey: string;
  question: string;
  answer: string | null;
  status: "COMPLETED" | "FAILED" | "RUNNING";
  steps: Step[];
  errorCode: string | null;
  attachments?: { name: string; kind: "image" | "document"; size: number }[];
  specialist?: string | null;
};
type Approval = {
  id: string;
  summary: string;
  action: string;
  status: string;
  expiresAt: string;
};
type Detail = Mission & {
  runs: Run[];
  nextRunCursor: string | null;
  approvals: Approval[];
};
type ApiEnvelope<T> = { data?: T; error?: { code: string } };

const SPECIALIST_WORKSPACES = {
  profile: { path: "/dashboard/profile" },
  resume: { path: "/dashboard/resumes" },
  cover_letter: { path: "/dashboard/cover-letters" },
  ats: { path: "/dashboard/ats" },
  job_match: { path: "/dashboard/job-match" },
  job_discovery: { path: "/dashboard/find-jobs" },
  career_map: { path: "/dashboard/career-map" },
  interview_text: { path: "/dashboard/interviews" },
  interview_voice: { path: "/dashboard/interviews" },
  application: { path: "/dashboard/application-agent" },
} as const;
type SpecialistChoice = "auto" | keyof typeof SPECIALIST_WORKSPACES;
const MAX_FILES = 3;
const MAX_FILE_SIZE = 5 * 1024 * 1024;
const MAX_UPLOAD_SIZE = 12 * 1024 * 1024;
function workspaceFor(specialist?: string | null) {
  return specialist && specialist in SPECIALIST_WORKSPACES
    ? SPECIALIST_WORKSPACES[specialist as keyof typeof SPECIALIST_WORKSPACES] : null;
}

function SelectedAttachment({ file, onRemove, disabled, french }: {
  file: File; onRemove: () => void; disabled: boolean; french: boolean;
}) {
  const [preview, setPreview] = useState<string | null>(null);
  useEffect(() => {
    if (!/^image\/(?:png|jpeg|webp)$/.test(file.type)) return;
    const url = URL.createObjectURL(file);
    setPreview(url);
    return () => URL.revokeObjectURL(url);
  }, [file]);
  return <div className="inline-flex max-w-64 items-center gap-2 rounded-xl border border-border bg-muted/50 px-2 py-1.5 text-xs">
    {preview ? <span role="img" aria-label={file.name} className="size-8 shrink-0 rounded-md bg-cover bg-center"
      style={{ backgroundImage: `url("${preview}")` }} /> : <FileText className="size-4 shrink-0" />}
    <span className="min-w-0 truncate">{file.name}</span>
    <button type="button" aria-label={`${translateCentral(french ? "fr" : "en", "assistant.removeAttachment")} ${file.name}`} disabled={disabled}
      onClick={onRemove} className="shrink-0 rounded p-0.5 hover:bg-muted">
      <X className="size-3.5" />
    </button>
  </div>;
}

type ApplicationContext = {
  id: string;
  company: string;
  jobTitle: string;
  status: string;
  cv: { id: string; title: string } | null;
  coverLetter: { id: string; positionTitle: string | null } | null;
};
type DraftProposal = {
  status: "proposal" | "clarification";
  kind: "resume" | "letter";
  proposalId?: string;
  expiresAt?: string;
  message: string;
  changes: string[];
  diff?: { field: string; before: string; after: string }[];
};

function requestedDocument(text: string): "resume" | "letter" | null {
  if (!/(amélior|optimis|adapt|reformul|réécri|corrig|rédig|modifi|génér|improv|tailor|rewrite|update|edit|draft|write)/i.test(text)) {
    return null;
  }
  if (/\b(lettre de motivation|ma lettre|cover letter|application letter)\b/i.test(text)) {
    return "letter";
  }
  if (/\b(mon cv|le cv|curriculum vitae|my resume|my cv|the resume|the cv)\b/i.test(text)) {
    return "resume";
  }
  return null;
}

async function api<T>(path: string, init?: RequestInit): Promise<T> {
  const response = await fetch(path, {
    credentials: "same-origin",
    cache: "no-store",
    ...init,
  });
  const payload = (await response.json()) as ApiEnvelope<T>;
  if (!response.ok || !payload.data) {
    throw new Error(payload.error?.code ?? "UNAVAILABLE");
  }
  return payload.data;
}

/** A mission ID in the URL is only a navigation hint; the API verifies ownership. */
function syncMissionUrl(id: string | null) {
  const url = new URL(window.location.href);
  if (id) url.searchParams.set("missionId", id);
  else url.searchParams.delete("missionId");
  window.history.replaceState(window.history.state, "", url.pathname + url.search + url.hash);
}

function toMessages(runs: Run[], language: "fr" | "en"): Message[] {
  return runs.flatMap((run): Message[] => [
    { role: "user", content: run.question, attachments: run.attachments },
    {
      role: "assistant", specialist: run.specialist,
      content:
        run.status === "COMPLETED" && run.answer
          ? run.answer
          : run.status === "RUNNING"
            ? translateCentral(language, "assistant.pendingResponse")
            : translateCentral(language, "assistant.failedResponse"),
    },
  ]);
}

export default function CareerAgentPage() {
  const { i18n, t: tI18n } = useTranslation();
  const french = i18n.resolvedLanguage?.startsWith("fr") ?? false;
  const promptRef = useRef<HTMLTextAreaElement>(null);
  const scrollRef = useRef<HTMLDivElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const recorderRef = useRef<MediaRecorder | null>(null);
  const recorderTimeout = useRef<ReturnType<typeof setTimeout> | null>(null);
  const requestSequence = useRef(0);
  const preservingOlderScroll = useRef(false);
  const [historyOpen, setHistoryOpen] = useState(false);
  const [memoryOpen, setMemoryOpen] = useState(false);
  const [missions, setMissions] = useState<Mission[]>([]);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [detail, setDetail] = useState<Detail | null>(null);
  const [messages, setMessages] = useState<Message[]>([]);
  const [message, setMessage] = useState("");
  const [files, setFiles] = useState<File[]>([]);
  const [specialistChoice, setSpecialistChoice] = useState<SpecialistChoice>("auto");
  const [recording, setRecording] = useState(false);
  const [transcribing, setTranscribing] = useState(false);
  const [voiceError, setVoiceError] = useState<string | null>(null);
  const [pending, setPending] = useState(false);
  const [tracking, setTracking] = useState<{ missionId: string; requestKey: string; active: boolean } | null>(null);
  const [progressEvents, setProgressEvents] = useState<MissionProgressEvent[]>([]);
  const [progressWarning, setProgressWarning] = useState(false);
  const lastProgressId = useRef(BigInt(0));
  const [loading, setLoading] = useState(false);
  const [creating, setCreating] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [olderCursor, setOlderCursor] = useState<string | null>(null);
  const [loadingOlder, setLoadingOlder] = useState(false);
  const [retry, setRetry] = useState<{
    missionId: string;
    requestKey: string;
    question: string;
    attachments: File[];
    specialist: SpecialistChoice;
  } | null>(null);
  const [applicationId, setApplicationId] = useState("");
  const [appContext, setAppContext] = useState<ApplicationContext | null>(null);
  const [draftKind, setDraftKind] = useState<"resume" | "letter">("resume");
  const [draftInstruction, setDraftInstruction] = useState("");
  const [draftProposal, setDraftProposal] = useState<DraftProposal | null>(null);
  const [draftBusy, setDraftBusy] = useState(false);
  const [draftReviewed, setDraftReviewed] = useState(false);
  const [draftError, setDraftError] = useState("");
  const [draftFromChat, setDraftFromChat] = useState(false);

  useEffect(() => {
    setApplicationId(new URLSearchParams(window.location.search).get("applicationId") ?? "");
  }, []);

  useEffect(() => {
    if (!applicationId) {
      setAppContext(null);
      return;
    }
    const controller = new AbortController();
    void api<ApplicationContext>(
      `/api/career/v1/agent/context?applicationId=${encodeURIComponent(applicationId)}`,
      { signal: controller.signal },
    )
      .then((data) => {
        if (!controller.signal.aborted) setAppContext(data);
      })
      .catch(() => {
        if (!controller.signal.aborted) {
          setError(tI18n("assistant.label001"));
        }
      });
    return () => controller.abort();
  }, [applicationId, french]);

  const refreshList = useCallback(async () => {
    try {
      const result = await api<{ items: Mission[] }>("/api/career/v1/missions?limit=30");
      setMissions(result.items);
    } catch {
      setError(tI18n("assistant.label002"));
    }
  }, [french]);

  useEffect(() => {
    void refreshList();
  }, [refreshList]);

  const openMission = useCallback(async (id: string) => {
    const sequence = ++requestSequence.current;
    setSelectedId(id);
    syncMissionUrl(id);
    setDetail(null);
    setLoading(true);
    setRetry(null);
    setError(null);
    setHistoryOpen(false);
    try {
      const current = await api<Detail>(`/api/career/v1/missions/${id}`);
      if (sequence !== requestSequence.current) return;
      setDetail(current);
      setMessages(toMessages(current.runs, french ? "fr" : "en"));
      setOlderCursor(current.nextRunCursor);
      setProgressEvents([]);
      setProgressWarning(false);
      lastProgressId.current = BigInt(0);
      const latest = current.runs.at(-1);
      setTracking(latest ? { missionId: id, requestKey: latest.requestKey,
        active: latest.status === "RUNNING" } : null);
    } catch {
      if (sequence === requestSequence.current) {
        setError("Impossible d'ouvrir cette conversation.");
      }
    } finally {
      if (sequence === requestSequence.current) setLoading(false);
    }
  }, []);

  useEffect(() => {
    const fromUrl = new URLSearchParams(window.location.search).get("missionId");
    if (fromUrl && /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(fromUrl)) void openMission(fromUrl);
  }, [openMission]);

  function newChat() {
    if (pending || loading || creating) return;
    ++requestSequence.current;
    setSelectedId(null);
    syncMissionUrl(null);
    setDetail(null);
    setMessages([]);
    setOlderCursor(null);
    setTracking(null);
    setProgressEvents([]);
    setProgressWarning(false);
    lastProgressId.current = BigInt(0);
    setRetry(null);
    setError(null);
    setMessage("");
    setFiles([]);
    setDraftFromChat(false);
    setDraftProposal(null);
    setDraftInstruction("");
    setHistoryOpen(false);
    promptRef.current?.focus();
  }

  async function loadOlder() {
    if (!detail || !olderCursor || loadingOlder || pending) return;
    const id = detail.id;
    const sequence = requestSequence.current;
    setLoadingOlder(true);
    setError(null);
    const container = scrollRef.current;
    const previousHeight = container?.scrollHeight ?? 0;
    try {
      const older = await api<{ items: Run[]; nextCursor: string | null }>(
        `/api/career/v1/missions/${id}/runs?limit=30&cursor=${encodeURIComponent(olderCursor)}`,
      );
      if (sequence !== requestSequence.current) return;
      preservingOlderScroll.current = true;
      setMessages((current) => [...toMessages(older.items, french ? "fr" : "en"), ...current]);
      setOlderCursor(older.nextCursor);
      requestAnimationFrame(() => {
        if (container) container.scrollTop += container.scrollHeight - previousHeight;
      });
    } catch {
      setError("Impossible de charger les messages précédents.");
    } finally {
      setLoadingOlder(false);
    }
  }

  function addFiles(selected: FileList | null) {
    if (!selected) return;
    const next = [...files, ...Array.from(selected)];
    if (next.length > MAX_FILES || next.some(file => file.size > MAX_FILE_SIZE || file.size === 0) ||
      next.reduce((sum, file) => sum + file.size, 0) > MAX_UPLOAD_SIZE) {
      setError(tI18n("assistant.label003"));
      return;
    }
    setFiles(next);
    setError(null);
    if (fileInputRef.current) fileInputRef.current.value = "";
  }

  async function toggleRecorder() {
    if (recorderRef.current?.state === "recording") {
      recorderRef.current.stop();
      return;
    }
    if (pending || transcribing || !navigator.mediaDevices?.getUserMedia || typeof MediaRecorder === "undefined") {
      setVoiceError(tI18n("assistant.label004"));
      return;
    }
    setVoiceError(null);
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      const mimeType = ["audio/webm;codecs=opus", "audio/webm", "audio/mp4", "audio/ogg;codecs=opus"]
        .find(type => MediaRecorder.isTypeSupported(type));
      if (!mimeType) { stream.getTracks().forEach(track => track.stop()); throw new Error("AUDIO_UNSUPPORTED"); }
      const chunks: Blob[] = [];
      const recorder = new MediaRecorder(stream, { mimeType });
      recorderRef.current = recorder;
      recorder.ondataavailable = event => { if (event.data.size) chunks.push(event.data); };
      recorder.onstop = () => {
        stream.getTracks().forEach(track => track.stop());
        if (recorderTimeout.current) clearTimeout(recorderTimeout.current);
        recorderRef.current = null;
        setRecording(false);
        const ext = mimeType.includes("webm") ? "webm" : mimeType.includes("ogg") ? "ogg" : "mp4";
        const audio = new File(chunks, `message.${ext}`, { type: mimeType });
        if (audio.size < 200) return;
        setTranscribing(true);
        const form = new FormData();
        form.append("audio", audio);
        form.append("language", french ? "fr" : "en");
        void api<{ text: string }>("/api/career/v1/agent/transcribe", { method: "POST", body: form })
          .then(result => setMessage(old => [old.trim(), result.text].filter(Boolean).join(" ").slice(0, 6000)))
          .catch(cause => setVoiceError(cause instanceof Error ? cause.message : "TRANSCRIPTION_UNAVAILABLE"))
          .finally(() => { setTranscribing(false); promptRef.current?.focus(); });
      };
      recorder.start(250);
      setRecording(true);
      recorderTimeout.current = setTimeout(() => {
        if (recorder.state === "recording") recorder.stop();
      }, 45_000);
    } catch {
      setVoiceError(tI18n("assistant.label005"));
    }
  }

  useEffect(() => () => {
    if (recorderTimeout.current) clearTimeout(recorderTimeout.current);
    if (recorderRef.current?.state === "recording") recorderRef.current.stop();
    if (typeof window !== "undefined" && "speechSynthesis" in window) window.speechSynthesis.cancel();
  }, []);

  function speak(text: string) {
    if (typeof window === "undefined" || !("speechSynthesis" in window)) return;
    window.speechSynthesis.cancel();
    const utterance = new SpeechSynthesisUtterance(text.slice(0, 3000));
    utterance.lang = french ? "fr-FR" : "en-US";
    window.speechSynthesis.speak(utterance);
  }

  // A new conversation is persisted automatically on its first message,
  // rather than exposing a confusing temporary-chat vs mission choice.
  async function send(
    event?: FormEvent<HTMLFormElement>,
    repeated?: { missionId: string; requestKey: string; question: string; attachments: File[]; specialist: SpecialistChoice },
  ) {
    event?.preventDefault();
    const sendingFiles = repeated?.attachments ?? files;
    const selectedSpecialist = repeated?.specialist ?? specialistChoice;
    const question = (repeated?.question ?? message).trim() || (sendingFiles.length ? (tI18n("assistant.label006")) : "");
    if (
      pending || loading || creating ||
      question.length < 2 || question.length > 6000 ||
      detail?.status === "ARCHIVED"
    ) return;
    if (repeated && repeated.missionId !== selectedId) return;

    const editKind = appContext ? requestedDocument(question) : null;
    if (editKind) {
      setDraftKind(editKind);
      setDraftInstruction(question);
      setDraftReviewed(false);
      setDraftProposal(null);
      setDraftFromChat(true);
    }

    const requestKey = repeated?.requestKey ?? crypto.randomUUID();
    let missionId = selectedId;
    setError(null);
    setRetry(null);
    setMessage("");
    setPending(true);
    if (!repeated) setMessages((old) => [...old, { role: "user", content: question,
      attachments: sendingFiles.map(file => ({ name: file.name, size: file.size,
        kind: /\.(?:png|jpe?g|webp)$/i.test(file.name) ? "image" as const : "document" as const })) }]);
    setProgressEvents([]);
    setProgressWarning(false);
    lastProgressId.current = BigInt(0);

    try {
      if (!missionId) {
        setCreating(true);
        const mission = await api<Mission>("/api/career/v1/missions", {
          method: "POST",
          headers: { "content-type": "application/json" },
          body: JSON.stringify({
            apiVersion: "v1",
            title: question.slice(0, 100),
          }),
        });
        missionId = mission.id;
        setSelectedId(mission.id);
        syncMissionUrl(mission.id);
      }
      setTracking({ missionId, requestKey, active: true });
      const body = sendingFiles.length ? new FormData() : null;
      if (body) {
        body.append("apiVersion", "v1");
        body.append("requestKey", requestKey);
        body.append("message", question);
        if (appContext) body.append("applicationId", appContext.id);
        if (selectedSpecialist !== "auto") body.append("specialist", selectedSpecialist);
        for (const file of sendingFiles) body.append("files", file);
      }
      const run = await api<Run>(`/api/career/v1/missions/${missionId}/runs`, {
        method: "POST",
        ...(body ? { body } : { headers: { "content-type": "application/json" }, body: JSON.stringify({
          apiVersion: "v1", requestKey, message: question,
          ...(appContext ? { applicationId: appContext.id } : {}),
          ...(selectedSpecialist !== "auto" ? { specialist: selectedSpecialist } : {}),
        }) }),
      });
      if (run.status !== "COMPLETED") throw new Error("MISSION_NOT_COMPLETE");
      setFiles([]);
      await openMission(missionId);
      await refreshList();
    } catch (cause) {
      const code = cause instanceof Error ? cause.message : "UNAVAILABLE";
      setError(code === "ASSISTANT_VISION_MODEL_REQUIRED" ?
        (tI18n("assistant.label007")) :
        code === "MULTIMODAL_REQUIRES_GRAPH" ?
          (tI18n("assistant.label008")) :
          code.startsWith("ASSISTANT_") ? code :
          (tI18n("assistant.label009")));
      if (missionId) setRetry({ missionId, requestKey, question, attachments: sendingFiles, specialist: selectedSpecialist });
      else { setMessage(question); setFiles(sendingFiles); }
    } finally {
      setPending(false);
      setCreating(false);
    }
  }

  async function decideApproval(id: string, decision: "approve" | "reject") {
    if (!detail || pending || draftBusy) return;
    setDraftBusy(true);
    setError(null);
    try {
      await api(`/api/career/v1/missions/${detail.id}/approvals/${id}`, {
        method: "PATCH",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ apiVersion: "v1", decision }),
      });
      await openMission(detail.id);
    } catch {
      setError("La décision n'a pas pu être enregistrée.");
    } finally {
      setDraftBusy(false);
    }
  }

  async function prepareDraft() {
    if (!appContext || draftInstruction.trim().length < 5 || draftBusy) return;
    setDraftBusy(true);
    setDraftError("");
    setDraftProposal(null);
    setDraftReviewed(false);
    try {
      const proposal = await api<DraftProposal>("/api/career/v1/agent/drafts", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          apiVersion: "v1",
          applicationId: appContext.id,
          kind: draftKind,
          instruction: draftInstruction.trim(),
          language: french ? "fr" : "en",
        }),
      });
      setDraftProposal(proposal);
    } catch (cause) {
      setDraftError(cause instanceof Error ? cause.message : "DRAFT_FAILED");
    } finally {
      setDraftBusy(false);
    }
  }

  async function decideDraft(action: "accept" | "discard") {
    if (
      !appContext || !draftProposal?.proposalId || draftBusy ||
      (action === "accept" && !draftReviewed)
    ) return;
    setDraftBusy(true);
    setDraftError("");
    try {
      await api("/api/career/v1/agent/drafts/decision", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          apiVersion: "v1",
          applicationId: appContext.id,
          kind: draftProposal.kind,
          proposalId: draftProposal.proposalId,
          action,
        }),
      });
      setDraftProposal(null);
      setDraftInstruction("");
      setDraftReviewed(false);
      setDraftFromChat(false);
      if (action === "accept") {
        setMessages((old) => [
          ...old,
          { role: "assistant", content: "Modifications approuvées et enregistrées dans votre document." },
        ]);
      }
    } catch (cause) {
      setDraftError(cause instanceof Error ? cause.message : "DECISION_FAILED");
    } finally {
      setDraftBusy(false);
    }
  }

  useEffect(() => {
    if (!scrollRef.current || loadingOlder) return;
    if (preservingOlderScroll.current) {
      preservingOlderScroll.current = false;
      return;
    }
    scrollRef.current.scrollTo({
      top: scrollRef.current.scrollHeight,
      behavior: pending ? "smooth" : "auto",
    });
  }, [messages.length, pending, loading, loadingOlder]);

  function resizeComposer() {
    const textarea = promptRef.current;
    if (!textarea) return;
    textarea.style.height = "auto";
    textarea.style.height = `${Math.min(textarea.scrollHeight, 176)}px`;
  }

  useEffect(() => {
    resizeComposer();
  }, [message]);

  function onComposerKeyDown(event: KeyboardEvent<HTMLTextAreaElement>) {
    if (
      event.key === "Enter" && !event.shiftKey &&
      !event.nativeEvent.isComposing
    ) {
      event.preventDefault();
      void send();
    }
  }

  // EventSource replays owner-scoped durable progress after reload/reconnect.
  // No tokens, prompts or tool payloads are ever streamed.
  useEffect(() => {
    if (!tracking) return;
    const source = new EventSource(
      `/api/career/v1/missions/${encodeURIComponent(tracking.missionId)}/runs/events?requestKey=${encodeURIComponent(tracking.requestKey)}`,
    );
    let stopped = false;
    let reconnects = 0;
    const receive = (event: Event) => {
      if (stopped || !(event instanceof MessageEvent)) return;
      try {
        const value = JSON.parse(event.data) as MissionProgressEvent;
        if (typeof value.kind !== "string") return;
        if (value.id && /^\d{1,24}$/.test(value.id)) {
          const next = BigInt(value.id);
          if (next <= lastProgressId.current) return;
          lastProgressId.current = next;
        }
        setProgressEvents(old => [...old.slice(-47), value]);
        if (value.kind === "mission.completed" || value.kind === "mission.failed") {
          source.close();
          setTracking(null);
          // After a page reload, rehydrate saved final answer (or a failed run).
          if (tracking.active && value.code !== "MISSION_INTERRUPTED" && !pending) {
            void openMission(tracking.missionId).then(() => refreshList());
          }
        }
      } catch { /* Invalid/partial SSE data never enters the UI. */ }
    };
    const kinds = ["mission.started", "step.started", "step.completed", "step.failed",
      "tool.started", "tool.completed", "tool.failed", "approval.required", "mission.completed", "mission.failed"];
    for (const kind of kinds) source.addEventListener(kind, receive);
    source.addEventListener("progress.error", () => {
      if (!stopped) { setProgressWarning(true); source.close(); }
    });
    source.onerror = () => {
      if (!stopped && ++reconnects > 2) {
        setProgressWarning(true);
        source.close(); // bounded reconnects after expired sessions or server failure
      }
    };
    return () => {
      stopped = true;
      source.close();
      for (const kind of kinds) source.removeEventListener(kind, receive);
    };
  }, [tracking?.missionId, tracking?.requestKey, tracking?.active]);

  const isEmpty = !loading && messages.length === 0;
  const canSend = !pending && !tracking?.active && !loading && !creating &&
    detail?.status !== "ARCHIVED" && !recording && !transcribing && (message.trim().length >= 2 || files.length > 0);
  const pendingApprovals = detail?.approvals?.filter(
    (item) => item.status === "PENDING" &&
      new Date(item.expiresAt).getTime() > Date.now(),
  ) ?? [];

  return (
    <div className="flex h-full min-h-0 min-w-0 w-full overflow-hidden bg-background">
      {/* Conversation history: a quiet rail, not a second dashboard. */}
      {historyOpen && (
        <button
          type="button"
          className="fixed inset-0 z-40 bg-black/50 lg:hidden"
          aria-label="Fermer l'historique"
          onClick={() => setHistoryOpen(false)}
        />
      )}
      <aside
        aria-label={tI18n("assistant.label010")}
        className={`
          z-50 flex w-60 shrink-0 flex-col bg-muted/25 px-2 py-3
          lg:static lg:flex
          ${historyOpen
            ? "fixed inset-y-0 left-0"
            : "hidden lg:flex"}
        `}
      >
        <div className="mb-3 flex items-center gap-2 px-1">
          <button
            type="button"
            onClick={newChat}
            disabled={pending || creating}
            className="flex h-9 flex-1 items-center gap-2 rounded-lg px-2.5 text-left text-sm font-medium transition-colors hover:bg-muted disabled:opacity-50"
          >
            <Plus className="size-4" aria-hidden="true" />
            {tI18n("assistant.label011")}
          </button>
          <button
            type="button"
            className="rounded-lg p-2 hover:bg-muted lg:hidden"
            aria-label="Fermer"
            onClick={() => setHistoryOpen(false)}
          >
            <X className="size-4" />
          </button>
        </div>
        <nav className="min-h-0 flex-1 space-y-0.5 overflow-y-auto" aria-label="Conversations">
          {missions.map((mission) => (
            <button
              key={mission.id}
              type="button"
              disabled={pending || creating}
              onClick={() => void openMission(mission.id)}
              aria-current={selectedId === mission.id ? "page" : undefined}
              title={mission.title}
              className={`
                flex w-full items-center gap-2 rounded-lg px-3 py-2.5
                text-left text-[13px] transition-colors hover:bg-muted
                disabled:opacity-50
                ${selectedId === mission.id ? "bg-muted font-medium text-foreground" : "text-muted-foreground"}
              `}
            >
              <MessageSquare className="size-3.5 shrink-0 opacity-60" aria-hidden="true" />
              <span className="min-w-0 truncate">{mission.title}</span>
            </button>
          ))}
        </nav>
      </aside>

      {/* Single conversation surface, without top/bottom panels or cards. */}
      <section
        aria-label="CVComet Career Assistant"
        className="flex min-h-0 min-w-0 flex-1 flex-col"
      >
        <div className="flex h-12 shrink-0 items-center justify-between px-4 sm:px-6">
          <div className="flex min-w-0 items-center gap-2">
            <button
              type="button"
              aria-label="Ouvrir l'historique"
              className="rounded-lg p-2 hover:bg-muted lg:hidden"
              onClick={() => setHistoryOpen(true)}
            >
              <PanelLeft className="size-5" />
            </button>
            {appContext && (
              <Link
                href={`/dashboard/applications/${appContext.id}`}
                className="flex max-w-[280px] items-center gap-1 truncate rounded-full bg-muted px-3 py-1.5 text-xs text-muted-foreground hover:text-foreground"
              >
                <span className="truncate">{appContext.jobTitle}</span>
                <ChevronRight className="size-3 shrink-0" />
              </Link>
            )}
          </div>
          <div className="flex items-center gap-1">
            <button type="button" onClick={() => setMemoryOpen(true)}
              aria-label={tI18n("assistant.label012")}
              className="flex items-center gap-1.5 rounded-lg px-2 py-2 text-xs text-muted-foreground hover:bg-muted hover:text-foreground">
              <Brain className="size-4" aria-hidden="true" />
              <span className="hidden sm:inline">{tI18n("assistant.label013")}</span>
            </button>
          <button
            type="button"
            onClick={newChat}
            disabled={pending || creating}
            aria-label={tI18n("assistant.label014")}
            className="rounded-lg p-2 text-muted-foreground transition-colors hover:bg-muted hover:text-foreground disabled:opacity-50 lg:hidden"
          >
            <Plus className="size-5" />
          </button>
          </div>
          {memoryOpen && <CareerMemoryPanel french={french} onClose={() => setMemoryOpen(false)} />}
        </div>

        <div
          ref={scrollRef}
          aria-live="polite"
          aria-busy={loading || pending}
          className="min-h-0 flex-1 overflow-y-auto overscroll-contain px-4 sm:px-6"
        >
          <div className="mx-auto flex min-h-full w-full max-w-[780px] flex-col">
            {isEmpty && (
              <div className="flex flex-1 items-center justify-center py-12">
                <h1 className="text-center text-2xl font-medium tracking-tight sm:text-[30px]">
                  {tI18n("assistant.label015")}
                </h1>
              </div>
            )}
            {loading && (
              <div className="flex justify-center py-16 text-muted-foreground">
                <LoaderCircle className="size-5 animate-spin" aria-label="Chargement" />
              </div>
            )}
            {!loading && messages.length > 0 && (
              <div className="space-y-7 pb-8 pt-6 sm:space-y-9">
                {olderCursor && (
                  <div className="text-center">
                    <button
                      type="button"
                      disabled={pending || loadingOlder}
                      onClick={() => void loadOlder()}
                      className="rounded-full px-3 py-2 text-xs text-muted-foreground hover:bg-muted"
                    >
                      {loadingOlder ? "Chargement…" : "Afficher les messages précédents"}
                    </button>
                  </div>
                )}
                {messages.map((item, index) => (
                  <div
                    key={`${index}-${item.role}`}
                    className={`flex ${item.role === "user" ? "justify-end" : "justify-start"}`}
                  >
                    {item.role === "user" ? (
                      <div className="max-w-[88%] rounded-3xl bg-muted px-4 py-2.5 text-[14px] leading-6 text-foreground sm:max-w-[78%]">
                        <p className="whitespace-pre-wrap break-words">{item.content}</p>
                        {!!item.attachments?.length && <div className="mt-2 flex flex-wrap gap-1.5">
                          {item.attachments.map((attachment, n) => <span key={`${attachment.name}-${n}`} className="inline-flex items-center gap-1 rounded-md bg-background/70 px-2 py-1 text-[11px]">
                            {attachment.kind === "image" ? <ImageIcon className="size-3" /> : <FileText className="size-3" />}
                            <span className="max-w-36 truncate">{attachment.name}</span>
                          </span>)}
                        </div>}
                      </div>
                    ) : (
                      <div className="min-w-0 max-w-full whitespace-pre-wrap break-words px-1 text-[14px] leading-7 text-foreground sm:text-[15px]">
                        {item.content}
                        <div className="mt-2 flex items-center gap-3 text-xs text-muted-foreground">
                          {workspaceFor(item.specialist) && <Link className="underline-offset-2 hover:underline" href={workspaceFor(item.specialist)!.path}>
                            {translateCentral(french ? "fr" : "en", `assistantSpecialists.${item.specialist}`)} <ChevronRight className="inline size-3" />
                          </Link>}
                          <button type="button" onClick={() => speak(item.content)} className="inline-flex items-center gap-1 hover:text-foreground"
                            aria-label={tI18n("assistant.label016")}>
                            <Volume2 className="size-3.5" /> {tI18n("assistant.label017")}
                          </button>
                        </div>
                      </div>
                    )}
                  </div>
                ))}
              </div>
            )}
            <CareerMissionProgress
              events={progressEvents}
              active={pending || Boolean(tracking?.active)}
              french={french}
              warning={progressWarning}
              onRefresh={selectedId ? () => void openMission(selectedId) : undefined}
            />

            {/* Keep explicit document approval in the conversation only when needed. */}
            {appContext && (draftFromChat || draftProposal) && (
              <div className="mb-6 space-y-3 rounded-2xl bg-muted/40 p-4">
                <p className="text-sm font-medium">
                  {tI18n("assistant.label018")}
                </p>
                {!draftProposal && (
                  <div className="space-y-3">
                    <label className="block text-xs text-muted-foreground">
                      {draftKind === "resume" ? "CV" : "Lettre de motivation"}
                      <textarea
                        value={draftInstruction}
                        onChange={(event) => setDraftInstruction(event.target.value)}
                        rows={2}
                        maxLength={4000}
                        className="mt-2 w-full resize-y rounded-xl bg-background px-3 py-2.5 text-sm outline-none focus-visible:ring-2 focus-visible:ring-ring"
                      />
                    </label>
                    <div className="flex flex-wrap gap-2">
                      <Button
                        size="sm"
                        disabled={draftBusy || draftInstruction.trim().length < 5 ||
                          !(draftKind === "resume" ? appContext.cv : appContext.coverLetter)}
                        onClick={() => void prepareDraft()}
                      >
                        {draftBusy ? "Préparation…" : "Voir la proposition"}
                      </Button>
                      <Button
                        size="sm"
                        variant="ghost"
                        onClick={() => setDraftFromChat(false)}
                      >
                        Annuler
                      </Button>
                      {draftKind === "resume" && !appContext.cv && (
                        <Button asChild size="sm" variant="outline">
                          <Link href={`/dashboard/applications/${encodeURIComponent(appContext.id)}?tab=documents`}>
                            Associer un CV
                          </Link>
                        </Button>
                      )}
                      {draftKind === "letter" && !appContext.coverLetter && (
                        <Button asChild size="sm" variant="outline">
                          <Link href={`/dashboard/cover-letters?applicationId=${encodeURIComponent(appContext.id)}`}>
                            Créer une lettre
                          </Link>
                        </Button>
                      )}
                    </div>
                  </div>
                )}
                {draftProposal && (
                  <div className="space-y-3 text-sm">
                    <p>{draftProposal.message}</p>
                    {draftProposal.diff?.map((change, index) => (
                      <div key={index} className="space-y-2">
                        <p className="text-xs font-medium">{change.field}</p>
                        <p className="whitespace-pre-wrap rounded-lg bg-red-500/10 p-3 text-xs">{change.before || "(vide)"}</p>
                        <p className="whitespace-pre-wrap rounded-lg bg-emerald-500/10 p-3 text-xs">{change.after || "(vide)"}</p>
                      </div>
                    ))}
                    {!draftProposal.proposalId && (
                      <Button size="sm" variant="ghost" onClick={() => setDraftProposal(null)}>
                        Modifier ma demande
                      </Button>
                    )}
                    {draftProposal.proposalId && (
                      <>
                        <label className="flex items-start gap-2 text-xs">
                          <input
                            type="checkbox"
                            checked={draftReviewed}
                            onChange={(event) => setDraftReviewed(event.target.checked)}
                            className="mt-0.5"
                          />
                          J'ai relu les changements et vérifié qu'aucun fait n'est inventé.
                        </label>
                        <div className="flex flex-wrap gap-2">
                          <Button size="sm" disabled={!draftReviewed || draftBusy} onClick={() => void decideDraft("accept")}>
                            Approuver
                          </Button>
                          <Button size="sm" variant="outline" disabled={draftBusy} onClick={() => void decideDraft("discard")}>
                            Refuser
                          </Button>
                        </div>
                      </>
                    )}
                  </div>
                )}
                {draftError && <p role="alert" className="text-xs text-destructive">{draftError}</p>}
              </div>
            )}
            {pendingApprovals.length > 0 && (
              <div className="mb-6 space-y-3 rounded-2xl bg-muted/40 p-4">
                {pendingApprovals.map((item) => (
                  <div key={item.id} className="flex flex-wrap items-center justify-between gap-3 text-sm">
                    <span>{item.summary}</span>
                    <span className="flex gap-2">
                      <Button size="sm" variant="outline" disabled={draftBusy || pending} onClick={() => void decideApproval(item.id, "reject")}>Refuser</Button>
                      <Button size="sm" disabled={draftBusy || pending} onClick={() => void decideApproval(item.id, "approve")}>
                        <Check className="size-4" /> Approuver
                      </Button>
                    </span>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>

        {/* Composer stays anchored inside the viewport; the messages scroll independently. */}
        <div className="shrink-0 px-3 pb-3 pt-2 sm:px-6 sm:pb-5">
          <div className="mx-auto w-full max-w-[780px]">
            {error && (
              <div role="alert" className="mb-2 rounded-xl bg-destructive/10 px-3 py-2 text-xs text-destructive">
                {error}
                {retry && retry.missionId === selectedId && (
                  <span className="ml-2 inline-flex gap-2">
                    <button type="button" className="underline" disabled={pending} onClick={() => void openMission(retry.missionId)}>
                      Vérifier
                    </button>
                    <button type="button" className="underline" disabled={pending} onClick={() => void send(undefined, retry)}>
                      Réessayer
                    </button>
                  </span>
                )}
              </div>
            )}
            <div className="mb-2 flex items-center gap-2 text-xs text-muted-foreground">
              <label htmlFor="career-specialist" className="sr-only">{tI18n("assistant.label019")}</label>
              <select id="career-specialist" value={specialistChoice}
                onChange={e => setSpecialistChoice(e.target.value as SpecialistChoice)}
                disabled={pending || tracking?.active}
                className="max-w-48 truncate rounded-lg border border-border/70 bg-background px-2.5 py-1.5 outline-none focus-visible:ring-2 focus-visible:ring-ring">
                <option value="auto">{tI18n("assistant.label020")}</option>
                {Object.entries(SPECIALIST_WORKSPACES).map(([id, workspace]) =>
                  <option key={id} value={id}>{translateCentral(french ? "fr" : "en", `assistantSpecialists.${id}`)}</option>)}
              </select>
              {workspaceFor(specialistChoice) && <Link href={workspaceFor(specialistChoice)!.path}
                className="inline-flex items-center gap-0.5 hover:underline">
                {tI18n("assistant.label021")} <ChevronRight className="size-3" />
              </Link>}
            </div>
            {files.length > 0 && <div aria-label="Fichiers à envoyer" className="mb-2 flex flex-wrap gap-2">
              {files.map((file, index) => <SelectedAttachment key={`${file.name}-${index}`} file={file}
                disabled={pending} french={french} onRemove={() => setFiles(current => current.filter((_, i) => i !== index))} />)}
            </div>}
            {voiceError && <p className="mb-2 text-xs text-destructive" role="alert">{voiceError}</p>}
            <form
              onSubmit={(event) => { void send(event); }}
              className="rounded-[24px] border border-border/80 bg-card px-3 py-3 shadow-sm focus-within:border-ring/50 sm:px-4"
            >
              <label htmlFor="career-assistant-message" className="sr-only">
                {tI18n("assistant.label022")}
              </label>
              <textarea
                ref={promptRef}
                id="career-assistant-message"
                rows={1}
                value={message}
                onChange={(event) => setMessage(event.target.value)}
                onKeyDown={onComposerKeyDown}
                disabled={pending || tracking?.active || loading || creating || detail?.status === "ARCHIVED"}
                maxLength={6000}
                placeholder={tI18n("assistant.label023")}
                className="block min-h-[28px] w-full resize-none overflow-y-auto bg-transparent text-sm leading-6 text-foreground outline-none placeholder:text-muted-foreground disabled:opacity-50 sm:text-[15px]"
              />
              <div className="mt-2 flex items-center justify-between gap-2">
                <div className="flex items-center gap-1">
                  <input ref={fileInputRef} type="file" multiple className="sr-only"
                    accept=".png,.jpg,.jpeg,.webp,.pdf,.docx,.txt,image/png,image/jpeg,image/webp,application/pdf"
                    onChange={event => addFiles(event.target.files)} aria-label={tI18n("assistant.label024")}/>
                  <button type="button" disabled={pending || files.length >= MAX_FILES}
                    onClick={() => fileInputRef.current?.click()} title={tI18n("assistant.label025")}
                    aria-label={tI18n("assistant.label026")} className="rounded-lg p-2 text-muted-foreground hover:bg-muted hover:text-foreground disabled:opacity-40">
                    <Paperclip className="size-4" />
                  </button>
                  <button type="button" disabled={pending || transcribing}
                    onClick={() => void toggleRecorder()}
                    title={recording ? (tI18n("assistant.label027")) : (tI18n("assistant.label028"))}
                    aria-label={recording ? "Arrêter" : "Microphone"}
                    className={`rounded-lg p-2 ${recording ? "bg-destructive/10 text-destructive" : "text-muted-foreground hover:bg-muted hover:text-foreground"} disabled:opacity-40`}>
                    {transcribing ? <LoaderCircle className="size-4 animate-spin" /> : recording ? <Square className="size-4" /> : <Mic className="size-4" />}
                  </button>
                  {recording && <span className="text-xs text-destructive">{tI18n("assistant.label029")}</span>}
                </div>
                <button
                  type="submit"
                  disabled={!canSend}
                  aria-label={tI18n("assistant.label030")}
                  className="flex size-8 items-center justify-center rounded-full bg-primary text-primary-foreground transition-opacity hover:opacity-90 disabled:cursor-not-allowed disabled:opacity-40"
                >
                  {pending ? <LoaderCircle className="size-4 animate-spin" /> : <ArrowUp className="size-4" />}
                </button>
              </div>
            </form>
          </div>
        </div>
      </section>
    </div>
  );
}
