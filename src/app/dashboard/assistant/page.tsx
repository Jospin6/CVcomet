"use client";

import { useCallback, useEffect, useRef, useState, type FormEvent } from "react";
import { Archive, ArrowUp, ArrowUpRight, BrainCircuit, Check, FileClock, FileText, LockKeyhole, Pencil, Plus, RotateCcw, ScanSearch, ShieldCheck, Sparkles, ThumbsDown, ThumbsUp, Trash2 } from "lucide-react";
import Link from "next/link";
import { useTranslation } from "react-i18next";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";

type Step = { tool: string; status: "completed" };
type Message = { role: "user" | "assistant"; content: string; steps?: Step[]; runId?: string; feedbackRating?: "HELPFUL" | "NOT_HELPFUL" | null };
type Mission = { id: string; title: string; status: "ACTIVE" | "ARCHIVED"; revision: number; busy: boolean; updatedAt: string };
type Run = { id: string; requestKey: string; question: string; answer: string | null; status: "COMPLETED" | "FAILED" | "RUNNING"; steps: Step[]; errorCode: string | null; feedbackRating: "HELPFUL" | "NOT_HELPFUL" | null };
type Approval = { id: string; summary: string; action: string; status: string; expiresAt: string };
type Detail = Mission & { runs: Run[]; nextRunCursor: string | null; approvals: Approval[] };
type ApiEnvelope<T> = { data?: T; error?: { code: string } };
type ApplicationContext = { id: string; company: string; jobTitle: string; status: string; cv: { id: string; title: string } | null; coverLetter: { id: string; positionTitle: string | null } | null; job?: { title: string } | null };
type DraftProposal = { status: "proposal" | "clarification"; kind: "resume" | "letter"; documentId?: string; proposalId?: string; expiresAt?: string; message: string; changes: string[]; diff?: { field: string; before: string; after: string }[]; preview?: unknown };


const labels: Record<string, string> = {
  get_my_profile: "Profil professionnel", list_my_resumes: "Mes CV", get_my_resume: "Contenu du CV",
  list_my_applications: "Mes candidatures", get_my_application: "Dossier de candidature",   list_my_application_packets: "Dossiers de candidature", get_my_job_match_insights: "Analyse de l’offre",
};
const suggestions = {
  fr: [
    { label: "Analyser mes points forts", prompt: "Quels points forts de mon profil professionnel sont réellement documentés ?", icon: ShieldCheck },
    { label: "Améliorer mon CV", prompt: "Quels éléments de mes CV pourraient être clarifiés à partir de mes expériences confirmées ?", icon: FileText },
    { label: "Faire le point sur mes candidatures", prompt: "Résume l’état de mes candidatures et propose les prochaines actions sans rien envoyer.", icon: ScanSearch },
  ],
  en: [
    { label: "Review my strengths", prompt: "Which of my professional strengths are actually supported by my confirmed experience?", icon: ShieldCheck },
    { label: "Improve my resume", prompt: "Which parts of my resumes should be clarified based on my confirmed experience?", icon: FileText },
    { label: "Review my applications", prompt: "Summarize my applications and suggest next steps without sending anything.", icon: ScanSearch },
  ],
} as const;
const introduction = "Bonjour ! Je peux consulter vos CV, candidatures et faits professionnels confirmés. Une mission enregistrée conserve ses échanges uniquement si vous la créez volontairement. Je n’envoie ni ne modifie rien automatiquement.";
/** The chat can prepare an explicit editing request, but never autonomously apply an edit. */
function draftTargetFromText(text: string): "resume" | "letter" | null {
  if (!/(amélior|optimis|adapt|reformul|réécri|corrig|rédig|modifi|changer|génér|improv|tailor|rewrite|update|edit|draft|write)/i.test(text)) return null;
  if (/\b(lettre de motivation|ma lettre|cover letter|application letter)\b/i.test(text)) return "letter";
  if (/\b(mon cv|le cv|curriculum vitae|my resume|my cv|the resume|the cv)\b/i.test(text)) return "resume";
  return null;
}

