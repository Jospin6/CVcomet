"use client";

import { useCallback, useEffect, useRef, useState, type FormEvent } from "react";
import {
  Archive,
  ArrowUp,
  AudioLines,
  Copy,
  Check,
  FileClock,
  FileText,
  Menu,
  Mic,
  MicOff,
  Plus,
  ScanSearch,
  ShieldCheck,
  Sparkles,
  ThumbsDown,
  ThumbsUp,
  Volume2,
  X,
} from "lucide-react";
import Link from "next/link";
import { useTranslation } from "react-i18next";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";

type VoiceSpeed = "Lente" | "Moyenne" | "Rapide";
type VoiceMode = "dictation" | "assistant";

type SpeechEvent = {
  results: ArrayLike<ArrayLike<{ transcript: string }>>;
};
type SpeechRecognitionAdapter = {
  lang: string;
  continuous: boolean;
  interimResults: boolean;
  onresult: ((event: SpeechEvent) => void) | null;
  onerror: ((event: { error: string }) => void) | null;
  onend: (() => void) | null;
  start: () => void;
  stop: () => void;
};
type VoiceCapableWindow = Window & {
  SpeechRecognition?: new () => SpeechRecognitionAdapter;
  webkitSpeechRecognition?: new () => SpeechRecognitionAdapter;
};

type Step = { tool: string; status: "completed" };
type Message = {
  role: "user" | "assistant";
  content: string;
  steps?: Step[];
  runId?: string;
  feedbackRating?: "HELPFUL" | "NOT_HELPFUL" | null;
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
  feedbackRating: "HELPFUL" | "NOT_HELPFUL" | null;
};
type Approval = { id: string; summary: string; action: string; status: string; expiresAt: string };
type Detail = Mission & { runs: Run[]; nextRunCursor: string | null; approvals: Approval[] };
type ApiEnvelope<T> = { data?: T; error?: { code: string } };
type ApplicationContext = {
  id: string;
  company: string;
  jobTitle: string;
  status: string;
  cv: { id: string; title: string } | null;
  coverLetter: { id: string; positionTitle: string | null } | null;
  job?: { title: string } | null;
};
type DraftProposal = {
  status: "proposal" | "clarification";
  kind: "resume" | "letter";
  documentId?: string;
  proposalId?: string;
  expiresAt?: string;
  message: string;
  changes: string[];
  diff?: { field: string; before: string; after: string }[];
  preview?: unknown;
};

const labels: Record<string, string> = {
  get_my_profile: "Profil professionnel",
  list_my_resumes: "Mes CV",
  get_my_resume: "Contenu du CV",
  list_my_applications: "Mes candidatures",
  get_my_application: "Dossier de candidature",
  list_my_application_packets: "Dossiers de candidature",
  get_my_job_match_insights: "Analyse de l’offre",
};

const suggestions = {
  fr: [
    {
      label: "Analyser mes points forts",
      prompt: "Quels points forts de mon profil professionnel sont réellement documentés ?",
      icon: ShieldCheck,
    },
    {
      label: "Améliorer mon CV",
      prompt: "Quels éléments de mes CV pourraient être clarifiés à partir de mes expériences confirmées ?",
      icon: FileText,
    },
    {
      label: "Faire le point sur mes candidatures",
      prompt: "Résume l’état de mes candidatures et propose les prochaines actions sans rien envoyer.",
      icon: ScanSearch,
    },
  ],
  en: [
    {
      label: "Review my strengths",
      prompt: "Which of my professional strengths are actually supported by my confirmed experience?",
      icon: ShieldCheck,
    },
    {
      label: "Improve my resume",
      prompt: "Which parts of my resumes should be clarified based on my confirmed experience?",
      icon: FileText,
    },
    {
      label: "Review my applications",
      prompt: "Summarize my applications and suggest next steps without sending anything.",
      icon: ScanSearch,
    },
  ],
} as const;

const introduction =
  "Bonjour ! Je peux consulter vos CV, candidatures et faits professionnels confirmés. Une mission enregistrée conserve ses échanges uniquement si vous la créez volontairement. Je n’envoie ni ne modifie rien automatiquement.";

function draftTargetFromText(text: string): "resume" | "letter" | null {
  if (!/(amélior|optimis|adapt|reformul|réécri|corrig|rédig|modifi|changer|génér|improv|tailor|rewrite|update|edit|draft|write)/i.test(text)) return null;
  if (/\b(lettre de motivation|ma lettre|cover letter|application letter)\b/i.test(text)) return "letter";
  if (/\b(mon cv|le cv|curriculum vitae|my resume|my cv|the resume|the cv)\b/i.test(text)) return "resume";
  return null;
}

async function api<T>(path: string, init?: RequestInit): Promise<T> {
  const res = await fetch(path, { credentials: "same-origin", cache: "no-store", ...init });
  const body = (await res.json()) as ApiEnvelope<T>;
  if (!res.ok || !body.data) throw new Error(body.error?.code || "UNAVAILABLE");
  return body.data;
}

function savedMessages(runs: Run[]): Message[] {
  return runs.flatMap(
    (run): Message[] => [
      { role: "user", content: run.question },
      {
        role: "assistant",
        content:
          run.status === "COMPLETED" && run.answer
            ? run.answer
            : run.status === "RUNNING"
              ? "Exécution interrompue ou toujours en cours. Rechargez cette mission pour consulter son état."
              : "Cette exécution n'a pas abouti. Vous pouvez renvoyer la demande ; aucune action externe n'a été effectuée.",
        steps: run.status === "COMPLETED" ? run.steps?.filter((s) => s.status === "completed" && labels[s.tool]).slice(0, 3) : [],
        runId: run.status === "COMPLETED" ? run.id : undefined,
        feedbackRating: run.feedbackRating,
      },
    ],
  );
}

