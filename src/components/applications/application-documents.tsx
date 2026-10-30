"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { Check, Eye, FilePlus2, LoaderCircle, Pencil, Plus } from "lucide-react";
import { AtsResumePreview, type AtsResumeRecord } from "@/components/resumes/ats-resume-preview";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog";

type Letter = {
  id: string;
  positionTitle: string | null;
  companyName: string | null;
  introduction: string;
  body: string;
  conclusion: string;
  cvId: string | null;
  jobId: string | null;
};
export type ApplicationDocumentKind = "resume" | "letter";

type Props = {
  kind: ApplicationDocumentKind;
  selectedId?: string | null;
  applicationId: string;
  onSelect: (id: string | null) => Promise<void>;
  disabled?: boolean;
  cvId?: string | null;
  jobId?: string | null;
};

const getTitle = (item: AtsResumeRecord | Letter, kind: ApplicationDocumentKind) =>
  kind === "resume"
    ? (item as AtsResumeRecord).design?.documentName || (item as AtsResumeRecord).title || "CV"
    : (item as Letter).positionTitle || (item as Letter).companyName || "Lettre de motivation";

function LetterPaper({ letter, large = false }: { letter: Letter; large?: boolean }) {
  return (
    <div className={`mx-auto bg-white text-slate-900 ${large ? "max-w-xl p-8 text-sm shadow-sm" : "h-52 overflow-hidden p-3 text-[7px]"}`}>
      <div className="mb-3 h-px bg-slate-200" />
      <p className="mb-2 font-semibold">{letter.positionTitle || "Lettre de motivation"}</p>
      {[letter.introduction, letter.body, letter.conclusion].filter(Boolean).map((part, index) => (
        <p key={index} className="mb-3 whitespace-pre-line leading-relaxed">{part}</p>
      ))}
      {!letter.introduction && !letter.body && !letter.conclusion && (
        <p className="text-slate-400">Lettre vierge</p>
      )}
    </div>
  );
}

