"use client";

import { Suspense, useCallback, useEffect, useRef, useState } from "react";
import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { Check, ClipboardCheck, Copy, FileCheck2, RefreshCw, Sparkles } from "lucide-react";
import { ApplicationDocuments } from "@/components/applications/application-documents";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";

type Application = {
  id: string;
  jobId: string | null;
  cvId: string | null;
  coverLetterId: string | null;
  jobTitle: string;
  company: string;
  job: { id: string; title: string; description: string } | null;
};
type Brief = {
  id: string;
  status: "DRAFT" | "READY" | "CANCELED";
  revision: number;
  jobId: string;
  cvId: string;
  coverLetterId: string | null;
  job: { title: string; company?: string | null };
};
type Packet = Brief & {
  subject: string;
  body: string;
  recipientEmail: string | null;
  cvRevision: number;
  letterRevision: number | null;
  sourceChanged: boolean;
  cv: { title: string; revision: number };
};
type Envelope<T> = { data?: T; error?: { code?: string } };
type Tab = "documents" | "email" | "approval" | "history";
const tabs: { id: Tab; label: string }[] = [
  { id: "documents", label: "Documents" },
  { id: "email", label: "Email" },
  { id: "approval", label: "Approbation" },
  { id: "history", label: "Historique" },
];

async function api<T>(path: string, options?: RequestInit): Promise<T> {
  const response = await fetch(path, { cache: "no-store", ...options });
  const json = await response.json() as Envelope<T>;
  if (!response.ok || !json.data) throw new Error(json.error?.code || `HTTP_${response.status}`);
  return json.data;
}
const payload = (value: unknown, method = "POST"): RequestInit => ({
  method,
  headers: { "Content-Type": "application/json" },
  body: JSON.stringify(value),
});

function AutoTextarea({ value, onChange, disabled }: {
  value: string;
  onChange: (value: string) => void;
  disabled: boolean;
}) {
  const fieldRef = useRef<HTMLTextAreaElement>(null);
  useEffect(() => {
    if (!fieldRef.current) return;
    fieldRef.current.style.height = "68px";
    fieldRef.current.style.height = `${Math.max(68, Math.min(fieldRef.current.scrollHeight, 340))}px`;
  }, [value]);
  return (
    <textarea
      ref={fieldRef}
      value={value}
      onChange={event => onChange(event.target.value)}
      disabled={disabled}
      rows={2}
      maxLength={12000}
      className="w-full min-h-[68px] resize-none overflow-y-auto rounded-md border bg-background px-3 py-2 text-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
    />
  );
}

export default function ApplicationAgentPage() {
  return <Suspense fallback={<div className="h-64 animate-pulse rounded-xl bg-muted" />}><ApplicationAgentContent /></Suspense>;
}