export default function CareerAgentPage() {
  const { i18n } = useTranslation();
  const language = i18n.resolvedLanguage?.startsWith("fr") ? "fr" : "en";

  const [applicationId, setApplicationId] = useState("");
  const [appContext, setAppContext] = useState<ApplicationContext | null>(null);
  const [draftKind, setDraftKind] = useState<"resume" | "letter">("resume");
  const [draftInstruction, setDraftInstruction] = useState("");
  const [draftProposal, setDraftProposal] = useState<DraftProposal | null>(null);
  const [draftBusy, setDraftBusy] = useState(false);
  const [draftReviewed, setDraftReviewed] = useState(false);
  const [draftError, setDraftError] = useState("");
  const [draftFromChat, setDraftFromChat] = useState(false);

  const questionRef = useRef<HTMLTextAreaElement>(null);
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const requestSequence = useRef(0);

  const [missions, setMissions] = useState<Mission[]>([]);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [detail, setDetail] = useState<Detail | null>(null);
  const [messages, setMessages] = useState<Message[]>([{ role: "assistant", content: introduction }]);
  const [message, setMessage] = useState("");
  const [pending, setPending] = useState(false);
  const [loading, setLoading] = useState(false);
  const [busyAction, setBusyAction] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [olderCursor, setOlderCursor] = useState<string | null>(null);
  const [loadingOlder, setLoadingOlder] = useState(false);
  const [feedbackBusy, setFeedbackBusy] = useState<string | null>(null);
  const [retry, setRetry] = useState<{ missionId: string; requestKey: string; question: string } | null>(null);

  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [showSuggestions, setShowSuggestions] = useState(false);
  const conversationScrollRef = useRef<HTMLDivElement>(null);
  const scrollRestoreRef = useRef<{ top: number; height: number } | null>(null);
  const [voiceOpen, setVoiceOpen] = useState(false);
  const voiceOpenRef = useRef(false);
  const [voiceListening, setVoiceListening] = useState(false);
  const [voiceMode, setVoiceMode] = useState<VoiceMode>("dictation");
  const [voiceSpeed, setVoiceSpeed] = useState<VoiceSpeed>("Moyenne");
  const [voiceError, setVoiceError] = useState("");
  const [voiceTranscript, setVoiceTranscript] = useState("");
  const [voiceReply, setVoiceReply] = useState("");
  const recognitionRef = useRef<SpeechRecognitionAdapter | null>(null);

  useEffect(() => {
    setApplicationId(new URLSearchParams(window.location.search).get("applicationId") || "");
  }, []);

  useEffect(() => {
    if (!applicationId) {
      setAppContext(null);
      return;
    }
    const controller = new AbortController();
    void api<ApplicationContext>(`/api/career/v1/agent/context?applicationId=${encodeURIComponent(applicationId)}`, {
      signal: controller.signal,
    })
      .then((data) => {
        if (!controller.signal.aborted) setAppContext(data);
      })
      .catch(() => {
        if (!controller.signal.aborted) setDraftError("Dossier introuvable ou accès non autorisé.");
      });
    return () => controller.abort();
  }, [applicationId]);

  useEffect(() => {
    const feed = conversationScrollRef.current;
    if (!feed) return;
    const previous = scrollRestoreRef.current;
    if (previous) {
      feed.scrollTop = previous.top + (feed.scrollHeight - previous.height);
      scrollRestoreRef.current = null;
      return;
    }
    feed.scrollTo({ top: feed.scrollHeight, behavior: "smooth" });
  }, [messages, pending, loading]);

  useEffect(() => {
    return () => {
      voiceOpenRef.current = false;
      const recognition = recognitionRef.current;
      if (recognition) {
        recognition.onend = null;
        recognition.onresult = null;
        recognition.onerror = null;
        recognition.stop();
      }
      if (typeof window !== "undefined") window.speechSynthesis?.cancel();
    };
  }, []);

  const refreshList = useCallback(async () => {
    try {
      const result = await api<{ items: Mission[] }>("/api/career/v1/missions?limit=30");
      setMissions(result.items);
    } catch {
      setError("Impossible de charger les missions. Réessayez après reconnexion.");
    }
  }, []);

  useEffect(() => {
    void refreshList();
  }, [refreshList]);

  const openMission = useCallback(async (id: string) => {
    const sequence = ++requestSequence.current;
    setSelectedId(id);
    setDetail(null);
    setLoading(true);
    setRetry(null);
    setError(null);

    try {
      const current = await api<Detail>(`/api/career/v1/missions/${id}`);
      if (requestSequence.current !== sequence) return;
      setDetail(current);
      setMessages(savedMessages(current.runs));
      setOlderCursor(current.nextRunCursor);
    } catch {
      if (requestSequence.current === sequence) {
        setError("Impossible d'ouvrir cette mission. Vérifiez votre session.");
      }
    } finally {
      if (requestSequence.current === sequence) setLoading(false);
    }
  }, []);

  function resetConversation() {
    if (pending) return;
    ++requestSequence.current;
    setSelectedId(null);
    setDetail(null);
    setRetry(null);
    setOlderCursor(null);
    setMessage("");
    setError(null);
    setMessages([{ role: "assistant", content: introduction }]);
  }

  async function createMission() {
    if (pending || busyAction) return;
    setBusyAction(true);
    setError(null);
    try {
      const mission = await api<Mission>("/api/career/v1/missions", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ apiVersion: "v1", title: "Nouvelle mission de carrière" }),
      });
      await refreshList();
      await openMission(mission.id);
    } catch {
      setError("Création impossible. Le nombre de missions peut être limité à 30.");
    } finally {
      setBusyAction(false);
    }
  }

  async function loadOlder() {
    if (!detail || !olderCursor || loadingOlder || pending) return;
    const id = detail.id;
    const sequence = requestSequence.current;
    setLoadingOlder(true);
    setError(null);
    try {
      const older = await api<{ items: Run[]; nextCursor: string | null }>(
        `/api/career/v1/missions/${id}/runs?limit=30&cursor=${encodeURIComponent(olderCursor)}`,
      );
      if (requestSequence.current !== sequence) return;
      const feed = conversationScrollRef.current;
      if (feed) {
        scrollRestoreRef.current = { top: feed.scrollTop, height: feed.scrollHeight };
      }
      setMessages((previous) => [...savedMessages(older.items), ...previous]);
      setOlderCursor(older.nextCursor);
    } catch {
      setError("Impossible de charger les échanges précédents.");
    } finally {
      setLoadingOlder(false);
    }
  }

  async function renameMission() {
    if (!detail || pending || busyAction) return;
    const title = window.prompt("Nouveau nom de la mission", detail.title)?.trim();
    if (!title || title === detail.title) return;
    if (title.length < 2 || title.length > 120) {
      setError("Le titre doit contenir entre 2 et 120 caractères.");
      return;
    }
    setBusyAction(true);
    setError(null);
    try {
      await api<Mission>(`/api/career/v1/missions/${detail.id}`, {
        method: "PATCH",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ apiVersion: "v1", action: "rename", revision: detail.revision, title }),
      });
      await openMission(detail.id);
      await refreshList();
    } catch {
      setError("Renommage impossible : la mission a peut-être changé. Actualisez-la.");
    } finally {
      setBusyAction(false);
    }
  }

  async function updateMission(action: "archive" | "restore" | "delete") {
    if (!detail || pending || busyAction) return;
    if (action === "delete" && !window.confirm("Supprimer définitivement cette mission, tous ses échanges et approbations ?")) return;
    setBusyAction(true);
    setError(null);
    try {
      if (action === "delete") {
        await api<{ deleted: boolean }>(`/api/career/v1/missions/${detail.id}`, { method: "DELETE" });
        resetConversation();
      } else {
        await api<Mission>(`/api/career/v1/missions/${detail.id}`, {
          method: "PATCH",
          headers: { "content-type": "application/json" },
          body: JSON.stringify({ apiVersion: "v1", revision: detail.revision, action }),
        });
        await openMission(detail.id);
      }
      await refreshList();
    } catch {
      setError("Action non effectuée : la mission peut être occupée ou avoir changé. Actualisez-la.");
    } finally {
      setBusyAction(false);
    }
  }

  async function decideApproval(approvalId: string, decision: "approve" | "reject") {
    if (!detail || busyAction || pending) return;
    setBusyAction(true);
    setError(null);
    try {
      await api(`/api/career/v1/missions/${detail.id}/approvals/${approvalId}`, {
        method: "PATCH",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ apiVersion: "v1", decision }),
      });
      await openMission(detail.id);
    } catch {
      setError("La décision n'a pas pu être enregistrée, ou l'approbation a expiré.");
    } finally {
      setBusyAction(false);
    }
  }

  async function rateAnswer(
    runId: string,
    current: "HELPFUL" | "NOT_HELPFUL" | null | undefined,
    rating: "HELPFUL" | "NOT_HELPFUL",
  ) {
    if (!detail || feedbackBusy || pending) return;
    const missionId = detail.id;
    setFeedbackBusy(runId);
    setError(null);
    try {
      const choice = current === rating ? "CLEAR" : rating;
      const result = await api<{ runId: string; rating: "HELPFUL" | "NOT_HELPFUL" | null }>(
        `/api/career/v1/missions/${missionId}/runs/${runId}/feedback`,
        {
          method: "POST",
          headers: { "content-type": "application/json" },
          body: JSON.stringify({ apiVersion: "v1", rating: choice }),
        },
      );
      if (selectedId === missionId) {
        setMessages((previous) =>
          previous.map((item) => (item.runId === result.runId ? { ...item, feedbackRating: result.rating } : item)),
        );
      }
    } catch {
      setError("Votre avis n'a pas été enregistré. Vérifiez votre connexion.");
    } finally {
      setFeedbackBusy(null);
    }
  }

  async function send(
    event?: FormEvent<HTMLFormElement>,
    repeated?: { missionId: string; requestKey: string; question: string },
    dictated?: string,
  ) {
    event?.preventDefault();
    const question = (dictated ?? repeated?.question ?? message).trim();
    if (pending || loading || question.length < 2 || question.length > 6000 || detail?.status === "ARCHIVED") return;
    if (repeated && repeated.missionId !== selectedId) return;

    const requestedDraft = appContext ? draftTargetFromText(question) : null;
    if (requestedDraft) {
      setDraftKind(requestedDraft);
      setDraftInstruction(question);
      setDraftProposal(null);
      setDraftReviewed(false);
      setDraftFromChat(true);
    }

    const id = selectedId;
    const requestKey = repeated?.requestKey || crypto.randomUUID();
    setError(null);
    setRetry(null);
    setMessage("");
    setPending(true);

    if (!repeated) {
      setMessages((previous) => [...previous, { role: "user", content: question }]);
    }

    try {
      if (id) {
        const run = await api<Run>(`/api/career/v1/missions/${id}/runs`, {
          method: "POST",
          headers: { "content-type": "application/json" },
          body: JSON.stringify({
            apiVersion: "v1",
            requestKey,
            message: question,
            ...(appContext ? { applicationId: appContext.id } : {}),
          }),
        });
        if (run.status !== "COMPLETED") throw new Error("MISSION_NOT_COMPLETE");
        if (voiceOpenRef.current && run.answer) speakReply(run.answer);
        await openMission(id);
        await refreshList();
      } else {
        const response = await fetch("/api/assistant", {
          method: "POST",
          credentials: "same-origin",
          headers: { "content-type": "application/json" },
          body: JSON.stringify({ message: question, ...(appContext ? { applicationId: appContext.id } : {}) }),
        });
        const result = (await response.json()) as {
          message?: string;
          error?: string;
          steps?: Step[];
        };
        const assistantMessage = result.message;
        if (!response.ok || !assistantMessage?.trim()) {
          throw new Error(result.error || "EMPTY_RESPONSE");
        }
        if (voiceOpenRef.current) speakReply(assistantMessage);
        setMessages((previous): Message[] => [
          ...previous,
          {
            role: "assistant",
            content: assistantMessage,
            steps: result.steps
              ?.filter((step) => step.status === "completed" && labels[step.tool])
              .slice(0, 3),
          },
        ]);
      }
    } catch {
      setError(
        id
          ? "Exécution non confirmée. Ouvrez de nouveau cette mission pour vérifier l'historique avant de réessayer."
          : "La réponse n'a pas abouti. Aucun document ou candidature n'a été modifié.",
      );
      if (id) setRetry({ missionId: id, requestKey, question });
      else setMessage(question);
    } finally {
      setPending(false);
    }
  }


  function stopVoiceRecognition() {
    recognitionRef.current?.stop();
    recognitionRef.current = null;
    setVoiceListening(false);
  }

  function openVoiceAssistant() {
    voiceOpenRef.current = true;
    setVoiceOpen(true);
    setVoiceError("");
    setVoiceReply("");
    setVoiceTranscript("");
    stopVoiceRecognition();
  }

  function closeVoiceAssistant() {
    voiceOpenRef.current = false;
    stopVoiceRecognition();
    window.speechSynthesis?.cancel();
    setVoiceOpen(false);
    setVoiceError("");
  }

  function speakReply(text: string) {
    if (typeof window === "undefined" || !window.speechSynthesis) {
      setVoiceError("La lecture audio n'est pas disponible dans ce navigateur.");
      return;
    }
    if (voiceOpenRef.current) setVoiceReply(text);
    window.speechSynthesis.cancel();
    const utterance = new SpeechSynthesisUtterance(text);
    utterance.lang = language === "fr" ? "fr-FR" : "en-US";
    utterance.rate = voiceSpeed === "Lente" ? 0.85 : voiceSpeed === "Rapide" ? 1.15 : 1;
    window.speechSynthesis.speak(utterance);
  }

  function startVoiceRecognition(mode: VoiceMode) {
    if (typeof window === "undefined") return;
    stopVoiceRecognition();
    setVoiceError("");
    const speechWindow = window as VoiceCapableWindow;
    const Recognition = speechWindow.SpeechRecognition || speechWindow.webkitSpeechRecognition;
    if (!Recognition) {
      setVoiceError("La reconnaissance vocale n'est pas prise en charge par ce navigateur. Utilisez la saisie texte.");
      return;
    }

    const recognition = new Recognition();
    const original = message.trim();
    let spokenText = "";
    recognition.lang = language === "fr" ? "fr-FR" : "en-US";
    recognition.continuous = false;
    recognition.interimResults = true;
    recognition.onresult = (event) => {
      const transcript = Array.from(event.results)
        .map((result) => result[0]?.transcript || "")
        .join(" ")
        .trim();
      spokenText = transcript;
      setVoiceTranscript(transcript);
      if (mode === "dictation") setMessage(original ? `${original} ${transcript}` : transcript);
    };
    recognition.onerror = (event) => {
      setVoiceError(event.error === "not-allowed"
        ? "L'accès au microphone a été refusé. Autorisez le microphone dans le navigateur."
        : `Reconnaissance vocale interrompue (${event.error}).`);
      spokenText = "";
      setVoiceListening(false);
    };
    recognition.onend = () => {
      setVoiceListening(false);
      if (recognitionRef.current === recognition) recognitionRef.current = null;
      if (mode === "assistant" && voiceOpenRef.current && spokenText.length >= 2) {
        void send(undefined, undefined, spokenText);
      }
    };
    try {
      setVoiceMode(mode);
      recognitionRef.current = recognition;
      recognition.start();
      setVoiceListening(true);
    } catch {
      recognitionRef.current = null;
      setVoiceListening(false);
      setVoiceError("Impossible d'activer le microphone pour cette session.");
    }
  }

  async function prepareDraft() {
    if (!appContext || draftInstruction.trim().length < 5 || draftBusy) return;
    setDraftBusy(true);
    setDraftError("");
    setDraftProposal(null);
    setDraftReviewed(false);
    try {
      const result = await api<DraftProposal>("/api/career/v1/agent/drafts", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          apiVersion: "v1",
          applicationId: appContext.id,
          kind: draftKind,
          instruction: draftInstruction.trim(),
          language,
        }),
      });
      setDraftProposal(result);
    } catch (e) {
      setDraftError(e instanceof Error ? e.message : "DRAFT_FAILED");
    } finally {
      setDraftBusy(false);
    }
  }

  async function decideDraft(action: "accept" | "discard") {
    if (!appContext || !draftProposal?.proposalId || (action === "accept" && !draftReviewed) || draftBusy) return;
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
      if (action === "accept") {
        setMessages((old) => [
          ...old,
          {
            role: "assistant",
            content: "Modification approuvée et enregistrée dans votre document. Vous pouvez le relire dans le studio.",
          },
        ]);
      }
    } catch (e) {
      setDraftError(e instanceof Error ? e.message : "DECISION_FAILED");
    } finally {
      setDraftBusy(false);
    }
  }

  return (
    // A fixed-height workspace: only the mission list and the message feed scroll.
    // Keep the existing semantic color tokens; the parent dashboard owns the theme.
    <div className="relative grid h-[calc(100dvh-6rem)] min-h-[420px] min-w-0 grid-cols-1 overflow-hidden border bg-background md:grid-cols-[260px_minmax(0,1fr)]">
      {sidebarOpen && (
        <button
          type="button"
          className="absolute inset-0 z-30 bg-background/75 md:hidden"
          onClick={() => setSidebarOpen(false)}
          aria-label="Fermer le panneau des missions"
        />
      )}

      <aside
        aria-label="Missions et historique"
        className={[
          "absolute inset-y-0 left-0 z-40 flex h-full min-h-0 w-[260px] flex-col border-r bg-card",
          "transition-transform duration-200 ease-out md:static md:w-auto md:translate-x-0 md:transition-none",
          sidebarOpen ? "translate-x-0" : "-translate-x-full",
        ].join(" ")}
      >
        <div className="flex shrink-0 items-center justify-between px-4 py-4">
          <div className="min-w-0">
            <p className="truncate text-sm font-semibold">Career assistant</p>
          </div>
          <Button
            type="button"
            variant="ghost"
            size="sm"
            className="md:hidden"
            onClick={() => setSidebarOpen(false)}
            aria-label="Fermer le panneau"
          >
            Fermer
          </Button>
        </div>

        <div className="shrink-0 space-y-2 p-3">
          <Button
            className="w-full justify-start rounded-md"
            onClick={() => {
              setSidebarOpen(false);
              void createMission();
            }}
            disabled={busyAction || pending}
          >
            <Plus className="size-4" aria-hidden="true" />
            Créer une mission
          </Button>
        </div>

        <nav className="min-h-0 flex-1 space-y-1 overflow-y-auto overscroll-contain px-2 py-4" aria-label="Conversations sauvegardées">
          <p className="px-2 pb-2 text-xs font-semibold uppercase tracking-wide text-muted-foreground">
            Missions
          </p>
          {missions.length === 0 && (
            <p className="px-2 py-3 text-xs text-muted-foreground">Aucune mission enregistrée.</p>
          )}
          {missions.map((mission) => (
            <button
              key={mission.id}
              type="button"
              disabled={pending}
              aria-current={selectedId === mission.id ? "page" : undefined}
              onClick={() => {
                setSidebarOpen(false);
                void openMission(mission.id);
              }}
              className={[
                "flex w-full items-center gap-2 rounded-md px-3 py-2.5 text-left text-sm",
                "transition-colors hover:bg-muted disabled:opacity-50",
                selectedId === mission.id ? "bg-muted font-medium" : "",
              ].join(" ")}
            >
              <span className="min-w-0 flex-1 truncate">{mission.title}</span>
            </button>
          ))}
        </nav>
      </aside>

      <main
        className="relative flex h-full min-h-0 min-w-0 flex-col bg-background"
        aria-label="Conversation avec CVComet Career Agent"
      >
        <div
          ref={conversationScrollRef}
          aria-live="polite"
          aria-relevant="additions text"
          aria-busy={loading || pending}
          className="min-h-0 flex-1 overflow-y-auto overscroll-contain px-4 py-5 sm:px-6"
        >
          <div className="mx-auto flex w-full max-w-3xl flex-col gap-6">
            {appContext && (
              <section className="space-y-4 rounded-md border bg-card p-4 sm:p-5" aria-label="Contexte de candidature">
                <div className="flex flex-wrap items-center justify-between gap-3">
                  <div>
                    <p className="text-[11px] font-semibold uppercase tracking-wide text-primary">Candidature en cours</p>
                    <h2 className="mt-1 text-base font-semibold">
                      {appContext.jobTitle} — {appContext.company}
                    </h2>
                    <p className="text-xs text-muted-foreground">
                      Career Agent consulte ce dossier uniquement avec votre autorisation. Les modifications restent des propositions.
                    </p>
                  </div>
                  <Button asChild variant="outline" size="sm">
                    <Link href={`/dashboard/applications/${appContext.id}?tab=documents`}>Retour au dossier</Link>
                  </Button>
                </div>

                <div className="grid gap-3 md:grid-cols-[160px_minmax(0,1fr)_auto] md:items-end">
                  <label className="grid gap-1 text-xs font-medium">
                    Document
                    <select
                      className="h-10 rounded-lg border bg-background px-2 text-sm"
                      value={draftKind}
                      onChange={(e) => {
                        setDraftKind(e.target.value as "resume" | "letter");
                        setDraftProposal(null);
                        setDraftReviewed(false);
                        setDraftFromChat(false);
                      }}
                    >
                      <option value="resume">CV adapté</option>
                      <option value="letter">Lettre</option>
                    </select>
                  </label>
                  <label className="grid gap-1 text-xs font-medium">
                    Demande à préparer (sans enregistrer de modification)
                    <Textarea
                      rows={2}
                      maxLength={4000}
                      value={draftInstruction}
                      onChange={(e) => {
                        setDraftInstruction(e.target.value);
                        setDraftProposal(null);
                        setDraftReviewed(false);
                        setDraftFromChat(false);
                      }}
                      placeholder="Ex. Reformule mon résumé pour cette offre sans ajouter de compétences non démontrées."
                    />
                  </label>
                  <Button
                    disabled={draftBusy || draftInstruction.trim().length < 5 || !(draftKind === "resume" ? appContext.cv : appContext.coverLetter)}
                    onClick={() => void prepareDraft()}
                  >
                    {draftBusy ? "Préparation…" : "Préparer une proposition"}
                  </Button>
                </div>

                {draftKind === "resume" && !appContext.cv && <p className="text-xs text-muted-foreground">Associez d'abord un CV depuis le dossier.</p>}
                {draftKind === "letter" && !appContext.coverLetter && (
                  <p className="text-xs">
                    Aucune lettre reliée. {" "}
                    <Link
                      className="text-primary underline"
                      href={`/dashboard/cover-letters?applicationId=${encodeURIComponent(appContext.id)}${appContext.cv ? `&cvId=${encodeURIComponent(appContext.cv.id)}` : ""}`}
                    >
                      Créer une lettre
                    </Link>
                  </p>
                )}
                {draftFromChat && (
                  <p role="status" className="text-xs text-muted-foreground">
                    Votre demande du chat a été reprise ici. Cliquez sur « Préparer une proposition » pour obtenir un aperçu ; aucune modification ne sera appliquée sans validation.
                  </p>
                )}
                {draftError && (
                  <p role="alert" className="text-xs text-destructive">
                    {draftError}
                  </p>
                )}
                {draftProposal && (
                  <div className="space-y-3 rounded-md border border-primary/30 p-4">
                    <h3 className="text-sm font-semibold">
                      {draftProposal.status === "proposal" ? "Proposition IA — non appliquée" : "Clarification nécessaire"}
                    </h3>
                    <p className="text-sm">{draftProposal.message}</p>
                    {draftProposal.changes.length > 0 && (
                      <ul className="list-inside list-disc text-xs text-muted-foreground">
                        {draftProposal.changes.map((change, index) => (
                          <li key={index}>{change}</li>
                        ))}
                      </ul>
                    )}
                    {draftProposal.diff?.length ? (
                      <div className="max-h-80 space-y-3 overflow-auto">
                        {draftProposal.diff.map((change, index) => (
                          <div key={index} className="rounded-lg border p-3 text-xs">
                            <p className="font-semibold">{change.field}</p>
                            <p className="mt-1 whitespace-pre-wrap text-muted-foreground">
                              <span className="font-medium">Avant : </span>
                              {change.before.slice(0, 4000) || "(vide)"}
                            </p>
                            <p className="mt-2 whitespace-pre-wrap">
                              <span className="font-medium">Proposé : </span>
                              {change.after.slice(0, 4000) || "(vide)"}
                            </p>
                          </div>
                        ))}
                      </div>
                    ) : null}
                    {draftProposal.proposalId && (
                      <>
                        <p className="text-xs text-muted-foreground">
                          Expirera le {draftProposal.expiresAt ? new Date(draftProposal.expiresAt).toLocaleString("fr-FR") : "—"}. Une approbation ne déclenche ni envoi ni candidature.
                        </p>
                        <label className="flex items-center gap-2 text-sm">
                          <input type="checkbox" checked={draftReviewed} onChange={(e) => setDraftReviewed(e.target.checked)} />
                          J'ai relu les changements et je confirme qu'ils ne contiennent aucun fait inventé.
                        </label>
                        <div className="flex gap-2">
                          <Button disabled={!draftReviewed || draftBusy} size="sm" onClick={() => void decideDraft("accept")}>
                            Approuver les changements
                          </Button>
                          <Button disabled={draftBusy} size="sm" variant="outline" onClick={() => void decideDraft("discard")}>
                            Rejeter
                          </Button>
                        </div>
                      </>
                    )}
                  </div>
                )}
              </section>
            )}

            {error && (
              <div role="alert" className="rounded-md border px-4 py-3 text-sm text-destructive">
                {error}
                {retry && retry.missionId === selectedId && (
                  <div className="mt-3 flex flex-wrap gap-2">
                    <Button variant="outline" size="sm" disabled={pending || loading} onClick={() => selectedId && void openMission(selectedId)}>
                      Vérifier l'historique
                    </Button>
                    <Button variant="outline" size="sm" disabled={pending || loading} onClick={() => void send(undefined, retry)}>
                      Réessayer avec le même identifiant
                    </Button>
                  </div>
                )}
              </div>
            )}

            {loading && <p role="status" className="text-sm text-muted-foreground">Chargement de la mission…</p>}

            {!!detail && !!olderCursor && !loading && (
              <div className="text-center">
                <Button type="button" variant="ghost" size="sm" disabled={loadingOlder || pending} onClick={() => void loadOlder()}>
                  {loadingOlder ? "Chargement…" : "Charger les anciens échanges"}
                </Button>
              </div>
            )}

            {!loading && messages.length === 0 && (
              <p className="text-sm text-muted-foreground">
                Cette mission ne contient encore aucun échange. Posez votre première question.
              </p>
            )}

            {!loading && messages.map((item, index) => (
              <div
                key={item.runId || `${item.role}-${index}`}
                className={`flex min-w-0 ${item.role === "user" ? "justify-end" : "justify-start"}`}
              >
                {item.role === "user" ? (
                  <div className="max-w-[85%] rounded-2xl bg-primary px-4 py-3 text-sm text-primary-foreground sm:max-w-[75%]">
                    <p className="whitespace-pre-wrap break-words leading-7">{item.content}</p>
                  </div>
                ) : (
                  <div className="min-w-0 w-full space-y-3 text-sm">
                    <p className="whitespace-pre-wrap break-words leading-7">{item.content}</p>
                    <div className="flex flex-wrap items-center gap-1 text-muted-foreground">
                      <Button
                        type="button"
                        variant="ghost"
                        size="icon"
                        className="size-8"
                        onClick={() => {
                          if (navigator.clipboard?.writeText) {
                            void navigator.clipboard.writeText(item.content).catch(() => {
                              setError("La copie n'est pas autorisée dans ce navigateur.");
                            });
                          } else {
                            setError("La copie n'est pas disponible dans ce navigateur.");
                          }
                        }}
                        aria-label="Copier la réponse"
                        title="Copier"
                      >
                        <Copy className="size-4" />
                      </Button>
                      <Button
                        type="button"
                        variant="ghost"
                        size="icon"
                        className="size-8"
                        onClick={() => speakReply(item.content)}
                        aria-label="Lire la réponse à voix haute"
                        title="Lire la réponse"
                      >
                        <Volume2 className="size-4" />
                      </Button>
                      {item.runId && selectedId && (
                        <>
                          <Button
                            type="button"
                            variant="ghost"
                            size="icon"
                            className="size-8"
                            disabled={feedbackBusy === item.runId || pending}
                            aria-label="Réponse utile"
                            aria-pressed={item.feedbackRating === "HELPFUL"}
                            title="Utile"
                            onClick={() => void rateAnswer(item.runId!, item.feedbackRating, "HELPFUL")}
                          >
                            <ThumbsUp className="size-4" />
                          </Button>
                          <Button
                            type="button"
                            variant="ghost"
                            size="icon"
                            className="size-8"
                            disabled={feedbackBusy === item.runId || pending}
                            aria-label="Réponse peu utile"
                            aria-pressed={item.feedbackRating === "NOT_HELPFUL"}
                            title="Peu utile"
                            onClick={() => void rateAnswer(item.runId!, item.feedbackRating, "NOT_HELPFUL")}
                          >
                            <ThumbsDown className="size-4" />
                          </Button>
                        </>
                      )}
                    </div>
                    {!!item.steps?.length && (
                      <div className="flex flex-wrap gap-2" aria-label="Outils consultés">
                        {item.steps.map((step, stepIndex) => (
                          <span
                            key={`${step.tool}-${stepIndex}`}
                            className="inline-flex items-center gap-1 rounded-md border px-2 py-1 text-xs text-muted-foreground"
                          >
                            <Check className="size-3" aria-hidden="true" />
                            {labels[step.tool]}
                          </span>
                        ))}
                      </div>
                    )}
                  </div>
                )}
              </div>
            ))}

            {!loading && !pending && (messages.length === 0 || (messages.length === 1 && messages[0].role === "assistant")) && (
              <div className="grid gap-2 sm:grid-cols-3">
                {suggestions[language].map(({ label, prompt, icon: Icon }) => (
                  <button
                    key={label}
                    type="button"
                    disabled={pending || detail?.status === "ARCHIVED"}
                    onClick={() => {
                      setMessage(prompt);
                      questionRef.current?.focus();
                    }}
                    className="flex items-center gap-2 rounded-md border px-3 py-3 text-left text-xs transition-colors hover:bg-accent disabled:opacity-50"
                  >
                    <Icon className="size-4 shrink-0 text-primary" aria-hidden="true" />
                    {label}
                  </button>
                ))}
              </div>
            )}

            {pending && (
              <div role="status" className="flex items-center gap-2 text-sm text-muted-foreground">
                <Sparkles className="size-4 animate-pulse" />
                Analyse des données autorisées…
              </div>
            )}

            {!!detail?.approvals?.length && (
              <section className="space-y-3 border-t pt-4" aria-label="Demandes d'approbation">
                <h3 className="text-sm font-semibold">Demandes d'approbation</h3>
                <p className="text-xs text-muted-foreground">
                  Une approbation enregistrée ne déclenche pas automatiquement une candidature, un email ou un paiement.
                </p>
                {detail.approvals.map((approval) => (
                  <div key={approval.id} className="flex flex-wrap items-center justify-between gap-2 border-b py-2 text-sm">
                    <span>{approval.summary} <span className="text-muted-foreground">({approval.status})</span></span>
                    {approval.status === "PENDING" && new Date(approval.expiresAt).getTime() > Date.now() && (
                      <span className="flex gap-2">
                        <Button type="button" variant="outline" size="sm" disabled={busyAction} onClick={() => void decideApproval(approval.id, "reject")}>Refuser</Button>
                        <Button type="button" size="sm" disabled={busyAction} onClick={() => void decideApproval(approval.id, "approve")}>Approuver</Button>
                      </span>
                    )}
                  </div>
                ))}
              </section>
            )}

            <div ref={messagesEndRef} aria-hidden="true" />
          </div>
        </div>

        <footer className="relative shrink-0 bg-background px-3 pb-3 pt-2 sm:px-6 sm:pb-4">
          <div className="mx-auto w-full max-w-3xl">
            {showSuggestions && (
              <div className="absolute bottom-full mb-2 w-[min(360px,85%)] rounded-md border bg-card p-2 shadow-lg">
                <p className="px-2 py-1 text-xs font-medium text-muted-foreground">Suggestions</p>
                {suggestions[language].map(({ label, prompt }) => (
                  <button
                    key={label}
                    type="button"
                    className="block w-full rounded-sm px-2 py-2 text-left text-sm hover:bg-muted"
                    onClick={() => {
                      setMessage(prompt);
                      setShowSuggestions(false);
                      questionRef.current?.focus();
                    }}
                  >
                    {label}
                  </button>
                ))}
              </div>
            )}
            <form onSubmit={send} className="flex min-h-[54px] items-end gap-2 rounded-2xl border bg-card px-2 py-1.5 shadow-sm">
              <Button
                type="button"
                variant="ghost"
                size="icon"
                className="mb-0.5 shrink-0 md:hidden"
                onClick={() => setSidebarOpen(true)}
                aria-label="Ouvrir les missions"
              >
                <Menu className="size-5" />
              </Button>
              <Button
                type="button"
                variant="ghost"
                size="icon"
                className="mb-0.5 shrink-0"
                aria-label="Afficher les suggestions"
                title="Suggestions"
                aria-expanded={showSuggestions}
                onClick={() => setShowSuggestions((open) => !open)}
              >
                <Plus className="size-5" />
              </Button>
              <label htmlFor="career-agent-question" className="sr-only">Votre question</label>
              <Textarea
                ref={questionRef}
                id="career-agent-question"
                rows={1}
                maxLength={6000}
                value={message}
                onChange={(event) => setMessage(event.target.value)}
                onKeyDown={(event) => {
                  if (
                    event.key === "Enter" &&
                    !event.shiftKey &&
                    !event.nativeEvent.isComposing
                  ) {
                    event.preventDefault();
                    event.currentTarget.form?.requestSubmit();
                  }
                }}
                disabled={pending || loading || detail?.status === "ARCHIVED"}
                placeholder={
                  detail?.status === "ARCHIVED"
                    ? "Réactivez cette mission pour continuer"
                    : "Demander à CVComet"
                }
                className="
                  max-h-36 min-h-[40px] flex-1 resize-none
                  border-0 bg-transparent px-1 py-2.5 text-sm shadow-none
                  outline-none ring-0
                  focus:border-0 focus:outline-none focus:ring-0
                  focus-visible:border-0 focus-visible:outline-none
                  focus-visible:ring-0 focus-visible:ring-offset-0
                "
              />
              <Button
                type="button"
                variant="ghost"
                size="icon"
                className="mb-0.5 shrink-0"
                aria-label={voiceListening && voiceMode === "dictation" ? "Arrêter la dictée" : "Dicter un message"}
                title="Dicter un message"
                onClick={() => voiceListening && voiceMode === "dictation" ? stopVoiceRecognition() : startVoiceRecognition("dictation")}
              >
                {voiceListening && voiceMode === "dictation" ? <MicOff className="size-4 text-primary" /> : <Mic className="size-4" />}
              </Button>
              <Button
                type="button"
                size="icon"
                className="mb-0.5 shrink-0 rounded-full"
                aria-label="Ouvrir l'assistant vocal"
                title="Assistant vocal"
                onClick={() => openVoiceAssistant()}
              >
                <AudioLines className="size-4" />
              </Button>
              {message.trim().length >= 2 && (
                <Button
                  type="submit"
                  size="icon"
                  variant="outline"
                  className="mb-0.5 shrink-0 rounded-full"
                  disabled={pending || loading || detail?.status === "ARCHIVED"}
                  aria-label="Envoyer"
                >
                  <ArrowUp className="size-4" />
                </Button>
              )}
            </form>
            {voiceError && <p role="alert" className="mt-2 text-xs text-destructive">{voiceError}</p>}
            <p className="mt-2 text-center text-[11px] text-muted-foreground">
              Les réponses de l’IA peuvent contenir des erreurs. Vérifiez-les avant de postuler.
            </p>
          </div>
        </footer>
      </main>

      {voiceOpen && (
        <div
          className="fixed inset-0 z-50 flex min-h-0 flex-col bg-background"
          role="dialog"
          aria-modal="true"
          aria-label="Assistant vocal CVComet"
        >
          <div className="flex shrink-0 items-center justify-between px-5 py-4">
            <span className="text-sm font-medium">Assistant vocal</span>
            <Button type="button" variant="ghost" size="icon" onClick={() => closeVoiceAssistant()} aria-label="Fermer l'assistant vocal">
              <X className="size-5" />
            </Button>
          </div>
          <div className="flex min-h-0 flex-1 flex-col items-center justify-center gap-6 px-5 text-center">
            <div className={`grid size-28 place-items-center rounded-full border bg-primary/20 shadow-sm ${voiceListening ? "animate-pulse" : ""}`}>
              <AudioLines className="size-10 text-primary" />
            </div>
            <p className="text-sm text-muted-foreground">
              {pending ? "CVComet prépare une réponse…" : voiceListening ? "Je vous écoute…" : "Touchez le micro pour parler"}
            </p>
            {voiceTranscript && <p className="max-w-xl text-sm">{voiceTranscript}</p>}
            {voiceReply && <p className="max-h-[28vh] max-w-xl overflow-y-auto text-sm leading-7">{voiceReply}</p>}
            {voiceError && <p role="alert" className="max-w-lg text-sm text-destructive">{voiceError}</p>}
          </div>
          <form
            onSubmit={(event) => {
              event.preventDefault();
              if (message.trim().length >= 2) void send(undefined, undefined, message);
            }}
            className="mx-auto mb-6 flex w-[calc(100%-2rem)] max-w-2xl shrink-0 items-center gap-2 rounded-2xl border bg-card p-2"
          >
            <input
              type="text"
              value={message}
              maxLength={6000}
              disabled={pending || detail?.status === "ARCHIVED"}
              onChange={(event) => setMessage(event.target.value)}
              className="min-w-0 flex-1 bg-transparent px-3 py-2 text-sm outline-none"
              placeholder="Écrivez"
              aria-label="Écrire à CVComet"
            />
            <select
              aria-label="Vitesse de lecture"
              className="max-w-[100px] bg-transparent text-xs text-muted-foreground outline-none"
              value={voiceSpeed}
              onChange={(event) => setVoiceSpeed(event.target.value as VoiceSpeed)}
            >
              <option value="Lente">Lente</option>
              <option value="Moyenne">Moyenne</option>
              <option value="Rapide">Rapide</option>
            </select>
            <Button
              type="button"
              variant="ghost"
              size="icon"
              disabled={pending || detail?.status === "ARCHIVED"}
              onClick={() => voiceListening ? stopVoiceRecognition() : startVoiceRecognition("assistant")}
              aria-label={voiceListening ? "Arrêter l'écoute" : "Démarrer l'écoute"}
            >
              {voiceListening ? <MicOff className="size-5" /> : <Mic className="size-5" />}
            </Button>
            <Button type="submit" size="icon" disabled={pending || message.trim().length < 2 || detail?.status === "ARCHIVED"} aria-label="Envoyer la question">
              <ArrowUp className="size-4" />
            </Button>
            <Button type="button" variant="outline" size="icon" onClick={() => closeVoiceAssistant()} aria-label="Quitter le mode vocal">
              <X className="size-4" />
            </Button>
          </form>
        </div>
      )}
    </div>
  );
}