/** Reuses the real CV canvas and saved cover letter content, never sample documents. */
export function ApplicationDocuments({ kind, selectedId, applicationId, onSelect, disabled = false, cvId, jobId }: Props) {
  const [items, setItems] = useState<Array<AtsResumeRecord | Letter>>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [open, setOpen] = useState(false);
  const [previewId, setPreviewId] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    const controller = new AbortController();
    setLoading(true);
    const path = kind === "resume" ? "/api/cvs?mine=1" : "/api/cover-letters";
    void fetch(path, { signal: controller.signal, cache: "no-store" })
      .then(async response => {
        if (!response.ok) throw new Error("Documents indisponibles.");
        const data: unknown = await response.json();
        if (!Array.isArray(data)) throw new Error("Format de réponse invalide.");
        if (!controller.signal.aborted) setItems(data as Array<AtsResumeRecord | Letter>);
      })
      .catch(() => { if (!controller.signal.aborted) setError("Impossible de charger les documents."); })
      .finally(() => { if (!controller.signal.aborted) setLoading(false); });
    return () => controller.abort();
  }, [kind, selectedId]);

  const compatible = kind === "letter"
    ? items.filter(item => {
        const letter = item as Letter;
        return (!letter.cvId || letter.cvId === cvId)
          && (!letter.jobId || letter.jobId === jobId);
      })
    : items;
  const selected = items.find(item => item.id === selectedId);
  const preview = items.find(item => item.id === previewId);
  const label = kind === "resume" ? "CV" : "Lettre de motivation";
  const createHref = kind === "resume"
    ? `/dashboard/resumes?tab=resumes&applicationId=${encodeURIComponent(applicationId)}`
    : `/dashboard/cover-letters?applicationId=${encodeURIComponent(applicationId)}`;

  const choose = async (id: string | null) => {
    setBusy(true); setError("");
    try {
      await onSelect(id);
      setOpen(false);
      setPreviewId(null);
    } catch (failure) {
      setError(failure instanceof Error ? failure.message : "Sélection impossible.");
    } finally {
      setBusy(false);
    }
  };

  const renderPreview = (item: AtsResumeRecord | Letter, large: boolean) =>
    kind === "resume" ? (
      <AtsResumePreview record={item as AtsResumeRecord} large={large} language="fr" />
    ) : (
      <LetterPaper letter={item as Letter} large={large} />
    );

  return (
    <>
      <div className="min-w-0 rounded-xl border bg-card p-3">
        <div className="mb-2 flex items-center justify-between gap-2">
          <span className="text-sm font-medium">{label}</span>
          <Button size="sm" variant="ghost" onClick={() => setOpen(true)} disabled={disabled}>
            {selectedId ? <Pencil className="size-3.5" /> : <Plus className="size-3.5" />}
            {selectedId ? "Changer" : "Ajouter"}
          </Button>
        </div>
        {selected ? (
          <div className="flex items-center gap-3">
            <button type="button" onClick={() => setPreviewId(selected.id)} className="h-32 w-24 shrink-0 overflow-hidden rounded-md border bg-muted/20" aria-label={`Agrandir ${getTitle(selected, kind)}`}>
              {renderPreview(selected, false)}
            </button>
            <div className="min-w-0 space-y-2">
              <p className="truncate text-sm font-medium">{getTitle(selected, kind)}</p>
              <Button variant="outline" size="sm" onClick={() => setPreviewId(selected.id)}><Eye className="size-3.5" /> Aperçu</Button>
            </div>
          </div>
        ) : selectedId && loading ? (
          <LoaderCircle className="size-4 animate-spin text-muted-foreground" />
        ) : (
          <button type="button" disabled={disabled} onClick={() => setOpen(true)} className="flex min-h-28 w-full items-center justify-center gap-2 rounded-md border border-dashed text-sm text-muted-foreground hover:border-primary hover:text-foreground">
            <FilePlus2 className="size-4" /> Choisir {kind === "resume" ? "un CV" : "une lettre"}
          </button>
        )}
      </div>

      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="max-h-[90dvh] max-w-4xl overflow-y-auto">
          <DialogHeader>
            <DialogTitle>Choisir {kind === "resume" ? "un CV" : "une lettre"}</DialogTitle>
            <DialogDescription className="sr-only">Sélection visuelle des documents de votre compte.</DialogDescription>
          </DialogHeader>
          {error && <p role="alert" className="text-sm text-destructive">{error}</p>}
          {loading && <p className="text-sm text-muted-foreground">Chargement…</p>}
          <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 md:grid-cols-4">
            {compatible.map(item => (
              <div key={item.id} className={`overflow-hidden rounded-lg border ${selectedId === item.id ? "border-primary ring-1 ring-primary/40" : ""}`}>
                <button type="button" onClick={() => setPreviewId(item.id)} className="block h-44 w-full overflow-hidden bg-muted/20 p-1" aria-label={`Voir ${getTitle(item, kind)}`}>
                  {renderPreview(item, false)}
                </button>
                <p className="truncate px-2 py-1.5 text-xs" title={getTitle(item, kind)}>{getTitle(item, kind)}</p>
                <Button size="sm" variant={selectedId === item.id ? "secondary" : "outline"} className="m-1.5 h-8 w-[calc(100%-0.75rem)]" disabled={busy} onClick={() => void choose(item.id)}>
                  {selectedId === item.id && <Check className="size-3.5" />}
                  {selectedId === item.id ? "Sélectionné" : "Sélectionner"}
                </Button>
              </div>
            ))}
            <Link href={createHref} className="flex min-h-48 flex-col items-center justify-center gap-2 rounded-lg border border-dashed text-sm hover:border-primary">
              <Plus className="size-5" /> Créer un document
            </Link>
          </div>
          {selectedId && <Button size="sm" variant="ghost" disabled={busy} onClick={() => void choose(null)}>Dissocier {label.toLowerCase()}</Button>}
        </DialogContent>
      </Dialog>

      <Dialog open={Boolean(preview)} onOpenChange={value => { if (!value) setPreviewId(null); }}>
        <DialogContent className="max-h-[94dvh] max-w-3xl overflow-y-auto">
          <DialogHeader>
            <DialogTitle>{preview ? getTitle(preview, kind) : label}</DialogTitle>
            <DialogDescription className="sr-only">Aperçu agrandi du document.</DialogDescription>
          </DialogHeader>
          {preview && <div className="max-h-[69dvh] overflow-auto">{renderPreview(preview, true)}</div>}
          {preview && <div className="flex justify-end gap-2">
            <Button variant="outline" onClick={() => setPreviewId(null)}>Fermer</Button>
            <Button disabled={busy} onClick={() => void choose(preview.id)}><Check className="size-4" /> Sélectionner</Button>
          </div>}
        </DialogContent>
      </Dialog>
    </>
  );
}
