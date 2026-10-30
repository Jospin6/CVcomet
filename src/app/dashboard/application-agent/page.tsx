"use client";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import Link from "next/link";
import { ClipboardCheck, Copy, FileCheck2, RefreshCw, ShieldCheck } from "lucide-react";
import { PageHeader } from "@/components/ui/page-header";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";

type Choice = { id: string; title?: string; company?: string | null; cvId?: string | null; jobId?: string | null; positionTitle?: string | null };
type Options = { jobs: Choice[]; resumes: Choice[]; letters: Choice[]; missions: Choice[] };
type Brief = { id: string; status: "DRAFT" | "READY" | "CANCELED"; revision: number; job: { title: string; company?: string | null } };
type Packet = Brief & { subject: string; body: string; recipientEmail: string | null; jobId: string; cvId: string; coverLetterId: string | null; missionId: string | null; cvRevision: number; letterRevision: number | null; approvedAt: string | null; sourceChanged: boolean; job: { title: string; company: string | null; sourceUrl: string | null }; cv: { title: string; revision: number }; coverLetter?: { revision: number; positionTitle: string | null } | null };
type Envelope<T> = { data?: T; error?: { code: string } };

async function api<T>(path: string, options?: RequestInit): Promise<T> {
  const r = await fetch(path, { cache: "no-store", ...options });
  const value = await r.json() as Envelope<T>;
  if (!r.ok || !value.data) throw new Error(value.error?.code || `HTTP_${r.status}`);
  return value.data;
}
const send = (payload: unknown, method = "POST"): RequestInit => ({ method, headers: { "Content-Type": "application/json" }, body: JSON.stringify(payload) });

