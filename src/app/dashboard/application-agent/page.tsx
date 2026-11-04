"use client";

import { Suspense, useCallback, useEffect, useRef, useState } from "react";
import Link from "next/link";
import { useTranslation } from "react-i18next";
import { applicationCopy, applicationErrorLabel } from "@/lib/career/application-copy";
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
const tabs: Tab[] = ["documents", "email", "approval", "history"];

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
  const { i18n } = useTranslation();
  const language = i18n.resolvedLanguage?.startsWith("fr") ? "fr" : "en";
  const c = applicationCopy[language];
  const applicationId = useSearchParams().get("applicationId") || "";
  const [application, setApplication] = useState<Application | null>(null);
  const [packets, setPackets] = useState<Brief[]>([]);
  const [active, setActive] = useState<Packet | null>(null);
  const [tab, setTab] = useState<Tab>("documents");
  // The email's composition language may be explicitly changed by the user.
  // Until then, it follows the active application language.
  const [emailLanguageOverride, setEmailLanguageOverride] = useState<"fr" | "en" | null>(null);
  const emailLanguage = emailLanguageOverride ?? language;
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
          if (!response.ok) throw new Error("NOT_FOUND");
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
      if (!cancelled) setError(failure instanceof Error ? failure.message : "LOAD_FAILED");
    }).finally(() => { if (!cancelled) setLoading(false); });
    return () => { cancelled = true; };
  }, [load, openPacket]);

  const run = async (action: () => Promise<void>) => {
    setBusy(true); setError(""); setMessage("");
    try { await action(); }
    catch (failure) { setError(failure instanceof Error ? failure.message : "ACTION_FAILED"); }
    finally { setBusy(false); }
  };

  const updateDocument = async (key: "cvId" | "coverLetterId", value: string | null) => {
    if (!application) throw new Error("APPLICATION_UNAVAILABLE");
    const response = await fetch(`/api/applications/${encodeURIComponent(application.id)}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ [key]: value }),
    });
    if (!response.ok) {
      const data = await response.json().catch(() => ({})) as { error?: string };
      throw new Error(data.error || "DOCUMENT_NOT_LINKED");
    }
    const next = await load();
    setActive(null);
    setReviewed(false);
    requestKeyRef.current = null;
    if (!next.app) throw new Error("NOT_FOUND");
  };

  const create = () => run(async () => {
    if (!application?.jobId || !application.cvId || !application.job?.description.trim()) {
      throw new Error("PACKET_REQUIREMENTS");
    }
    const created = await api<{ packet: { id: string } }>(
      "/api/career/v1/application-packets",
      payload({
        apiVersion: "v1",
        requestKey: (requestKeyRef.current ??= crypto.randomUUID()),
        jobId: application.jobId,
        cvId: application.cvId,
        ...(application.coverLetterId ? { coverLetterId: application.coverLetterId } : {}),
        language: emailLanguage,
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
    setMessage("DRAFT_SAVED");
  });

  const suggest = () => active && run(async () => {
    const next = await api<{ suggestion: { subject: string; body: string } }>(
      `/api/career/v1/application-packets/${active.id}/suggest-email`,
      payload({ apiVersion: "v1", revision: active.revision })
    );
    setSubject(next.suggestion.subject);
    setBody(next.suggestion.body);
    setReviewed(false);
    setMessage("SUGGESTION_REVIEW");
  });

  const decide = (action: "approve" | "cancel") => active && run(async () => {
    if (action === "approve" && (subject !== active.subject || body !== active.body || recipientEmail !== (active.recipientEmail || ""))) {
      throw new Error("SAVE_BEFORE_APPROVAL");
    }
    if (action === "approve" && active.sourceChanged) throw new Error("SOURCE_CHANGED");
    await api(`/api/career/v1/application-packets/${active.id}/decision`, payload({ apiVersion: "v1", revision: active.revision, action, reviewed }));
    await openPacket(active.id);
    await load();
    setMessage(action === "approve" ? "PACKET_APPROVED" : "PACKET_CANCELLED");
  });

  const copy = () => run(async () => {
    await navigator.clipboard.writeText(`${c.to}: ${recipientEmail || c.recipientToComplete}\n${c.subject}: ${subject}\n\n${body}`);
    setMessage("EMAIL_COPIED");
  });

  const related = packets.filter(item => application && item.jobId === application.jobId);
  const ready = Boolean(application?.cvId && application?.jobId && application.job?.description.trim());
  const displayedError = error === "PACKET_REQUIREMENTS" ? c.packetRequirements
    : error === "SAVE_BEFORE_APPROVAL" ? c.saveBeforeApproval
    : error === "SOURCE_CHANGED" ? c.sourceChangedBeforeApproval
    : error === "DOCUMENT_NOT_LINKED" ? c.documentNotLinked
    : error === "APPLICATION_UNAVAILABLE" ? c.applicationUnavailable
    : error === "LOAD_FAILED" ? c.loadingFailed
    : applicationErrorLabel(error, language, c.actionFailed);
  const displayedMessage = message === "DRAFT_SAVED" ? c.draftSaved
    : message === "SUGGESTION_REVIEW" ? c.suggestionReview
    : message === "PACKET_APPROVED" ? c.packetApproved
    : message === "PACKET_CANCELLED" ? c.packetCancelled
    : message === "EMAIL_COPIED" ? c.emailCopied : "";

  if (!applicationId) return (
    <main className="mx-auto max-w-4xl space-y-4 py-6">
      <h1 className="text-xl font-semibold">{c.applicationAgent}</h1>
      <p className="text-sm text-muted-foreground">{c.applicationAgentHint}</p>
      <Button asChild><Link href="/dashboard/applications">{c.applications}</Link></Button>
    </main>
  );

  return (
    <main className="mx-auto max-w-5xl space-y-5 pb-10">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <Link href={`/dashboard/applications/${encodeURIComponent(applicationId)}?tab=documents`} className="text-xs text-muted-foreground hover:text-foreground">← {c.backToApplication}</Link>
          <h1 className="mt-2 text-xl font-semibold">{c.applicationAgent}</h1>
          {application && <p className="mt-1 text-sm text-muted-foreground">{application.jobTitle} · {application.company}</p>}
        </div>
        {active && <span className="rounded-md bg-muted px-2 py-1 text-xs">{active.status === "READY" ? c.ready : active.status === "DRAFT" ? c.draft : c.canceled}</span>}
      </div>

      <nav role="tablist" aria-label={c.preparingApplication} className="flex gap-1 overflow-x-auto border-b">
        {tabs.map(item => (
          <button type="button" role="tab" key={item} aria-selected={tab === item} onClick={() => setTab(item)}
            className={`shrink-0 border-b-2 px-3 py-2 text-sm ${tab === item ? "border-primary font-semibold" : "border-transparent text-muted-foreground"}`}>
            {c[item]}
          </button>
        ))}
      </nav>
      {loading && <div role="status" className="h-28 animate-pulse rounded-xl bg-muted" />}
      {error && <p role="alert" className="rounded-md bg-destructive/10 p-3 text-sm text-destructive">{displayedError}</p>}
      {message && <p role="status" className="text-sm text-primary">{displayedMessage}</p>}

      {!loading && application && tab === "documents" && (
        <div className="space-y-4">
          <div className="grid gap-3 sm:grid-cols-2">
            <ApplicationDocuments kind="resume" selectedId={application.cvId} applicationId={application.id} disabled={busy} onSelect={id => updateDocument("cvId", id)} />
            <ApplicationDocuments kind="letter" selectedId={application.coverLetterId} applicationId={application.id} cvId={application.cvId} jobId={application.jobId} disabled={busy} onSelect={id => updateDocument("coverLetterId", id)} />
          </div>
          <div className="flex flex-wrap items-end justify-between gap-3">
            <label className="space-y-1 text-xs">{c.emailLanguage}
              <select className="block h-9 rounded-md border bg-background px-3 text-sm" value={emailLanguage} onChange={event => setEmailLanguageOverride(event.target.value as "fr" | "en")}>
                <option value="fr">{c.french}</option>
                <option value="en">{c.english}</option>
              </select>
            </label>
            <Button disabled={!ready || busy} onClick={() => void create()}><FileCheck2 className="size-4" /> {c.preparePacket}</Button>
          </div>
          {!ready && <p className="text-sm text-muted-foreground">{c.documentsNeeded}</p>}
        </div>
      )}

      {!loading && tab === "email" && (
        <div className="max-w-3xl space-y-4">
          {!active ? <div className="rounded-xl border p-5 text-sm text-muted-foreground">{c.prepareDocumentsFirst}</div> : (
            <>
              <label className="block space-y-1 text-xs">{c.recipientOptional}
                <Input type="email" disabled={busy || active.status !== "DRAFT"} value={recipientEmail} onChange={event => { setRecipientEmail(event.target.value); setReviewed(false); }} />
              </label>
              <label className="block space-y-1 text-xs">{c.subject}
                <Input maxLength={300} disabled={busy || active.status !== "DRAFT"} value={subject} onChange={event => { setSubject(event.target.value); setReviewed(false); }} />
              </label>
              <label className="block space-y-1 text-xs">Email
                <AutoTextarea disabled={busy || active.status !== "DRAFT"} value={body} onChange={value => { setBody(value); setReviewed(false); }} />
              </label>
              <div className="flex flex-wrap gap-2">
                <Button size="sm" variant="outline" disabled={busy || active.status !== "DRAFT"} onClick={() => void suggest()}><Sparkles className="size-4" /> {c.improveAi}</Button>
                <Button size="sm" variant="outline" disabled={busy || active.status !== "DRAFT"} onClick={() => void save()}><Check className="size-4" /> {c.save}</Button>
                <Button size="sm" variant="outline" onClick={() => void copy()}><Copy className="size-4" /> {c.copy}</Button>
                <Button size="sm" onClick={() => setTab("approval")}>{c.next}</Button>
              </div>
            </>
          )}
        </div>
      )}

      {!loading && tab === "approval" && (
        <div className="max-w-2xl space-y-4 rounded-xl border p-5">
          {!active ? <p className="text-sm text-muted-foreground">{c.noPacket}</p> : (
            <>
              <h2 className="text-sm font-semibold">{c.finalReview}</h2>
              <p className="text-sm text-muted-foreground">{application?.jobTitle} · {active.cv.title}</p>
              {active.sourceChanged && <p role="alert" className="text-sm text-destructive">{c.sourceChanged}</p>}
              {active.status === "DRAFT" ? (
                <>
                  <label className="flex items-start gap-2 text-sm">
                    <input type="checkbox" className="mt-1" checked={reviewed} onChange={event => setReviewed(event.target.checked)} />
                    <span>{c.reviewedConfirmation}</span>
                  </label>
                  <div className="flex gap-2">
                    <Button disabled={busy || !reviewed || active.sourceChanged} onClick={() => void decide("approve")}><ClipboardCheck className="size-4" /> {c.approve}</Button>
                    <Button variant="outline" disabled={busy} onClick={() => void decide("cancel")}>{c.cancel}</Button>
                  </div>
                </>
              ) : <p className="text-sm">{active.status === "READY" ? c.packetReady : c.packetCanceled}</p>}
            </>
          )}
        </div>
      )}

      {!loading && tab === "history" && (
        <div className="max-w-3xl space-y-2">
          <div className="flex justify-end"><Button size="sm" variant="ghost" disabled={busy} onClick={() => void run(async () => { await load(); })}><RefreshCw className="size-4" /> {c.refresh}</Button></div>
          {!related.length && <p className="text-sm text-muted-foreground">{c.noSavedPacket}</p>}
          {related.map(item => (
            <button key={item.id} type="button" className="flex w-full items-center justify-between gap-3 rounded-lg border p-3 text-left text-sm hover:bg-muted/30" onClick={() => void run(async () => { await openPacket(item.id); setTab("email"); })}>
              <span className="truncate">{item.job.title}</span>
              <span className="text-xs text-muted-foreground">{item.status === "READY" ? c.ready : item.status === "DRAFT" ? c.draft : c.canceled}</span>
            </button>
          ))}
        </div>
      )}
    </main>
  );
}