async function api<T>(path: string, init?: RequestInit): Promise<T> {
  const res = await fetch(path, { credentials: "same-origin", cache: "no-store", ...init });
  const body = await res.json() as ApiEnvelope<T>;
  if (!res.ok || !body.data) throw new Error(body.error?.code || "UNAVAILABLE");
  return body.data;
}
function savedMessages(runs: Run[]): Message[] {
  return runs.flatMap((run): Message[] => [
    { role: "user", content: run.question },
    { role: "assistant", content: run.status === "COMPLETED" && run.answer ? run.answer :
      run.status === "RUNNING" ? "Exécution interrompue ou toujours en cours. Rechargez cette mission pour consulter son état." :
        "Cette exécution n'a pas abouti. Vous pouvez renvoyer la demande ; aucune action externe n'a été effectuée.",
      steps: run.status === "COMPLETED" ? run.steps?.filter(s => s.status === "completed" && labels[s.tool]).slice(0, 3) : [],
      runId: run.status === "COMPLETED" ? run.id : undefined, feedbackRating: run.feedbackRating },
  ]);
}

export default function CareerAgentPage() {
  const { i18n } = useTranslation();
  const [applicationId, setApplicationId] = useState("");
  const [appContext, setAppContext] = useState<ApplicationContext | null>(null);
  const [draftKind, setDraftKind] = useState<"resume" | "letter">("resume");
  const [draftInstruction, setDraftInstruction] = useState("");
  const [draftProposal, setDraftProposal] = useState<DraftProposal | null>(null);
  const [draftBusy, setDraftBusy] = useState(false);
  const [draftReviewed, setDraftReviewed] = useState(false);
  const [draftError, setDraftError] = useState("");
  const [draftFromChat, setDraftFromChat] = useState(false);
  useEffect(() => { setApplicationId(new URLSearchParams(window.location.search).get("applicationId") || ""); }, []);
  useEffect(() => {
    if (!applicationId) { setAppContext(null); return; }
    const controller = new AbortController();
    void api<ApplicationContext>(`/api/career/v1/agent/context?applicationId=${encodeURIComponent(applicationId)}`, { signal: controller.signal })
      .then(data => { if (!controller.signal.aborted) setAppContext(data); })
      .catch(() => { if (!controller.signal.aborted) setDraftError("Dossier introuvable ou accès non autorisé."); });
    return () => controller.abort();
  }, [applicationId]);
  const language = i18n.resolvedLanguage?.startsWith("fr") ? "fr" : "en";
  const questionRef = useRef<HTMLTextAreaElement>(null);
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
  const requestSequence = useRef(0);

  const refreshList = useCallback(async () => {
    try {
      const result = await api<{ items: Mission[] }>("/api/career/v1/missions?limit=30");
      setMissions(result.items);
    } catch { setError("Impossible de charger les missions. Réessayez après reconnexion."); }
  }, []);
  useEffect(() => { void refreshList(); }, [refreshList]);

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
      if (requestSequence.current === sequence) setError("Impossible d'ouvrir cette mission. Vérifiez votre session.");
    } finally { if (requestSequence.current === sequence) setLoading(false); }
  }, []);

  function temporaryChat() {
    if (pending) return;
    ++requestSequence.current;
    setSelectedId(null); setDetail(null); setRetry(null); setOlderCursor(null); setMessage(""); setError(null);
    setMessages([{ role: "assistant", content: introduction }]);
  }

  async function createMission() {
    if (pending || busyAction) return;
    setBusyAction(true); setError(null);
    try {
      const mission = await api<Mission>("/api/career/v1/missions", {
        method: "POST", headers: { "content-type": "application/json" },
        body: JSON.stringify({ apiVersion: "v1", title: "Nouvelle mission de carrière" }),
      });
      await refreshList();
      await openMission(mission.id);
    } catch { setError("Création impossible. Le nombre de missions peut être limité à 30."); }
    finally { setBusyAction(false); }
  }

  async function loadOlder() {
    if (!detail || !olderCursor || loadingOlder || pending) return;
    const id = detail.id;
    const sequence = requestSequence.current;
    setLoadingOlder(true); setError(null);
    try {
      const older = await api<{ items: Run[]; nextCursor: string | null }>(
        `/api/career/v1/missions/${id}/runs?limit=30&cursor=${encodeURIComponent(olderCursor)}`);
      if (requestSequence.current !== sequence) return;
      setMessages(previous => [...savedMessages(older.items), ...previous]);
      setOlderCursor(older.nextCursor);
    } catch { setError("Impossible de charger les échanges précédents."); }
    finally { setLoadingOlder(false); }
  }

  async function renameMission() {
    if (!detail || pending || busyAction) return;
    const title = window.prompt("Nouveau nom de la mission", detail.title)?.trim();
    if (!title || title === detail.title) return;
    if (title.length < 2 || title.length > 120) { setError("Le titre doit contenir entre 2 et 120 caractères."); return; }
    setBusyAction(true); setError(null);
    try {
      await api<Mission>(`/api/career/v1/missions/${detail.id}`, { method: "PATCH", headers: { "content-type": "application/json" },
        body: JSON.stringify({ apiVersion: "v1", action: "rename", revision: detail.revision, title }) });
      await openMission(detail.id); await refreshList();
    } catch { setError("Renommage impossible : la mission a peut-être changé. Actualisez-la."); }
    finally { setBusyAction(false); }
  }

  async function updateMission(action: "archive" | "restore" | "delete") {
    if (!detail || pending || busyAction) return;
    if (action === "delete" && !window.confirm("Supprimer définitivement cette mission, tous ses échanges et approbations ?")) return;
    setBusyAction(true); setError(null);
    try {
      if (action === "delete") {
        await api<{ deleted: boolean }>(`/api/career/v1/missions/${detail.id}`, { method: "DELETE" });
        temporaryChat();
      } else {
        await api<Mission>(`/api/career/v1/missions/${detail.id}`, { method: "PATCH", headers: { "content-type": "application/json" },
          body: JSON.stringify({ apiVersion: "v1", revision: detail.revision, action }) });
        await openMission(detail.id);
      }
      await refreshList();
    } catch { setError("Action non effectuée : la mission peut être occupée ou avoir changé. Actualisez-la."); }
    finally { setBusyAction(false); }
  }

  async function decideApproval(approvalId: string, decision: "approve" | "reject") {
    if (!detail || busyAction || pending) return;
    setBusyAction(true); setError(null);
    try {
      await api(`/api/career/v1/missions/${detail.id}/approvals/${approvalId}`, { method: "PATCH",
        headers: { "content-type": "application/json" }, body: JSON.stringify({ apiVersion: "v1", decision }) });
      await openMission(detail.id);
    } catch { setError("La décision n'a pas pu être enregistrée, ou l'approbation a expiré."); }
    finally { setBusyAction(false); }
  }

  async function rateAnswer(runId: string, current: "HELPFUL" | "NOT_HELPFUL" | null | undefined, rating: "HELPFUL" | "NOT_HELPFUL") {
    if (!detail || feedbackBusy || pending) return;
    const missionId = detail.id;
    setFeedbackBusy(runId);
    setError(null);
    try {
      const choice = current === rating ? "CLEAR" : rating;
      const result = await api<{ runId: string; rating: "HELPFUL" | "NOT_HELPFUL" | null }>(
        `/api/career/v1/missions/${missionId}/runs/${runId}/feedback`, {
          method: "POST", headers: { "content-type": "application/json" },
          body: JSON.stringify({ apiVersion: "v1", rating: choice }),
        });
      if (selectedId === missionId) setMessages(previous => previous.map(item => item.runId === result.runId
        ? { ...item, feedbackRating: result.rating } : item));
    } catch { setError("Votre avis n'a pas été enregistré. Vérifiez votre connexion."); }
    finally { setFeedbackBusy(null); }
  }

  async function send(event?: FormEvent<HTMLFormElement>, repeated?: { missionId: string; requestKey: string; question: string }) {
    event?.preventDefault();
    const question = (repeated?.question ?? message).trim();
    if (pending || loading || question.length < 2 || question.length > 6000 || (detail?.status === "ARCHIVED")) return;
    if (repeated && repeated.missionId !== selectedId) return;
    // Copy an explicit document-edit request from the conversation into the separate review workflow.
    // This only fills the form: no AI document edit, acceptance or external action happens here.
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
    setError(null); setRetry(null); setMessage(""); setPending(true);
    if (!repeated) setMessages(previous => [...previous, { role: "user", content: question }]);
    try {
      if (id) {
        const run = await api<Run>(`/api/career/v1/missions/${id}/runs`, { method: "POST",
          headers: { "content-type": "application/json" }, body: JSON.stringify({ apiVersion: "v1", requestKey, message: question, ...(appContext ? { applicationId: appContext.id } : {}) }) });
        if (run.status !== "COMPLETED") throw new Error("MISSION_NOT_COMPLETE");
        await openMission(id); await refreshList();
      } else {
        // Explicitly temporary: no mission or conversation is created implicitly.
        const response = await fetch("/api/assistant", { method: "POST", credentials: "same-origin",
          headers: { "content-type": "application/json" }, body: JSON.stringify({ message: question, ...(appContext ? { applicationId: appContext.id } : {}) }) });
        const result = await response.json() as { message?: string; error?: string; steps?: Step[] };
        if (!response.ok || !result.message) throw new Error(result.error || "EMPTY_RESPONSE");
        setMessages(previous => [...previous, { role: "assistant", content: result.message!,
          steps: result.steps?.filter(s => s.status === "completed" && labels[s.tool]).slice(0, 3) }]);
      }
    } catch {
      setError(id ? "Exécution non confirmée. Ouvrez de nouveau cette mission pour vérifier l'historique avant de réessayer." :
        "La réponse n'a pas abouti. Aucun document ou candidature n'a été modifié.");
      if (id) setRetry({ missionId: id, requestKey, question });
      else setMessage(question);
    } finally { setPending(false); }
  }

  async function prepareDraft() {
    if (!appContext || draftInstruction.trim().length < 5 || draftBusy) return;
    setDraftBusy(true); setDraftError(""); setDraftProposal(null); setDraftReviewed(false);
    try {
      const result = await api<DraftProposal>("/api/career/v1/agent/drafts", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ apiVersion: "v1", applicationId: appContext.id, kind: draftKind, instruction: draftInstruction.trim(), language }) });
      setDraftProposal(result);
    } catch (e) { setDraftError(e instanceof Error ? e.message : "DRAFT_FAILED"); }
    finally { setDraftBusy(false); }
  }
  async function decideDraft(action: "accept" | "discard") {
    if (!appContext || !draftProposal?.proposalId || (action === "accept" && !draftReviewed) || draftBusy) return;
    setDraftBusy(true); setDraftError("");
    try {
      await api("/api/career/v1/agent/drafts/decision", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ apiVersion: "v1", applicationId: appContext.id, kind: draftProposal.kind, proposalId: draftProposal.proposalId, action }) });
      setDraftProposal(null); setDraftInstruction(""); setDraftReviewed(false);
      if (action === "accept") setMessages(old => [...old, { role: "assistant", content: "Modification approuvée et enregistrée dans votre document. Vous pouvez le relire dans le studio." }]);
    } catch (e) { setDraftError(e instanceof Error ? e.message : "DECISION_FAILED"); }
    finally { setDraftBusy(false); }
  }

  return <div className="space-y-6">
    <div className="relative overflow-hidden rounded-3xl border bg-hero p-5 text-hero-foreground sm:p-7">
      <div className="relative flex flex-wrap items-center justify-between gap-5">
        <div className="max-w-xl space-y-2">
          <p className="flex items-center gap-2 text-[11px] font-semibold uppercase tracking-[.12em]"><Sparkles className="size-4" aria-hidden="true"/> Career Copilot</p>
          <h1 className="text-2xl font-semibold tracking-tight sm:text-3xl">Career Agent</h1>
          <p className="text-sm leading-6 opacity-85">{language === "fr" ? "Un espace intelligent pour comprendre votre parcours, retrouver vos missions et prendre de meilleures décisions." : "Understand your experience, resume your missions and make more informed career decisions."}</p>
        </div>
        <Link href="/dashboard/profile" className="inline-flex min-h-10 items-center gap-2 rounded-xl border border-primary/20 bg-card px-4 text-xs font-medium text-card-foreground transition-colors hover:bg-secondary"><ShieldCheck className="size-4" aria-hidden="true"/>{language === "fr" ? "Mon profil" : "My career profile"}<ArrowUpRight className="size-3.5" aria-hidden="true"/></Link>
      </div>
    </div>
    {appContext && <section className="space-y-4 rounded-2xl border bg-card p-4 sm:p-5" aria-label="Contexte de candidature">
      <div className="flex flex-wrap items-center justify-between gap-3"><div><p className="text-[11px] font-semibold uppercase tracking-wide text-primary">Candidature en cours</p><h2 className="mt-1 text-base font-semibold">{appContext.jobTitle} — {appContext.company}</h2><p className="text-xs text-muted-foreground">Career Agent consulte ce dossier uniquement avec votre autorisation. Les modifications restent des propositions.</p></div><Button asChild variant="outline" size="sm"><Link href={`/dashboard/applications/${appContext.id}?tab=documents`}>Retour au dossier</Link></Button></div>
      <div className="grid gap-3 md:grid-cols-[160px_minmax(0,1fr)_auto] md:items-end">
        <label className="grid gap-1 text-xs font-medium">Document
          <select className="h-10 rounded-lg border bg-background px-2 text-sm" value={draftKind} onChange={e => { setDraftKind(e.target.value as "resume" | "letter"); setDraftProposal(null); setDraftReviewed(false); setDraftFromChat(false); }}><option value="resume">CV adapté</option><option value="letter">Lettre</option></select>
        </label>
        <label className="grid gap-1 text-xs font-medium">Demande à préparer (sans enregistrer de modification)
          <Textarea rows={2} maxLength={4000} value={draftInstruction} onChange={e => { setDraftInstruction(e.target.value); setDraftProposal(null); setDraftReviewed(false); setDraftFromChat(false); }} placeholder="Ex. Reformule mon résumé pour cette offre sans ajouter de compétences non démontrées." />
        </label>
        <Button disabled={draftBusy || draftInstruction.trim().length < 5 || !(draftKind === "resume" ? appContext.cv : appContext.coverLetter)} onClick={() => void prepareDraft()}>{draftBusy ? "Préparation…" : "Préparer une proposition"}</Button>
      </div>
      {draftKind === "resume" && !appContext.cv && <p className="text-xs text-muted-foreground">Associez d'abord un CV depuis le dossier.</p>}
      {draftKind === "letter" && !appContext.coverLetter && <p className="text-xs">Aucune lettre reliée. <Link className="text-primary underline" href={`/dashboard/cover-letters?applicationId=${encodeURIComponent(appContext.id)}${appContext.cv ? `&cvId=${encodeURIComponent(appContext.cv.id)}` : ""}`}>Créer une lettre</Link></p>}
      {draftFromChat && <p role="status" className="text-xs text-muted-foreground">Votre demande du chat a été reprise ici. Cliquez sur « Préparer une proposition » pour obtenir un aperçu ; aucune modification ne sera appliquée sans validation.</p>}
      {draftError && <p role="alert" className="text-xs text-destructive">{draftError}</p>}
      {draftProposal && <div className="space-y-3 rounded-xl border border-primary/30 p-4">
        <h3 className="text-sm font-semibold">{draftProposal.status === "proposal" ? "Proposition IA — non appliquée" : "Clarification nécessaire"}</h3><p className="text-sm">{draftProposal.message}</p>
        {draftProposal.changes.length > 0 && <ul className="list-inside list-disc text-xs text-muted-foreground">{draftProposal.changes.map((change, index) => <li key={index}>{change}</li>)}</ul>}
        {draftProposal.diff?.length ? <div className="max-h-80 space-y-3 overflow-auto">{draftProposal.diff.map((change, index) => <div key={index} className="rounded-lg border p-3 text-xs"><p className="font-semibold">{change.field}</p><p className="mt-1 whitespace-pre-wrap text-muted-foreground"><span className="font-medium">Avant : </span>{change.before.slice(0, 4000) || "(vide)"}</p><p className="mt-2 whitespace-pre-wrap"><span className="font-medium">Proposé : </span>{change.after.slice(0, 4000) || "(vide)"}</p></div>)}</div> : null}
        {draftProposal.proposalId && <><p className="text-xs text-muted-foreground">Expirera le {draftProposal.expiresAt ? new Date(draftProposal.expiresAt).toLocaleString("fr-FR") : "—"}. Une approbation ne déclenche ni envoi ni candidature.</p><label className="flex items-center gap-2 text-sm"><input type="checkbox" checked={draftReviewed} onChange={e => setDraftReviewed(e.target.checked)}/> J'ai relu les changements et je confirme qu'ils ne contiennent aucun fait inventé.</label><div className="flex gap-2"><Button disabled={!draftReviewed || draftBusy} size="sm" onClick={() => void decideDraft("accept")}>Approuver les changements</Button><Button disabled={draftBusy} size="sm" variant="outline" onClick={() => void decideDraft("discard")}>Rejeter</Button></div></>}
      </div>}
    </section>}
    <div className="grid min-w-0 gap-4 lg:grid-cols-[265px_minmax(0,1fr)] xl:gap-6">
      <aside className="h-fit space-y-3 rounded-2xl border bg-card p-3 lg:sticky lg:top-4" aria-label="Mes missions">
        <Button className="w-full" onClick={() => void createMission()} disabled={busyAction || pending}>
          <Plus className="size-4" aria-hidden="true" /> Créer une mission
        </Button>
        <Button variant="outline" className="w-full" onClick={temporaryChat} disabled={pending || busyAction}>
          <LockKeyhole className="size-4" aria-hidden="true" /> Conversation temporaire
        </Button>
        <h2 className="px-2 pt-2 text-xs font-semibold uppercase tracking-wide text-muted-foreground">Missions sauvegardées</h2>
        <div className="max-h-64 space-y-1 overflow-y-auto lg:max-h-[50vh]">
          {missions.length === 0 && <p className="p-2 text-xs text-muted-foreground">Aucune mission enregistrée.</p>}
          {missions.map(m => <button key={m.id} type="button" onClick={() => { if (!pending) void openMission(m.id); }}
            aria-current={selectedId === m.id ? "page" : undefined}
            className={`flex w-full items-start gap-2 rounded-lg px-3 py-2.5 text-left text-sm transition-colors hover:bg-muted ${selectedId === m.id ? "bg-muted font-medium" : ""}`}>
            {m.status === "ARCHIVED" ? <Archive className="mt-0.5 size-4 shrink-0" /> : <FileClock className="mt-0.5 size-4 shrink-0" />}
            <span className="min-w-0 flex-1 truncate">{m.title}</span>
          </button>)}
        </div>
        <p className="px-2 text-xs leading-5 text-muted-foreground">Au maximum 30 missions. Elles sont supprimables avec leur historique.</p>
      </aside>
      <section className="min-w-0 space-y-4" aria-label="Conversation avec CVComet Career Agent">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <div>
            <h2 className="font-semibold">{detail?.title || (selectedId ? "Chargement de la mission" : "Conversation temporaire")}</h2>
            <p className="text-xs text-muted-foreground">{detail ? "Historique conservé dans votre compte" : "Aucun historique enregistré dans les missions"}</p>
          </div>
          {detail && <div className="flex gap-2">
            <Button variant="outline" size="sm" disabled={pending || busyAction} onClick={() => void renameMission()} aria-label="Renommer la mission">
              <Pencil className="size-4" />
            </Button>
            <Button variant="outline" size="sm" disabled={pending || busyAction} onClick={() => void updateMission(detail.status === "ARCHIVED" ? "restore" : "archive")}>
              {detail.status === "ARCHIVED" ? <RotateCcw className="size-4" /> : <Archive className="size-4" />}
              {detail.status === "ARCHIVED" ? "Réactiver" : "Archiver"}
            </Button>
            <Button variant="outline" size="sm" disabled={pending || busyAction} onClick={() => void updateMission("delete")} aria-label="Supprimer définitivement la mission">
              <Trash2 className="size-4" />
            </Button>
          </div>}
        </div>
        {error && <div role="alert" className="rounded-lg border p-3 text-sm text-destructive">{error}
          {retry && retry.missionId === selectedId && <div className="mt-2 flex gap-2">
            <Button size="sm" variant="outline" disabled={pending || loading} onClick={() => { if (selectedId) void openMission(selectedId); }}>Vérifier l'historique</Button>
            <Button size="sm" variant="outline" disabled={pending || loading} onClick={() => void send(undefined, retry)}>Réessayer avec le même identifiant</Button>
          </div>}
        </div>}
        <div aria-live="polite" aria-relevant="additions text" aria-busy={loading || pending} className="min-h-[320px] max-h-[60vh] space-y-4 overflow-y-auto rounded-2xl border bg-card p-4 shadow-sm sm:min-h-[420px] sm:p-6 lg:max-h-[580px]">
          {loading && <p role="status" className="text-sm text-muted-foreground">Chargement de la mission…</p>}
          {!!detail && olderCursor && !loading && <div className="text-center">
            <Button size="sm" variant="outline" disabled={loadingOlder || pending} onClick={() => void loadOlder()}>
              {loadingOlder ? "Chargement…" : "Charger les anciens échanges"}
            </Button>
          </div>}
          {!loading && messages.length === 0 && <div className="rounded-xl border bg-muted/50 p-4 text-sm text-muted-foreground">Cette mission ne contient encore aucun échange. Posez votre première question.</div>}
          {!loading && (messages.length === 0 || (messages.length === 1 && messages[0].role === "assistant")) && !pending && <div className="rounded-2xl border border-primary/15 bg-background p-4 sm:p-5">
            <h3 className="mb-1 text-sm font-semibold">{language === "fr" ? "Commencer avec une question" : "Start with a question"}</h3>
            <p className="mb-4 text-xs leading-5 text-muted-foreground">{language === "fr" ? "Ces suggestions remplissent votre message sans l’envoyer automatiquement." : "Suggestions only fill your message. Nothing is sent automatically."}</p>
            <div className="grid gap-2 sm:grid-cols-3">{suggestions[language].map(({ label, prompt, icon: Icon }) => <button type="button" key={label} onClick={() => { setMessage(prompt); questionRef.current?.focus(); }} disabled={pending || detail?.status === "ARCHIVED"} className="flex min-h-20 flex-col items-start gap-2 rounded-xl border bg-card p-3 text-left text-xs font-medium leading-relaxed transition-colors hover:border-primary hover:bg-accent disabled:opacity-50"><Icon className="size-4 text-primary" aria-hidden="true"/>{label}</button>)}</div>
          </div>}
          {!loading && messages.map((item, index) => <div key={index} className={item.role === "assistant"
            ? "mr-2 rounded-xl border bg-muted/50 p-4 sm:mr-12" : "ml-2 rounded-xl bg-primary p-4 text-primary-foreground sm:ml-12"}>
            <div className="mb-2 flex items-center gap-2 text-xs font-semibold">
              {item.role === "assistant" ? <BrainCircuit className="size-4" aria-hidden="true" /> : <Sparkles className="size-4" aria-hidden="true" />}
              {item.role === "assistant" ? "CVComet Agent" : "Vous"}
            </div>
            <p className="whitespace-pre-wrap break-words text-sm leading-7">{item.content}</p>
            {item.role === "assistant" && item.runId && selectedId && <div className="mt-3 flex flex-wrap items-center gap-2" aria-label="Évaluer la réponse">
              <span className="text-xs text-muted-foreground">Cette réponse était-elle utile ?</span>
              <button type="button" disabled={feedbackBusy === item.runId || pending}
                aria-label="Réponse utile" aria-pressed={item.feedbackRating === "HELPFUL"}
                onClick={() => void rateAnswer(item.runId!, item.feedbackRating, "HELPFUL")}
                className="rounded-lg border px-2.5 py-1.5 text-xs transition-colors hover:bg-accent aria-pressed:bg-accent disabled:opacity-50">
                <ThumbsUp className="mr-1 inline size-3.5" />Utile
              </button>
              <button type="button" disabled={feedbackBusy === item.runId || pending}
                aria-label="Réponse peu utile" aria-pressed={item.feedbackRating === "NOT_HELPFUL"}
                onClick={() => void rateAnswer(item.runId!, item.feedbackRating, "NOT_HELPFUL")}
                className="rounded-lg border px-2.5 py-1.5 text-xs transition-colors hover:bg-accent aria-pressed:bg-accent disabled:opacity-50">
                <ThumbsDown className="mr-1 inline size-3.5" />Peu utile
              </button>
            </div>}
            {!!item.steps?.length && <div className="mt-4 flex flex-wrap gap-2" aria-label="Outils consultés">
              {item.steps.map((step, i) => <span key={`${step.tool}-${i}`} className="inline-flex items-center gap-1 rounded-full border bg-background px-2.5 py-1 text-xs text-muted-foreground">
                <Check className="size-3" aria-hidden="true" /> {labels[step.tool]}
              </span>)}
            </div>}
          </div>)}
          {pending && <div role="status" className="flex items-center gap-2 text-sm text-muted-foreground"><Sparkles className="size-4 animate-pulse" /> Analyse des données autorisées…</div>}
        </div>
        {!!detail?.approvals?.length && <section className="space-y-2 rounded-xl border bg-card p-4" aria-label="Demandes d'approbation">
          <h3 className="font-semibold">Demandes d'approbation</h3>
          <p className="text-xs text-muted-foreground">Une approbation enregistrée ne déclenche pas automatiquement une candidature, un email ou un paiement.</p>
          {detail.approvals.map(item => <div key={item.id} className="flex flex-wrap items-center justify-between gap-2 border-t py-2 text-sm">
            <span>{item.summary} <span className="text-muted-foreground">({item.status})</span></span>
            {item.status === "PENDING" && new Date(item.expiresAt).getTime() > Date.now() && <span className="flex gap-2">
              <Button size="sm" variant="outline" disabled={busyAction} onClick={() => void decideApproval(item.id, "reject")}>Refuser</Button>
              <Button size="sm" disabled={busyAction} onClick={() => void decideApproval(item.id, "approve")}>Approuver</Button>
            </span>}
          </div>)}
        </section>}
        <form onSubmit={send} className="space-y-3 rounded-2xl border bg-card p-3 shadow-sm sm:p-4">
          <label htmlFor="career-agent-question" className="sr-only">Votre question</label>
          <Textarea ref={questionRef} id="career-agent-question" value={message} onChange={event => setMessage(event.target.value)}
            maxLength={6000} rows={3} disabled={pending || loading || detail?.status === "ARCHIVED"}
            placeholder={detail?.status === "ARCHIVED" ? "Réactivez cette mission pour la continuer" : "Ex. Aide-moi à améliorer mon CV avec mes compétences confirmées"} />
          <div className="flex flex-wrap items-center justify-between gap-3">
            <p className="flex items-center gap-1.5 text-xs text-muted-foreground"><LockKeyhole className="size-3" aria-hidden="true"/> Lecture seule · {selectedId ? "Mission privée" : "Conversation temporaire"}</p>
            <Button type="submit" disabled={pending || loading || message.trim().length < 2 || detail?.status === "ARCHIVED"}>
              <ArrowUp className="size-4" /> Envoyer
            </Button>
          </div>
        </form>
      </section>
    </div>
  </div>;
}
