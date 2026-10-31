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
import {
  ArrowUp,
  Check,
  ChevronRight,
  LoaderCircle,
  MessageSquare,
  PanelLeft,
  Plus,
  X,
} from "lucide-react";
import { Button } from "@/components/ui/button";

// The existing mission and agent APIs remain the source of truth.
// This page changes presentation and starts a saved chat on the first message.
type Step = { tool: string; status: "completed" };
type Message = {
  role: "user" | "assistant";
  content: string;
  steps?: Step[];
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

function toMessages(runs: Run[]): Message[] {
  return runs.flatMap((run): Message[] => [
    { role: "user", content: run.question },
    {
      role: "assistant",
      content:
        run.status === "COMPLETED" && run.answer
          ? run.answer
          : run.status === "RUNNING"
            ? "La réponse est encore en cours. Rechargez cette discussion."
            : "Cette réponse n'a pas abouti. Vous pouvez réessayer.",
    },
  ]);
}

export default function CareerAgentPage() {
  const { i18n } = useTranslation();
  const french = i18n.resolvedLanguage?.startsWith("fr") ?? false;
  const promptRef = useRef<HTMLTextAreaElement>(null);
  const scrollRef = useRef<HTMLDivElement>(null);
  const requestSequence = useRef(0);
  const preservingOlderScroll = useRef(false);
  const [historyOpen, setHistoryOpen] = useState(false);
  const [missions, setMissions] = useState<Mission[]>([]);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [detail, setDetail] = useState<Detail | null>(null);
  const [messages, setMessages] = useState<Message[]>([]);
  const [message, setMessage] = useState("");
  const [pending, setPending] = useState(false);
  const [loading, setLoading] = useState(false);
  const [creating, setCreating] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [olderCursor, setOlderCursor] = useState<string | null>(null);
  const [loadingOlder, setLoadingOlder] = useState(false);
  const [retry, setRetry] = useState<{
    missionId: string;
    requestKey: string;
    question: string;
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
          setError(french ? "Impossible d'ouvrir cette candidature." : "Unable to load this application.");
        }
      });
    return () => controller.abort();
  }, [applicationId, french]);

  const refreshList = useCallback(async () => {
    try {
      const result = await api<{ items: Mission[] }>("/api/career/v1/missions?limit=30");
      setMissions(result.items);
    } catch {
      setError(french ? "Impossible de charger les conversations." : "Unable to load conversations.");
    }
  }, [french]);

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
    setHistoryOpen(false);
    try {
      const current = await api<Detail>(`/api/career/v1/missions/${id}`);
      if (sequence !== requestSequence.current) return;
      setDetail(current);
      setMessages(toMessages(current.runs));
      setOlderCursor(current.nextRunCursor);
    } catch {
      if (sequence === requestSequence.current) {
        setError("Impossible d'ouvrir cette conversation.");
      }
    } finally {
      if (sequence === requestSequence.current) setLoading(false);
    }
  }, []);

  function newChat() {
    if (pending || loading || creating) return;
    ++requestSequence.current;
    setSelectedId(null);
    setDetail(null);
    setMessages([]);
    setOlderCursor(null);
    setRetry(null);
    setError(null);
    setMessage("");
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
      setMessages((current) => [...toMessages(older.items), ...current]);
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

  // A new conversation is persisted automatically on its first message,
  // rather than exposing a confusing temporary-chat vs mission choice.
  async function send(
    event?: FormEvent<HTMLFormElement>,
    repeated?: { missionId: string; requestKey: string; question: string },
  ) {
    event?.preventDefault();
    const question = (repeated?.question ?? message).trim();
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
    if (!repeated) setMessages((old) => [...old, { role: "user", content: question }]);

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
      }
      const run = await api<Run>(`/api/career/v1/missions/${missionId}/runs`, {
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
      await openMission(missionId);
      await refreshList();
    } catch {
      setError(
        "La réponse n'a pas abouti. Vérifiez la conversation avant de réessayer.",
      );
      if (missionId) setRetry({ missionId, requestKey, question });
      else setMessage(question);
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

  const isEmpty = !loading && messages.length === 0;
  const canSend = !pending && !loading && !creating &&
    detail?.status !== "ARCHIVED" && message.trim().length >= 2;
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
        aria-label={french ? "Historique des discussions" : "Conversation history"}
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
            {french ? "Nouvelle discussion" : "New chat"}
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
          <button
            type="button"
            onClick={newChat}
            disabled={pending || creating}
            aria-label={french ? "Nouvelle discussion" : "New chat"}
            className="rounded-lg p-2 text-muted-foreground transition-colors hover:bg-muted hover:text-foreground disabled:opacity-50 lg:hidden"
          >
            <Plus className="size-5" />
          </button>
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
                  {french ? "Comment puis-je vous aider ?" : "How can I help you?"}
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
                      </div>
                    ) : (
                      <div className="min-w-0 max-w-full whitespace-pre-wrap break-words px-1 text-[14px] leading-7 text-foreground sm:text-[15px]">
                        {item.content}
                      </div>
                    )}
                  </div>
                ))}
              </div>
            )}
            {pending && (
              <div role="status" className="flex items-center gap-2 pb-5 text-sm text-muted-foreground">
                <span className="size-2 animate-pulse rounded-full bg-primary" />
                {french ? "CVComet réfléchit…" : "CVComet is thinking…"}
              </div>
            )}

            {/* Keep explicit document approval in the conversation only when needed. */}
            {appContext && (draftFromChat || draftProposal) && (
              <div className="mb-6 space-y-3 rounded-2xl bg-muted/40 p-4">
                <p className="text-sm font-medium">
                  {french ? "Modification à vérifier" : "Review document changes"}
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
            <form
              onSubmit={(event) => { void send(event); }}
              className="rounded-[24px] border border-border/80 bg-card px-3 py-3 shadow-sm focus-within:border-ring/50 sm:px-4"
            >
              <label htmlFor="career-assistant-message" className="sr-only">
                {french ? "Votre message" : "Your message"}
              </label>
              <textarea
                ref={promptRef}
                id="career-assistant-message"
                rows={1}
                value={message}
                onChange={(event) => setMessage(event.target.value)}
                onKeyDown={onComposerKeyDown}
                disabled={pending || loading || creating || detail?.status === "ARCHIVED"}
                maxLength={6000}
                placeholder={french ? "Écrire à CVComet…" : "Message CVComet…"}
                className="block min-h-[28px] w-full resize-none overflow-y-auto bg-transparent text-sm leading-6 text-foreground outline-none placeholder:text-muted-foreground disabled:opacity-50 sm:text-[15px]"
              />
              <div className="mt-2 flex items-center justify-end">
                <button
                  type="submit"
                  disabled={!canSend}
                  aria-label={french ? "Envoyer" : "Send"}
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
