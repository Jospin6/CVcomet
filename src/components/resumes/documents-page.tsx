"use client";

import { useRef, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useTranslation } from "react-i18next";
import { ArrowUpRight, CheckCircle2, ContactRound, FilePlus2, FileText, FolderOpen, LoaderCircle, Mail, PanelsTopLeft, Upload } from "lucide-react";
import { Button } from "@/components/ui/button";
import { PageHeader } from "@/components/ui/page-header";
import { ResumeCards, useResumeLibrary } from "./resume-library";
import { RESUME_ACCEPT, validateResumeSelection } from "@/lib/resume-documents";

export function DocumentsPage() {
  const { t } = useTranslation();
  const router = useRouter();
  const input = useRef<HTMLInputElement>(null);
  const uploadLock = useRef(false);
  const { documents, loading, error: loadError, reload } = useResumeLibrary();
  const [busy, setBusy] = useState(false);
  const [creating, setCreating] = useState(false);
  const [dragging, setDragging] = useState(false);
  const [pending, setPending] = useState<string[]>([]);
  const [error, setError] = useState("");
  const [message, setMessage] = useState("");
  const upload = async (files: File[]) => {
    if (uploadLock.current || creating) return;
    setError(""); setMessage("");
    const invalid = validateResumeSelection(files);
    if (invalid) { setError(t("documents.errors." + invalid)); return; }
    uploadLock.current = true; setBusy(true); setPending(files.map(file => file.name));
    try {
      const form = new FormData(); files.forEach(file => form.append("resumes", file));
      const response = await fetch("/api/resume-documents", { method: "POST", body: form });
      if (!response.ok) { const result = await response.json().catch(() => ({})); throw new Error(result.error || "UPLOAD_FAILED"); }
      setMessage(t("documents.uploadSuccess", { count: files.length })); await reload();
    } catch (cause) {
      const code = cause instanceof Error ? cause.message : "UPLOAD_FAILED";
      setError(t("documents.errors." + code, { defaultValue: t("documents.errors.UPLOAD_FAILED") }));
    } finally { uploadLock.current = false; setBusy(false); setPending([]); if (input.current) input.current.value = ""; }
  };
  const create = async (source: "PROFILE" | "SCRATCH") => {
    if (busy || creating) return;
    setCreating(true); setError(""); setMessage("");
    try {
      const response = await fetch("/api/cvs", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ source }) });
      if (!response.ok) throw new Error();
      const resume = await response.json(); router.push(`/dashboard/resumes/${resume.id}`);
    } catch { setError(t("documents.createError")); setCreating(false); }
  };
  return <div className="space-y-6">
    <PageHeader eyebrow={t("shell.workspace")} title={t("documents.title")} description={t("documents.description")} action={<Button disabled={busy || creating} onClick={() => input.current?.click()}><Upload />{t("documents.upload")}</Button>} />
    <nav aria-label={t("documents.tabs")} className="flex gap-6 overflow-x-auto border-b text-sm"><span aria-current="page" className="flex shrink-0 items-center gap-2 border-b-2 border-primary pb-3 font-medium text-primary"><FileText className="size-4" />{t("shell.resumes")}<span className="rounded-md bg-primary/10 px-1.5 text-xs">{documents.length}</span></span><Link href="/dashboard/cover-letters" className="flex shrink-0 items-center gap-2 pb-3 text-muted-foreground hover:text-foreground"><Mail className="size-4" />{t("shell.coverLetters")}</Link></nav>
    <input ref={input} id="resume-documents-input" type="file" multiple accept={RESUME_ACCEPT} className="sr-only" tabIndex={-1} aria-label={t("documents.upload")} onChange={event => { const files = Array.from(event.target.files || []); event.target.value = ""; if (files.length) void upload(files); }} />
    {error && <p role="alert" className="rounded-lg border border-destructive/25 bg-destructive/5 p-4 text-sm text-destructive">{error}</p>}
    {message && <p role="status" className="flex items-center gap-2 rounded-lg border bg-primary/5 p-4 text-sm text-primary"><CheckCircle2 className="size-4 shrink-0" />{message}</p>}
    <div className="grid items-start gap-5 sm:grid-cols-2 xl:grid-cols-3 2xl:grid-cols-4">
      <section aria-label={t("documents.add")} className={`min-w-0 rounded-xl border border-dashed p-5 transition-colors ${dragging ? "border-primary bg-primary/10" : "border-primary/40 bg-card"}`} onDragOver={event => { event.preventDefault(); if (!busy && !creating) setDragging(true); }} onDragLeave={event => { if (!event.currentTarget.contains(event.relatedTarget as Node | null)) setDragging(false); }} onDrop={event => { event.preventDefault(); setDragging(false); void upload(Array.from(event.dataTransfer.files)); }}>
        <button type="button" disabled={busy || creating} className="flex w-full flex-col items-center rounded-lg px-2 py-5 text-center disabled:opacity-60" onClick={() => input.current?.click()}>
          <span className="mb-4 flex size-12 items-center justify-center rounded-xl bg-primary/10 text-primary">{busy ? <LoaderCircle className="size-6 animate-spin" /> : <Upload className="size-6" />}</span>
          <span className="font-semibold text-primary">{t(busy ? "documents.uploading" : "documents.upload")}</span><span className="mt-2 max-w-52 text-xs leading-5 text-muted-foreground">{t("documents.dropHint")}</span><span className="mt-3 text-[10px] text-muted-foreground">{t("documents.formats")}</span>
        </button>
        {pending.length > 0 && <ul aria-live="polite" className="mb-3 space-y-1 text-xs text-muted-foreground">{pending.map((name, index) => <li key={index} className="truncate">{name}</li>)}</ul>}
        <div className="space-y-1 border-t pt-3">
          <Button variant="ghost" disabled={busy || creating} className="h-auto w-full justify-start whitespace-normal py-3 text-left" onClick={() => void create("PROFILE")}><ContactRound className="text-primary" />{t("documents.fromProfile")}</Button>
          <Button variant="ghost" disabled={busy || creating} className="h-auto w-full justify-start whitespace-normal py-3 text-left" onClick={() => void create("SCRATCH")}><FilePlus2 className="text-primary" />{t("documents.fromScratch")}</Button>
          <Button variant="ghost" asChild className="h-auto w-full justify-start whitespace-normal py-3 text-left"><Link href="/templates"><PanelsTopLeft className="text-primary" />{t("documents.useTemplate")}<ArrowUpRight className="ml-auto" /></Link></Button>
        </div>
      </section>
      {loadError ? <div role="alert" className="app-section"><p className="text-sm text-muted-foreground">{t("shell.loadError")}</p><Button variant="outline" className="mt-4" onClick={() => void reload()}>{t("shell.retry")}</Button></div> : <ResumeCards documents={documents} loading={loading} onDeleted={() => void reload()} />}
      {!loading && !loadError && !documents.length && <div className="flex min-h-[350px] flex-col items-center justify-center rounded-xl border bg-muted/30 p-7 text-center sm:col-span-1 xl:col-span-2 2xl:col-span-3"><FolderOpen className="mb-4 size-8 text-primary/60" /><h2 className="type-h2">{t("documents.emptyTitle")}</h2><p className="mt-2 max-w-sm text-sm leading-6 text-muted-foreground">{t("documents.emptyDescription")}</p></div>}
    </div>
  </div>;
}
