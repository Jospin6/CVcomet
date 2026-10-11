"use client";

import { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import { useTranslation } from "react-i18next";
import { Download, Eye, FileText, LoaderCircle, Trash2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle } from "@/components/ui/alert-dialog";
import type { LibraryResume, SavedResume, UploadedResume } from "@/lib/resume-documents";
import { PdfPreview } from "./pdf-preview";

export function useResumeLibrary(enabled = true) {
  const [documents, setDocuments] = useState<LibraryResume[]>([]);
  const [loading, setLoading] = useState(enabled);
  const [error, setError] = useState("");
  const reload = useCallback(async () => {
    if (!enabled) { setDocuments([]); setLoading(false); return; }
    setLoading(true); setError("");
    try {
      const responses = await Promise.all([fetch("/api/resume-documents", { cache: "no-store" }), fetch("/api/cvs?mine=1", { cache: "no-store" })]);
      if (responses.some(response => !response.ok)) throw new Error("LOAD_FAILED");
      const [uploads, resumes] = await Promise.all(responses.map(response => response.json())) as [UploadedResume[], SavedResume[]];
      setDocuments([
        ...uploads.map(document => ({ ...document, source: "upload" as const })),
        ...resumes.map(document => ({ ...document, source: "created" as const })),
      ].sort((a, b) => Date.parse(b.createdAt) - Date.parse(a.createdAt)));
    } catch { setError("LOAD_FAILED"); }
    finally { setLoading(false); }
  }, [enabled]);
  useEffect(() => { void reload(); }, [reload]);
  return { documents, loading, error, reload };
}

function ResumePaper({ document }: { document: LibraryResume }) {
  const { t } = useTranslation();
  if (document.source === "upload") {
    if (document.mimeType === "application/pdf") return <div aria-hidden="true" className="pointer-events-none h-full"><PdfPreview id={document.id} name={document.name} thumbnail /></div>;
    return <div className="document-paper h-full overflow-hidden bg-white p-5"><p className="whitespace-pre-wrap break-words text-[9px] leading-[1.7]">{document.previewText}</p></div>;
  }
  return <div className="document-paper h-full overflow-hidden bg-white p-5 text-[9px] leading-relaxed">
    <h3 className="border-b pb-3 text-center text-xs font-semibold">{document.title}</h3>
    {document.summary?.length > 0 && <section className="mt-4"><h4 className="mb-2 border-b pb-1 font-semibold">{t("summary")}</h4><p>{document.summary.join("\n")}</p></section>}
    {document.experiences?.length ? <section className="mt-4"><h4 className="mb-2 border-b pb-1 font-semibold">{t("experience")}</h4>{document.experiences.slice(0, 3).map((experience, index) => <p key={index} className="mb-2"><b>{experience.title}</b><br />{experience.company}<br />{experience.description?.join(" ")}</p>)}</section> : null}
    {document.educations?.length ? <section className="mt-4"><h4 className="mb-2 border-b pb-1 font-semibold">{t("education")}</h4>{document.educations.slice(0, 2).map((education, index) => <p key={index}>{education.degree} · {education.school}</p>)}</section> : null}
    {!document.summary?.length && !document.experiences?.length && !document.educations?.length && <FileText className="mx-auto mt-16 size-9 text-primary/40" />}
  </div>;
}

export function ResumeCards({ documents, loading, onDeleted }: { documents: LibraryResume[]; loading?: boolean; onDeleted?: () => void }) {
  const { t, i18n } = useTranslation();
  const [selected, setSelected] = useState<LibraryResume | null>(null);
  const [removing, setRemoving] = useState<LibraryResume | null>(null);
  const [deleting, setDeleting] = useState(false);
  const [error, setError] = useState("");
  const remove = async () => {
    if (!removing) return;
    setDeleting(true); setError("");
    try {
      const response = await fetch(`/api/resume-documents/${removing.id}`, { method: "DELETE" });
      if (!response.ok) throw new Error();
      if (selected?.id === removing.id) setSelected(null);
      setRemoving(null); onDeleted?.();
    } catch { setError(t("documents.deleteError")); }
    finally { setDeleting(false); }
  };
  return <>
    {loading ? [0, 1, 2].map(index => <Skeleton key={index} className="h-[350px] rounded-xl" />) : documents.map(document => {
      const title = document.source === "upload" ? document.name : document.title;
      const format = document.source === "upload" ? document.name.split(".").pop()?.toUpperCase() : t("documents.created");
      const preview = <div className="h-64 overflow-hidden border-b bg-muted p-4"><div className="mx-auto h-full max-w-[210px] overflow-hidden rounded-sm border shadow-sm"><ResumePaper document={document} /></div></div>;
      return <article key={`${document.source}-${document.id}`} className="group min-w-0 overflow-hidden rounded-xl border bg-card transition-colors hover:border-primary">
        {document.source === "created" ? <Link href={`/dashboard/resumes/${document.id}`} aria-label={t("documents.openNamed", { name: title })} className="block">{preview}</Link> : <button className="block w-full text-left" onClick={() => setSelected(document)} aria-label={t("documents.openNamed", { name: title })}>{preview}</button>}
        <div className="p-4"><p className="truncate text-sm font-medium" title={title}>{title}</p>
          <div className="mt-1.5 flex items-center gap-2 text-[11px] text-muted-foreground"><span className="rounded border px-1.5 py-0.5">{format}</span><span>{new Date(document.createdAt).toLocaleDateString(i18n.resolvedLanguage)}</span>{document.source === "upload" && <span className="ml-auto">{(document.size / 1024).toFixed(0)} KB</span>}</div>
          <div className="mt-3 flex items-center gap-1 border-t pt-2">
            {document.source === "upload" ? <><Button variant="ghost" size="sm" onClick={() => setSelected(document)}><Eye className="size-3.5" />{t("documents.view")}</Button><Button variant="ghost" size="icon" className="ml-auto size-8" asChild><a href={`/api/resume-documents/${document.id}?download=1`} aria-label={t("documents.downloadNamed", { name: title })}><Download className="size-4" /></a></Button><Button variant="ghost" size="icon" className="size-8 text-muted-foreground hover:text-destructive" onClick={() => { setRemoving(document); setError(""); }} aria-label={t("documents.deleteNamed", { name: title })}><Trash2 className="size-4" /></Button></> : <Button variant="ghost" size="sm" asChild><Link href={`/dashboard/resumes/${document.id}`}><Eye className="size-3.5" />{t("documents.edit")}</Link></Button>}
          </div>
        </div>
      </article>;
    })}
    <Dialog open={Boolean(selected)} onOpenChange={open => { if (!open) setSelected(null); }}>
      <DialogContent className="sm:max-w-4xl">
        <DialogHeader><DialogTitle className="break-words pr-6">{selected?.source === "upload" ? selected.name : ""}</DialogTitle><DialogDescription>{t("documents.originalPreview")}</DialogDescription></DialogHeader>
        {selected?.source === "upload" && <>
          {selected.mimeType === "application/pdf" ? <PdfPreview id={selected.id} name={selected.name} /> : <pre className="h-[62dvh] overflow-auto whitespace-pre-wrap break-words rounded-lg border bg-card p-6 font-sans text-sm leading-7">{selected.previewText}</pre>}
          <div className="flex flex-wrap items-center justify-between gap-3"><p className="text-xs text-muted-foreground">{t("documents.previewHint")}</p><Button asChild><a href={`/api/resume-documents/${selected.id}?download=1`}><Download />{t("documents.download")}</a></Button></div>
        </>}
      </DialogContent>
    </Dialog>
    <AlertDialog open={Boolean(removing)} onOpenChange={open => { if (!open && !deleting) setRemoving(null); }}>
      <AlertDialogContent><AlertDialogHeader><AlertDialogTitle>{t("documents.deleteTitle")}</AlertDialogTitle><AlertDialogDescription className="break-words">{t("documents.deleteDescription", { name: removing?.source === "upload" ? removing.name : "" })}</AlertDialogDescription></AlertDialogHeader>{error && <p role="alert" className="text-sm text-destructive">{error}</p>}<AlertDialogFooter><AlertDialogCancel disabled={deleting}>{t("documents.cancel")}</AlertDialogCancel><AlertDialogAction disabled={deleting} onClick={event => { event.preventDefault(); void remove(); }} className="bg-destructive text-destructive-foreground hover:bg-destructive/90">{deleting && <LoaderCircle className="size-4 animate-spin" />}{t("documents.delete")}</AlertDialogAction></AlertDialogFooter></AlertDialogContent>
    </AlertDialog>
  </>;
}
