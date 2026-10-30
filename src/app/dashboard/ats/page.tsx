"use client";

import { useState } from "react";
import Link from "next/link";
import { useTranslation } from "react-i18next";
import { ArrowRight, FileText } from "lucide-react";

import { useApi } from "@/components/career/data-state";
import { AtsResumePreview, type AtsResumeRecord } from "@/components/resumes/ats-resume-preview";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { PageHeader } from "@/components/ui/page-header";
import { Skeleton } from "@/components/ui/skeleton";

const gridClass =
  "grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-4 " +
  "xl:grid-cols-5 2xl:grid-cols-6 sm:gap-4";

function atsHref(id: string) {
  return `/dashboard/resumes/${encodeURIComponent(id)}?ats=1`;
}

export default function AtsPage() {
  const { i18n } = useTranslation();
  const fr = i18n.resolvedLanguage?.startsWith("fr") ?? false;
  const language = fr ? "fr" : "en";
  const [selected, setSelected] = useState<AtsResumeRecord | null>(null);

  const { data, loading, error, reload } = useApi<AtsResumeRecord[]>(
    "/api/cvs?mine=1",
  );

  const actionLabel = fr
    ? "Vérifier et améliorer ce CV"
    : "Check and improve this resume";

  return (
    <div className="mx-auto max-w-6xl space-y-5 pb-10">
      <PageHeader title="ATS checker" />

      {error && (
        <div role="alert" className="flex flex-wrap items-center gap-3 text-sm text-destructive">
          <span>
            {fr ? "Impossible de charger vos CV." : "Unable to load your resumes."}
          </span>
          <Button size="sm" variant="outline" onClick={() => void reload()}>
            {fr ? "Réessayer" : "Try again"}
          </Button>
        </div>
      )}

      {loading && (
        <div className={gridClass} role="status" aria-label="Loading resumes">
          {[0, 1, 2, 3].map((index) => (
            <Skeleton key={index} className="h-[290px] rounded-xl" />
          ))}
        </div>
      )}

      {!loading && !error && Boolean(data?.length) && (
        <div className={gridClass}>
          {data?.map((resume) => {
            const title =
              resume.design?.documentName ||
              resume.title ||
              (fr ? "Mon CV" : "My resume");

            return (
              <article
                key={resume.id}
                className="min-w-0 overflow-hidden rounded-xl border bg-card transition-shadow hover:shadow-sm"
              >
                <button
                  type="button"
                  className="block w-full bg-muted/40 p-3 text-left focus-visible:outline-2 focus-visible:outline-offset-[-2px] focus-visible:outline-primary"
                  aria-label={fr ? `Aperçu de ${title}` : `Preview ${title}`}
                  onClick={() => setSelected(resume)}
                >
                  <div className="mx-auto h-[210px] max-w-[190px] overflow-hidden bg-white shadow-sm">
                    <AtsResumePreview record={resume} language={language} />
                  </div>
                </button>

                <div className="space-y-3 border-t p-3">
                  <h2 className="truncate text-xs font-medium" title={title}>
                    {title}
                  </h2>
                  <Button asChild size="sm" className="h-auto min-h-9 w-full whitespace-normal py-2 text-center text-[11px] leading-snug">
                    <Link href={atsHref(resume.id)}>
                      {actionLabel}
                      <ArrowRight className="size-3.5 shrink-0" />
                    </Link>
                  </Button>
                </div>
              </article>
            );
          })}
        </div>
      )}

      {!loading && !error && !data?.length && (
        <div className="rounded-xl border bg-card p-8 text-center">
          <FileText className="mx-auto mb-3 size-7 text-muted-foreground" />
          <p className="text-sm text-muted-foreground">
            {fr
              ? "Créez ou importez un CV pour commencer le diagnostic."
              : "Create or import a resume to start your ATS check."}
          </p>
          <Button asChild size="sm" className="mt-4">
            <Link href="/dashboard/resumes">
              {fr ? "Mes documents" : "My documents"}
            </Link>
          </Button>
        </div>
      )}

      <Dialog
        open={selected !== null}
        onOpenChange={(open) => {
          if (!open) setSelected(null);
        }}
      >
        <DialogContent className="w-[calc(100%-1rem)] max-w-[1150px] gap-0 p-0 sm:max-w-[1150px]">
          <DialogHeader className="border-b px-5 py-4 pr-12">
            <DialogTitle>
              {selected?.design?.documentName || selected?.title || "Resume"}
            </DialogTitle>
            <DialogDescription className="sr-only">
              {fr ? "Aperçu complet de votre CV" : "Full preview of your resume"}
            </DialogDescription>
          </DialogHeader>

          {selected && (
            <div className="grid min-w-0 lg:grid-cols-[minmax(0,1fr)_250px]">
              <div className="min-w-0 bg-muted p-3 sm:p-5">
                <AtsResumePreview
                  key={selected.id}
                  record={selected}
                  language={language}
                  large
                />
              </div>
              <aside className="flex flex-col justify-start border-t p-4 lg:border-l lg:border-t-0 lg:p-5">
                <Button asChild className="h-auto min-h-10 w-full whitespace-normal py-3 text-center text-xs">
                  <Link href={atsHref(selected.id)}>
                    {actionLabel}
                    <ArrowRight className="size-4 shrink-0" />
                  </Link>
                </Button>
              </aside>
            </div>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
}