export default function ApplicationAgentPage() {
  const [options, setOptions] = useState<Options>({ jobs: [], resumes: [], letters: [], missions: [] });
  const [packets, setPackets] = useState<Brief[]>([]);
  const [jobId, setJobId] = useState("");
  const [cvId, setCvId] = useState("");
  const [letterId, setLetterId] = useState("");
  const [missionId, setMissionId] = useState("");
  const [language, setLanguage] = useState<"fr" | "en">("fr");
  const [active, setActive] = useState<Packet | null>(null);
  const [subject, setSubject] = useState("");
  const [body, setBody] = useState("");
  const [recipientEmail, setRecipientEmail] = useState("");
  const [reviewed, setReviewed] = useState(false);
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);
  const [copied, setCopied] = useState(false);
  const [applicationId, setApplicationId] = useState("");
  useEffect(() => { setApplicationId(new URLSearchParams(window.location.search).get("applicationId") || ""); }, []);
  const requestKeyRef = useRef<string | null>(null);

  const load = useCallback(async () => {
    try {
      const [choices, saved] = await Promise.all([
        api<Options>("/api/career/v1/application-packets/options"),
        api<{ items: Brief[] }>("/api/career/v1/application-packets?limit=50"),
      ]);
      setOptions(choices);
      setPackets(saved.items);
    } catch (e) { setError(e instanceof Error ? e.message : "LOAD_FAILED"); }
  }, []);
  useEffect(() => { void load(); }, [load]);
  const seededContext = useRef(false);
  useEffect(() => {
    if (seededContext.current || !options.jobs.length || !options.resumes.length) return;
    const params = new URLSearchParams(window.location.search);
    const requestedJob = params.get("jobId");
    const requestedCv = params.get("cvId");
    if (requestedJob && options.jobs.some(item => item.id === requestedJob)) {
      setJobId(requestedJob);
      if (requestedCv && options.resumes.some(item => item.id === requestedCv)) setCvId(requestedCv);
    }
    seededContext.current = true;
  }, [options]);
  const letterOptions = useMemo(() => options.letters.filter(letter => letter.cvId === cvId && (!letter.jobId || letter.jobId === jobId)), [options.letters, cvId, jobId]);
  const showPacket = (packet: Packet) => { setActive(packet); setSubject(packet.subject); setBody(packet.body); setRecipientEmail(packet.recipientEmail || ""); setReviewed(false); setCopied(false); };
  const guarded = async (action: () => Promise<void>) => { setBusy(true); setError(""); try { await action(); } catch (e) { setError(e instanceof Error ? e.message : "REQUEST_FAILED"); } finally { setBusy(false); } };
  const detail = async (id: string) => showPacket(await api<Packet>(`/api/career/v1/application-packets/${id}`));
  const create = () => guarded(async () => {
    if (!jobId || !cvId) { setError("Choisissez une offre et un CV."); return; }
    const created = await api<{ packet: { id: string } }>("/api/career/v1/application-packets", send({ apiVersion: "v1", requestKey: (requestKeyRef.current ??= crypto.randomUUID()), jobId, cvId, ...(letterId ? { coverLetterId: letterId } : {}), ...(missionId ? { missionId } : {}), language }));
    requestKeyRef.current = null; await load(); await detail(created.packet.id);
  });
  const save = () => active && guarded(async () => {
    const result = await api<Packet>(`/api/career/v1/application-packets/${active.id}`, send({ apiVersion: "v1", revision: active.revision, subject, body, recipientEmail: recipientEmail.trim() || null }, "PATCH"));
    showPacket(result); await load();
  });
  const decide = (action: "approve" | "cancel") => active && guarded(async () => {
    if (action === "approve" && (subject !== active.subject || body !== active.body || recipientEmail !== (active.recipientEmail || ""))) {
      setError("Enregistrez les modifications avant d'approuver."); return;
    }
    await api(`/api/career/v1/application-packets/${active.id}/decision`, send({ apiVersion: "v1", action, revision: active.revision, reviewed }));
    await detail(active.id); await load();
  });
  const suggest = () => active && guarded(async () => {
    if (active.status !== "DRAFT") return;
    const proposal = await api<{ suggestion: { subject: string; body: string } }>(`/api/career/v1/application-packets/${active.id}/suggest-email`, send({ apiVersion: "v1", revision: active.revision }));
    setSubject(proposal.suggestion.subject); setBody(proposal.suggestion.body); setReviewed(false);
    setError("Proposition IA non enregistrée : vérifiez tous les faits, puis cliquez sur Enregistrer le brouillon.");
  });
  const copy = async () => { try { await navigator.clipboard.writeText(`À / To: ${recipientEmail || "(à compléter)"}
Objet / Subject: ${subject}

${body}`); setCopied(true); } catch { setError("COPY_FAILED"); } };
  return <div className="space-y-6">
    <PageHeader title="Application Agent" description="Préparez, vérifiez et approuvez un dossier de candidature. Aucun envoi ni dépôt sur un site externe n'est effectué." />
    {applicationId && <Link href={`/dashboard/applications/${encodeURIComponent(applicationId)}?tab=documents`} className="text-sm text-primary">← Retour au dossier de candidature</Link>}
    <div className="rounded-xl border border-primary/25 bg-primary/5 p-4 text-sm"><ShieldCheck className="mb-2 size-5"/><strong>Votre contrôle, à chaque étape.</strong> Le dossier « Prêt » signifie uniquement « approuvé pour utilisation manuelle ». L'application n'envoie aucun email et ne modifie pas le statut de votre candidature.</div>
    <section className="app-section space-y-4"><h2 className="type-h2">Nouveau dossier</h2>
      <div className="grid gap-3 md:grid-cols-2">
        <label className="space-y-1 text-sm">Offre enregistrée
          <select className="w-full rounded-lg border bg-background p-2" value={jobId} onChange={e => { setJobId(e.target.value); setLetterId(""); requestKeyRef.current = null; }}><option value="">Choisir une offre</option>{options.jobs.map(item => <option key={item.id} value={item.id}>{item.title}{item.company ? ` — ${item.company}` : ""}</option>)}</select>
        </label>
        <label className="space-y-1 text-sm">CV associé
          <select className="w-full rounded-lg border bg-background p-2" value={cvId} onChange={e => { setCvId(e.target.value); setLetterId(""); requestKeyRef.current = null; }}><option value="">Choisir un CV</option>{options.resumes.map(item => <option key={item.id} value={item.id}>{item.title || "Sans titre"}</option>)}</select>
        </label>
        <label className="space-y-1 text-sm">Lettre liée (facultatif)
          <select className="w-full rounded-lg border bg-background p-2" value={letterId} onChange={e => { setLetterId(e.target.value); requestKeyRef.current = null; }}><option value="">Aucune lettre</option>{letterOptions.map(item => <option key={item.id} value={item.id}>{item.positionTitle || item.company || item.id}</option>)}</select>
        </label>
        <label className="space-y-1 text-sm">Mission de carrière (facultatif)
          <select className="w-full rounded-lg border bg-background p-2" value={missionId} onChange={e => { setMissionId(e.target.value); requestKeyRef.current = null; }}><option value="">Sans mission</option>{options.missions.map(item => <option key={item.id} value={item.id}>{item.title}</option>)}</select>
        </label>
        <label className="space-y-1 text-sm">Langue de l'email
          <select className="w-full rounded-lg border bg-background p-2" value={language} onChange={e => { setLanguage(e.target.value as "fr" | "en"); requestKeyRef.current = null; }}><option value="fr">Français</option><option value="en">English</option></select>
        </label>
      </div>
      <Button disabled={busy || !jobId || !cvId} onClick={create}><FileCheck2 className="size-4"/> Préparer le dossier</Button>
      {(!options.jobs.length || !options.resumes.length) && <p className="text-sm text-muted-foreground">Créez d'abord une <Link className="underline" href="/dashboard/job-match">analyse d'offre</Link> et un <Link className="underline" href="/dashboard/resumes">CV</Link>.</p>}
    </section>
    <section className="app-section space-y-3"><div className="flex items-center justify-between"><h2 className="type-h2">Dossiers sauvegardés</h2><Button variant="outline" onClick={() => void load()} disabled={busy}><RefreshCw className="size-4"/> Actualiser</Button></div>
      {packets.length ? <div className="grid gap-2 md:grid-cols-2">{packets.map(item => <button type="button" key={item.id} onClick={() => void guarded(() => detail(item.id))} className="rounded-lg border p-3 text-left hover:bg-muted/50 focus-visible:outline focus-visible:outline-2"><span className="block font-medium">{item.job.title}</span><span className="text-xs text-muted-foreground">{item.job.company || "Entreprise non précisée"} · {item.status === "READY" ? "Prêt pour utilisation manuelle" : item.status === "DRAFT" ? "Brouillon" : "Annulé"}</span></button>)}</div> : <p className="text-sm text-muted-foreground">Aucun dossier pour le moment.</p>}
    </section>
    {active && <section className="app-section space-y-4" aria-label="Dossier sélectionné">
      <div className="flex items-start justify-between gap-3"><div><h2 className="type-h2">{active.job.title}</h2><p className="text-sm text-muted-foreground">{active.job.company} · Révision {active.revision} · {active.status}</p></div><Button variant="outline" size="sm" onClick={() => void guarded(() => detail(active.id))}>Recharger</Button></div>
      <div className="grid gap-2 text-sm sm:grid-cols-2"><Link className="rounded border p-3 underline" href={`/dashboard/resumes/${active.cvId}${applicationId ? `?applicationId=${encodeURIComponent(applicationId)}` : ""}`}>Ouvrir le CV : {active.cv.title || "Sans titre"}</Link>{active.coverLetterId && <Link className="rounded border p-3 underline" href={`/dashboard/cover-letters/${active.coverLetterId}${applicationId ? `?applicationId=${encodeURIComponent(applicationId)}` : ""}`}>Vérifier la lettre de motivation</Link>}</div>
      <label className="block space-y-1 text-sm">Adresse du destinataire (facultative, jamais devinée)<Input type="email" disabled={busy || active.status !== "DRAFT"} value={recipientEmail} onChange={e => { setRecipientEmail(e.target.value); setReviewed(false); }}/></label>
      <label className="block space-y-1 text-sm">Objet<Input maxLength={300} disabled={busy || active.status !== "DRAFT"} value={subject} onChange={e => { setSubject(e.target.value); setReviewed(false); }}/></label>
      <label className="block space-y-1 text-sm">Email de candidature<Textarea maxLength={12000} rows={9} disabled={busy || active.status !== "DRAFT"} value={body} onChange={e => { setBody(e.target.value); setReviewed(false); }}/></label>
      <div className="flex flex-wrap gap-2"><Button variant="outline" disabled={busy || active.status !== "DRAFT"} onClick={() => void suggest()}>Améliorer l’email avec l’IA (sur demande)</Button><Button variant="outline" disabled={busy || active.status !== "DRAFT"} onClick={() => void save()}>Enregistrer le brouillon</Button><Button variant="outline" onClick={() => void copy()}><Copy className="size-4"/>{copied ? "Copié" : "Copier l'email"}</Button></div>
      {active.status === "DRAFT" && <div className="rounded-lg border p-4 space-y-3"><label className="flex gap-2 text-sm"><input type="checkbox" checked={reviewed} onChange={e => setReviewed(e.target.checked)}/><span>J'ai relu l'email, le CV, la lettre éventuelle et les informations du poste. Je comprends que cette approbation n'envoie aucune candidature.</span></label><div className="flex gap-2"><Button disabled={busy || !reviewed} onClick={() => void decide("approve")}><ClipboardCheck className="size-4"/> Approuver le dossier</Button><Button disabled={busy} variant="outline" onClick={() => void decide("cancel")}>Annuler le dossier</Button></div></div>}
      {active.sourceChanged && <p role="alert" className="rounded-lg border border-destructive/40 p-3 text-sm text-destructive">La version du CV, de la lettre ou de l’offre a changé depuis la préparation. Créez un nouveau dossier pour obtenir une approbation actuelle.</p>}
      {active.status === "READY" && <p role="status" className="rounded-lg border p-3 text-sm">Dossier approuvé. Vous pouvez copier l'email et exporter vos documents, puis transmettre vous-même votre candidature. Aucun statut « Envoyé » n'a été enregistré.</p>}
    </section>}
    {error && <p role="alert" className="rounded-lg border border-destructive/30 p-3 text-sm text-destructive">{error} — Réessayez après actualisation des données.</p>}
  </div>;
}