function ApplicationAgentContent() {
  const applicationId = useSearchParams().get("applicationId") || "";
  const [application, setApplication] = useState<Application | null>(null);
  const [packets, setPackets] = useState<Brief[]>([]);
  const [active, setActive] = useState<Packet | null>(null);
  const [tab, setTab] = useState<Tab>("documents");
  const [language, setLanguage] = useState<"fr" | "en">("fr");
  const [subject, setSubject] = useState("");
  const [body, setBody] = useState("");
  const [recipientEmail, setRecipientEmail] = useState("");
  const [reviewed, setReviewed] = useState(false);
  const [busy, setBusy] = useState(false);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [message, setMessage] = useState("");
  const requestKeyRef = useRef<string | null>(null);

  const load = useCallback(async () => {
    const [saved, app] = await Promise.all([
      api<{ items: Brief[] }>("/api/career/v1/application-packets?limit=50"),
      applicationId ? fetch(`/api/applications/${encodeURIComponent(applicationId)}`, { cache: "no-store" })
        .then(async response => {
          if (!response.ok) throw new Error("Candidature introuvable.");
          return response.json() as Promise<Application>;
        }) : Promise.resolve(null),
    ]);
    setApplication(app);
    setPackets(saved.items);
    return { saved: saved.items, app };
  }, [applicationId]);

  const openPacket = useCallback(async (id: string) => {
    const packet = await api<Packet>(`/api/career/v1/application-packets/${id}`);
    setActive(packet);
    setSubject(packet.subject);
    setBody(packet.body);
    setRecipientEmail(packet.recipientEmail || "");
    setReviewed(false);
  }, []);

  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    void load().then(async ({ saved, app }) => {
      if (!app || cancelled) return;
      const existing = saved.find(item =>
        item.jobId === app.jobId && item.cvId === app.cvId && item.coverLetterId === app.coverLetterId
      );
      if (existing) await openPacket(existing.id);
    }).catch(failure => {
      if (!cancelled) setError(failure instanceof Error ? failure.message : "Chargement impossible.");
    }).finally(() => { if (!cancelled) setLoading(false); });
    return () => { cancelled = true; };
  }, [load, openPacket]);

  const run = async (action: () => Promise<void>) => {
    setBusy(true); setError(""); setMessage("");
    try { await action(); }
    catch (failure) { setError(failure instanceof Error ? failure.message : "Action impossible."); }
    finally { setBusy(false); }
  };

  const updateDocument = async (key: "cvId" | "coverLetterId", value: string | null) => {
    if (!application) throw new Error("Candidature indisponible.");
    const response = await fetch(`/api/applications/${encodeURIComponent(application.id)}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ [key]: value }),
    });
    if (!response.ok) {
      const data = await response.json().catch(() => ({})) as { error?: string };
      throw new Error(data.error || "Document non associé.");
    }
    const next = await load();
    setActive(null);
    setReviewed(false);
    requestKeyRef.current = null;
    if (!next.app) throw new Error("Candidature introuvable.");
  };

  const create = () => run(async () => {
    if (!application?.jobId || !application.cvId || !application.job?.description.trim()) {
      throw new Error("Cette candidature doit contenir une offre et un CV.");
    }
    const created = await api<{ packet: { id: string } }>(
      "/api/career/v1/application-packets",
      payload({
        apiVersion: "v1",
        requestKey: (requestKeyRef.current ??= crypto.randomUUID()),
        jobId: application.jobId,
        cvId: application.cvId,
        ...(application.coverLetterId ? { coverLetterId: application.coverLetterId } : {}),
        language,
      })
    );
    requestKeyRef.current = null;
    await load();
    await openPacket(created.packet.id);
    setTab("email");
  });

  const save = () => active && run(async () => {
    const next = await api<Packet>(
      `/api/career/v1/application-packets/${active.id}`,
      payload({ apiVersion: "v1", revision: active.revision, subject, body, recipientEmail: recipientEmail.trim() || null }, "PATCH")
    );
    await openPacket(next.id);
    await load();
    setMessage("Brouillon enregistré.");
  });

  const suggest = () => active && run(async () => {
    const next = await api<{ suggestion: { subject: string; body: string } }>(
      `/api/career/v1/application-packets/${active.id}/suggest-email`,
      payload({ apiVersion: "v1", revision: active.revision })
    );
    setSubject(next.suggestion.subject);
    setBody(next.suggestion.body);
    setReviewed(false);
    setMessage("Proposition IA à relire et enregistrer.");
  });

  const decide = (action: "approve" | "cancel") => active && run(async () => {
    if (action === "approve" && (subject !== active.subject || body !== active.body || recipientEmail !== (active.recipientEmail || ""))) {
      throw new Error("Enregistrez l'email avant de valider le dossier.");
    }
    if (action === "approve" && active.sourceChanged) throw new Error("Les documents ont changé : préparez un nouveau dossier.");
    await api(`/api/career/v1/application-packets/${active.id}/decision`, payload({ apiVersion: "v1", revision: active.revision, action, reviewed }));
    await openPacket(active.id);
    await load();
    setMessage(action === "approve" ? "Dossier approuvé pour utilisation manuelle." : "Dossier annulé.");
  });

  const copy = () => run(async () => {
    await navigator.clipboard.writeText(`À / To: ${recipientEmail || "(à compléter)"}\nObjet / Subject: ${subject}\n\n${body}`);
    setMessage("Email copié.");
  });

  const related = packets.filter(item => application && item.jobId === application.jobId);
  const ready = Boolean(application?.cvId && application?.jobId && application.job?.description.trim());

  if (!applicationId) return (
    <main className="mx-auto max-w-4xl space-y-4 py-6">
      <h1 className="text-xl font-semibold">Application Agent</h1>
      <p className="text-sm text-muted-foreground">Ouvrez une candidature pour préparer son dossier sans ressaisir l'offre ou les documents.</p>
      <Button asChild><Link href="/dashboard/applications">Mes candidatures</Link></Button>
    </main>
  );

  return (
    <main className="mx-auto max-w-5xl space-y-5 pb-10">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <Link href={`/dashboard/applications/${encodeURIComponent(applicationId)}?tab=documents`} className="text-xs text-muted-foreground hover:text-foreground">← Retour à la candidature</Link>
          <h1 className="mt-2 text-xl font-semibold">Application Agent</h1>
          {application && <p className="mt-1 text-sm text-muted-foreground">{application.jobTitle} · {application.company}</p>}
        </div>
        {active && <span className="rounded-md bg-muted px-2 py-1 text-xs">{active.status === "READY" ? "Prêt" : active.status === "DRAFT" ? "Brouillon" : "Annulé"}</span>}
      </div>

      <nav role="tablist" aria-label="Préparation de candidature" className="flex gap-1 overflow-x-auto border-b">
        {tabs.map(item => (
          <button type="button" role="tab" key={item.id} aria-selected={tab === item.id} onClick={() => setTab(item.id)}
            className={`shrink-0 border-b-2 px-3 py-2 text-sm ${tab === item.id ? "border-primary font-semibold" : "border-transparent text-muted-foreground"}`}>
            {item.label}
          </button>
        ))}
      </nav>
      {loading && <div role="status" className="h-28 animate-pulse rounded-xl bg-muted" />}
      {error && <p role="alert" className="rounded-md bg-destructive/10 p-3 text-sm text-destructive">{error}</p>}
      {message && <p role="status" className="text-sm text-primary">{message}</p>}

      {!loading && application && tab === "documents" && (
        <div className="space-y-4">
          <div className="grid gap-3 sm:grid-cols-2">
            <ApplicationDocuments kind="resume" selectedId={application.cvId} applicationId={application.id} disabled={busy} onSelect={id => updateDocument("cvId", id)} />
            <ApplicationDocuments kind="letter" selectedId={application.coverLetterId} applicationId={application.id} cvId={application.cvId} jobId={application.jobId} disabled={busy} onSelect={id => updateDocument("coverLetterId", id)} />
          </div>
          <div className="flex flex-wrap items-end justify-between gap-3">
            <label className="space-y-1 text-xs">Langue de l'email
              <select className="block h-9 rounded-md border bg-background px-3 text-sm" value={language} onChange={event => setLanguage(event.target.value as "fr" | "en")}>
                <option value="fr">Français</option>
                <option value="en">English</option>
              </select>
            </label>
            <Button disabled={!ready || busy} onClick={() => void create()}><FileCheck2 className="size-4" /> Préparer le dossier</Button>
          </div>
          {!ready && <p className="text-sm text-muted-foreground">Associez un CV et vérifiez la description de l'offre dans la candidature.</p>}
        </div>
      )}

      {!loading && tab === "email" && (
        <div className="max-w-3xl space-y-4">
          {!active ? <div className="rounded-xl border p-5 text-sm text-muted-foreground">Préparez d'abord votre dossier dans l'onglet Documents.</div> : (
            <>
              <label className="block space-y-1 text-xs">Destinataire (facultatif)
                <Input type="email" disabled={busy || active.status !== "DRAFT"} value={recipientEmail} onChange={event => { setRecipientEmail(event.target.value); setReviewed(false); }} />
              </label>
              <label className="block space-y-1 text-xs">Objet
                <Input maxLength={300} disabled={busy || active.status !== "DRAFT"} value={subject} onChange={event => { setSubject(event.target.value); setReviewed(false); }} />
              </label>
              <label className="block space-y-1 text-xs">Email
                <AutoTextarea disabled={busy || active.status !== "DRAFT"} value={body} onChange={value => { setBody(value); setReviewed(false); }} />
              </label>
              <div className="flex flex-wrap gap-2">
                <Button size="sm" variant="outline" disabled={busy || active.status !== "DRAFT"} onClick={() => void suggest()}><Sparkles className="size-4" /> Améliorer avec l'IA</Button>
                <Button size="sm" variant="outline" disabled={busy || active.status !== "DRAFT"} onClick={() => void save()}><Check className="size-4" /> Enregistrer</Button>
                <Button size="sm" variant="outline" onClick={() => void copy()}><Copy className="size-4" /> Copier</Button>
                <Button size="sm" onClick={() => setTab("approval")}>Suivant</Button>
              </div>
            </>
          )}
        </div>
      )}

      {!loading && tab === "approval" && (
        <div className="max-w-2xl space-y-4 rounded-xl border p-5">
          {!active ? <p className="text-sm text-muted-foreground">Aucun dossier à approuver.</p> : (
            <>
              <h2 className="text-sm font-semibold">Vérification finale</h2>
              <p className="text-sm text-muted-foreground">{application?.jobTitle} · {active.cv.title}</p>
              {active.sourceChanged && <p role="alert" className="text-sm text-destructive">Un document a été modifié. Préparez un nouveau dossier.</p>}
              {active.status === "DRAFT" ? (
                <>
                  <label className="flex items-start gap-2 text-sm">
                    <input type="checkbox" className="mt-1" checked={reviewed} onChange={event => setReviewed(event.target.checked)} />
                    <span>J'ai relu les documents et l'email. L'approbation n'envoie aucune candidature.</span>
                  </label>
                  <div className="flex gap-2">
                    <Button disabled={busy || !reviewed || active.sourceChanged} onClick={() => void decide("approve")}><ClipboardCheck className="size-4" /> Approuver</Button>
                    <Button variant="outline" disabled={busy} onClick={() => void decide("cancel")}>Annuler</Button>
                  </div>
                </>
              ) : <p className="text-sm">{active.status === "READY" ? "Dossier prêt pour utilisation manuelle." : "Dossier annulé."}</p>}
            </>
          )}
        </div>
      )}

      {!loading && tab === "history" && (
        <div className="max-w-3xl space-y-2">
          <div className="flex justify-end"><Button size="sm" variant="ghost" disabled={busy} onClick={() => void run(async () => { await load(); })}><RefreshCw className="size-4" /> Actualiser</Button></div>
          {!related.length && <p className="text-sm text-muted-foreground">Aucun dossier enregistré pour cette offre.</p>}
          {related.map(item => (
            <button key={item.id} type="button" className="flex w-full items-center justify-between gap-3 rounded-lg border p-3 text-left text-sm hover:bg-muted/30" onClick={() => void run(async () => { await openPacket(item.id); setTab("email"); })}>
              <span className="truncate">{item.job.title}</span>
              <span className="text-xs text-muted-foreground">{item.status === "READY" ? "Prêt" : item.status === "DRAFT" ? "Brouillon" : "Annulé"}</span>
            </button>
          ))}
        </div>
      )}
    </main>
  );
}
