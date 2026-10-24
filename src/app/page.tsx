"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useTranslation } from "react-i18next";
import { ArrowUpRight, FileText, LoaderCircle, Upload } from "lucide-react";
import { CareerCommandCenter } from "@/components/career/career-command-center";
import { useCurrentUser } from "@/hooks/useCurrentUser";
import { Button } from "@/components/ui/button";
import { SectionHeader } from "@/components/ui/page-header";
import { EmptyState } from "@/components/ui/empty-state";
import { ResumeCards, useResumeLibrary } from "@/components/resumes/resume-library";
import { JobAnalysisForm, useJobAnalysisForm } from "@/components/career/job-analysis-form";

export default function Overview() {
  const { t, i18n } = useTranslation();
  const router = useRouter();
  const jobForm = useJobAnalysisForm<{ id: string }>({
    language: i18n.resolvedLanguage?.startsWith("fr") ? "fr" : "en",
    onAnalyzed: data => router.push("/dashboard/job-match?analysis=" + encodeURIComponent(data.id)),
  });
  const { user: session } = useCurrentUser();
  const { documents, loading, error, reload } = useResumeLibrary(Boolean(session?.id));
  const documentHref = session ? "/dashboard/resumes" : "/login";
  return <div className="mx-auto max-w-6xl space-y-5 pb-10">
    <div className="flex items-center justify-end"><Button size="sm" variant="outline" asChild><Link href={documentHref}><Upload className="size-4" />{t("documents.upload")}</Link></Button></div>
    <CareerCommandCenter signedIn={Boolean(session?.id)} resumes={error ? null : documents.length} resumesPending={loading} />
    <details className="rounded-xl border bg-card" id="overview-analyze">
      <summary className="cursor-pointer list-none px-4 py-3 text-sm font-semibold">{jobForm.c.title} <span className="ml-2 text-primary">+</span></summary>
      <div className="space-y-3 border-t p-4">
        {jobForm.error && <p role="alert" className="text-sm text-destructive">{jobForm.errorText}</p>}
        {jobForm.busy && <p role="status" className="flex items-center gap-2 text-sm text-muted-foreground"><LoaderCircle className="size-4 animate-spin"/> {jobForm.c.working}</p>}
        <JobAnalysisForm form={jobForm} />
      </div>
    </details>
    <details className="rounded-xl border bg-card">
      <summary className="cursor-pointer list-none px-4 py-3 text-sm font-semibold">{t("documents.recent")} <span className="ml-2 text-primary">+</span></summary>
      <section className="border-t p-4">
        <SectionHeader title={t("documents.recent")} action={<Button size="sm" variant="ghost" asChild><Link href={documentHref}>{t("documents.viewAll")}<ArrowUpRight/></Link></Button>}/>
        {error ? <div role="alert" className="text-sm text-muted-foreground">{t("shell.loadError")} <Button variant="outline" size="sm" onClick={() => void reload()}>{t("shell.retry")}</Button></div>
          : loading || documents.length ? <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-3"><ResumeCards documents={documents.slice(0,3)} loading={loading} onDeleted={() => void reload()}/></div>
          : <EmptyState icon={FileText} title={t("documents.emptyTitle")} description={t("documents.emptyDescription")} action={<Button size="sm" asChild><Link href={documentHref}>{t("documents.upload")}</Link></Button>}/>}
      </section>
    </details>
  </div>;
}
