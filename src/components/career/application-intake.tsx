"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { useTranslation } from "react-i18next";
import { ArrowRight, Check, LoaderCircle, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { JobAnalysisForm, jobRequest, useJobAnalysisForm } from "@/components/career/job-analysis-form";

type AnalyzedJob = {
  job: { id: string; title: string; company: string | null; location: string | null };
};

const copy = {
  fr: {
    question: "Quelle offre d’emploi souhaitez-vous préparer ?",
    hint: "Ajoutez l’URL, le texte ou un document. Votre profil professionnel sera utilisé automatiquement.",
    analyze: "Analyser cette offre",
    review: "Vérifiez l’offre détectée",
    create: "Créer ma candidature",
    creating: "Création…",
    existing: "Cette candidature existe déjà. Ouverture du dossier…",
    close: "Fermer",
    failed: "Impossible de créer ce dossier. Réessayez.",
  },
  en: {
    question: "Which job would you like to prepare for?",
    hint: "Add a URL, the text, or a document. Your career profile will be used automatically.",
    analyze: "Analyze this job",
    review: "Review the detected job",
    create: "Create my application",
    creating: "Creating…",
    existing: "This application already exists. Opening its workspace…",
    close: "Close",
    failed: "We could not create this workspace. Please try again.",
  },
} as const;

export function ApplicationIntake({ onClose }: { onClose: () => void }) {
  const router = useRouter();
  const { i18n } = useTranslation();
  const language = i18n.resolvedLanguage?.startsWith("fr") ? "fr" : "en";
  const c = copy[language];
  const [job, setJob] = useState<AnalyzedJob | null>(null);
  const [creating, setCreating] = useState(false);
  const [error, setError] = useState("");
  const form = useJobAnalysisForm<AnalyzedJob>({
    language,
    onTextChanged: () => { setJob(null); setError(""); },
    onExtracted: () => { setJob(null); setError(""); },
    onAnalyzed: (result) => { setJob(result); setError(""); },
  });

  const create = async () => {
    if (!job || creating) return;
    if (!form.cvId) { setError(language === "fr" ? "Sélectionnez un CV pour cette candidature." : "Select a resume for this application."); return; }
    setCreating(true); setError("");
    try {
      const response = await fetch("/api/applications", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ jobId: job.job.id, cvId: form.cvId, reopenExisting: true }),
      });
      const result = await response.json().catch(() => null) as { id?: string; error?: string; reused?: boolean } | null;
      if (!response.ok || !result?.id) throw new Error(result?.error || "CREATE_FAILED");
      if (result.reused) setError("EXISTING");
      router.push(`/dashboard/applications/${encodeURIComponent(result.id)}`);
    } catch {
      setError("CREATE_FAILED"); setCreating(false);
    }
  };

  return <section id="application-create" className="ux-surface ux-enter p-4 sm:p-5" aria-label={c.question}>
    <div className="mb-5 flex items-start justify-between gap-3 border-b pb-4">
      <div><h2 className="text-base font-semibold">{c.question}</h2><p className="mt-1 text-xs text-muted-foreground">{c.hint}</p></div>
      <Button size="icon" variant="ghost" onClick={onClose} aria-label={c.close}><X className="size-4" /></Button>
    </div>
    <JobAnalysisForm form={form} showResumeSelection={true} analyzeLabel={c.analyze} />
    {job && <div className="mt-5 flex flex-wrap items-center justify-between gap-4 border-t bg-primary/[0.03] px-4 py-3">
      <div className="min-w-0"><p className="text-[11px] font-medium uppercase tracking-[0.1em] text-muted-foreground">{c.review}</p><p className="mt-1 truncate text-sm font-semibold">{job.job.title}</p><p className="truncate text-xs text-muted-foreground">{[job.job.company, job.job.location].filter(Boolean).join(" · ")}</p></div>
      <Button disabled={creating || !form.cvId} onClick={() => void create()}>{creating ? <LoaderCircle className="size-4 animate-spin" /> : <Check className="size-4" />}{creating ? c.creating : c.create}<ArrowRight className="size-4" /></Button>
    </div>}
    {error && <p role={error === "EXISTING" ? "status" : "alert"} className={error === "EXISTING" ? "mt-3 text-xs text-primary" : "mt-3 text-xs text-destructive"}>{error === "EXISTING" ? c.existing : error === "CREATE_FAILED" ? c.failed : error}</p>}
  </section>;
}
