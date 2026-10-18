"use client";

import { useEffect, useRef, useState, type FormEvent } from "react";
import { useTranslation } from "react-i18next";
import { FileText, Linkedin, LoaderCircle, Type } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { MAX_LINKEDIN_TEXT, normalizeLinkedInUrl } from "@/lib/linkedin";
import { MAX_RESUME_SIZE } from "@/lib/resume-documents";

type Mode = "url" | "pdf" | "text";

export function LinkedInImportDialog({ open, onOpenChange, onImported }: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onImported: (id: string) => void;
}) {
  const { t, i18n } = useTranslation();
  const [mode, setMode] = useState<Mode>("pdf");
  const [url, setUrl] = useState("");
  const [text, setText] = useState("");
  const [file, setFile] = useState<File | null>(null);
  const [available, setAvailable] = useState<boolean | null>(null);
  const [checking, setChecking] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const lock = useRef(false);

  useEffect(() => {
    if (!open) return;
    const controller = new AbortController();
    setError(""); setChecking(true); setAvailable(null);
    fetch("/api/resume-documents/linkedin", { cache: "no-store", signal: controller.signal })
      .then(async response => {
        if (!response.ok) throw new Error(response.status === 401 ? "UNAUTHORIZED" : "LINKEDIN_UNAVAILABLE");
        const result = await response.json();
        if (!controller.signal.aborted) setAvailable(result.urlImportAvailable === true);
      })
      .catch(cause => { if (!controller.signal.aborted) setError(cause instanceof Error ? cause.message : "LINKEDIN_UNAVAILABLE"); })
      .finally(() => { if (!controller.signal.aborted) setChecking(false); });
    return () => controller.abort();
  }, [open]);

  const submit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (lock.current) return;
    setError("");
    let body: BodyInit;
    const headers: Record<string, string> = { "Accept-Language": i18n.resolvedLanguage || "en" };
    if (mode === "pdf") {
      if (!file || !file.size) { setError("INVALID_FILE"); return; }
      if (file.size > MAX_RESUME_SIZE) { setError("TOO_LARGE"); return; }
      if (!file.name.toLowerCase().endsWith(".pdf") || !["", "application/pdf"].includes(file.type)) { setError("INVALID_TYPE"); return; }
      const form = new FormData(); form.append("profile", file); body = form;
    } else {
      headers["Content-Type"] = "application/json";
      if (mode === "url") {
        const normalized = normalizeLinkedInUrl(url);
        if (!normalized) { setError("LINKEDIN_INVALID_URL"); return; }
        if (!available) { setError("LINKEDIN_NOT_CONFIGURED"); return; }
        body = JSON.stringify({ source: "url", url: normalized });
      } else {
        if (text.trim().length < 40 || text.length > MAX_LINKEDIN_TEXT) { setError("TEXT_LENGTH"); return; }
        body = JSON.stringify({ source: "text", text: text.trim() });
      }
    }
    lock.current = true; setBusy(true);
    try {
      const response = await fetch("/api/resume-documents/linkedin", { method: "POST", headers, body });
      const result = await response.json().catch(() => ({}));
      if (!response.ok) throw new Error(result.error || "IMPORT_FAILED");
      if (typeof result.id !== "string" || !result.id) throw new Error("IMPORT_FAILED");
      onImported(result.id);
    } catch (cause) { setError(cause instanceof Error ? cause.message : "IMPORT_FAILED"); }
    finally { lock.current = false; setBusy(false); }
  };
  const errorMessage = error ? t(`linkedinImport.errors.${error}`, { defaultValue: t(`career.errors.${error}`, { defaultValue: t("linkedinImport.errors.IMPORT_FAILED") }) }) : "";

  return <Dialog open={open} onOpenChange={value => { if (!lock.current) onOpenChange(value); }}>
    <DialogContent className="sm:max-w-xl">
      <DialogHeader>
        <span className="mb-2 flex size-11 items-center justify-center rounded-xl bg-[#0A66C2]/10 text-[#0A66C2]"><Linkedin className="size-5" /></span>
        <DialogTitle>{t("linkedinImport.title")}</DialogTitle>
        <DialogDescription className="leading-6">{t("linkedinImport.description")}</DialogDescription>
      </DialogHeader>
      <div role="group" aria-label={t("linkedinImport.method")} className="grid grid-cols-3 gap-1 rounded-lg bg-muted p-1">
        {([{ value: "url", icon: Linkedin }, { value: "pdf", icon: FileText }, { value: "text", icon: Type }] as const).map(({ value, icon: Icon }) => <Button key={value} type="button" size="sm" variant={mode === value ? "secondary" : "ghost"} aria-pressed={mode === value} disabled={busy} className={`min-w-0 gap-1 px-1 text-xs sm:gap-2 sm:px-2 sm:text-sm ${mode === value ? "bg-background shadow-sm" : ""}`} onClick={() => { setMode(value); setError(""); }}><Icon className="hidden size-3.5 shrink-0 sm:block" /><span className="truncate">{t(`linkedinImport.${value}Tab`)}</span></Button>)}
      </div>
      <form onSubmit={event => void submit(event)} className="space-y-5" aria-busy={busy}>
        {mode === "url" && <div className="space-y-3">
          <label htmlFor="linkedin-profile-url" className="block text-sm font-medium">{t("linkedinImport.urlLabel")}</label>
          <Input id="linkedin-profile-url" name="url" inputMode="url" autoCapitalize="none" autoCorrect="off" placeholder="https://www.linkedin.com/in/your-name/" maxLength={2048} required disabled={busy} value={url} onChange={event => setUrl(event.target.value)} aria-describedby="linkedin-url-hint" />
          <p id="linkedin-url-hint" className="text-xs leading-5 text-muted-foreground">{t("linkedinImport.urlHint")}</p>
          {checking ? <p role="status" className="flex items-center gap-2 text-sm text-muted-foreground"><LoaderCircle className="size-4 animate-spin" />{t("linkedinImport.checking")}</p> : available === false && <div role="status" className="rounded-lg border bg-muted/40 p-3 text-sm leading-6"><p>{t("linkedinImport.urlUnavailable")}</p><div className="mt-2 flex flex-wrap gap-2"><Button type="button" variant="outline" size="sm" onClick={() => { setMode("pdf"); setError(""); }}>{t("linkedinImport.pdfAlternative")}</Button><Button type="button" variant="ghost" size="sm" onClick={() => { setMode("text"); setError(""); }}>{t("linkedinImport.textAlternative")}</Button></div></div>}
        </div>}
        {mode === "pdf" && <div className="space-y-3">
          <label htmlFor="linkedin-profile-pdf" className="block text-sm font-medium">{t("linkedinImport.pdfLabel")}</label>
          <p id="linkedin-pdf-hint" className="text-sm leading-6 text-muted-foreground">{t("linkedinImport.pdfHint")}</p>
          <Input id="linkedin-profile-pdf" name="profile" type="file" accept=".pdf,application/pdf" disabled={busy} aria-describedby="linkedin-pdf-hint linkedin-pdf-limit" className="h-auto cursor-pointer py-3 file:mr-3 file:rounded file:border-0 file:bg-primary/10 file:px-3 file:py-1 file:text-primary" onChange={event => { setFile(event.target.files?.[0] || null); setError(""); }} />
          <p id="linkedin-pdf-limit" className="text-xs text-muted-foreground">{t("linkedinImport.pdfLimit")}</p>
          {file && <p className="break-words text-sm">{file.name}</p>}
        </div>}
        {mode === "text" && <div className="space-y-3">
          <label htmlFor="linkedin-profile-text" className="block text-sm font-medium">{t("linkedinImport.textLabel")}</label>
          <p id="linkedin-text-hint" className="text-sm leading-6 text-muted-foreground">{t("linkedinImport.textHint")}</p>
          <Textarea id="linkedin-profile-text" name="text" rows={9} minLength={40} maxLength={MAX_LINKEDIN_TEXT} required disabled={busy} value={text} onChange={event => setText(event.target.value)} aria-describedby="linkedin-text-hint" placeholder={t("linkedinImport.textPlaceholder")} />
        </div>}
        {error && <p role="alert" className="rounded-lg border border-destructive/25 bg-destructive/5 p-3 text-sm leading-6 text-destructive">{errorMessage}</p>}
        <p className="border-t pt-3 text-xs leading-5 text-muted-foreground">{t("linkedinImport.reviewHint")}</p>
        <DialogFooter>
          <Button type="button" variant="outline" disabled={busy} onClick={() => onOpenChange(false)}>{t("documents.cancel")}</Button>
          <Button type="submit" disabled={busy || (mode === "pdf" && !file) || (mode === "text" && text.trim().length < 40) || (mode === "url" && (checking || !available || !url.trim()))}>
            {busy ? <LoaderCircle className="size-4 animate-spin" /> : <FileText className="size-4" />}{t(busy ? "linkedinImport.importing" : "linkedinImport.submit")}
          </Button>
        </DialogFooter>
        {busy && <p role="status" className="text-center text-xs text-muted-foreground">{t("linkedinImport.progress")}</p>}
      </form>
    </DialogContent>
  </Dialog>;
}
