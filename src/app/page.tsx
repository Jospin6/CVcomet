"use client";

import { useEffect } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useDispatch, useSelector } from "react-redux";
import { useTranslation } from "react-i18next";
import { ArrowUpRight, ContactRound, FileText, LoaderCircle, PanelsTopLeft, Sparkles, Upload } from "lucide-react";
import { CareerCommandCenter } from "@/components/career/career-command-center";
import type { AppDispatch } from "@/redux/store";
import { useCurrentUser } from "@/hooks/useCurrentUser";
import { fetchUser, selectUser } from "@/redux/user/userSlice";
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
  const dispatch = useDispatch<AppDispatch>();
  const { user: session } = useCurrentUser();
  const user = useSelector(selectUser);
  const { documents, loading, error, reload } = useResumeLibrary(Boolean(session?.id));
  useEffect(() => { if (session?.id) void dispatch(fetchUser(session.id)); }, [session?.id, dispatch]);
  const documentHref = session ? "/dashboard/resumes" : "/login";
  return <div className="space-y-7">
    <div className="flex flex-wrap items-center justify-between gap-3">
      <p className="text-sm font-medium text-muted-foreground">{user?.name ? t("shell.greeting", { name: user.name.split(" ")[0] }) : t("shell.guest")}</p>
      <Button size="sm" variant="outline" asChild><Link href={documentHref}><Upload className="size-4" />{t("documents.upload")}</Link></Button>
    </div>
    <CareerCommandCenter signedIn={Boolean(session?.id)} resumes={error ? null : documents.length} resumesPending={loading} />
    <section className="min-w-0 w-full rounded-xl border bg-hero p-6 text-hero-foreground sm:p-8" aria-labelledby="overview-job-title">
      <p className="mb-4 flex items-center gap-2 text-[10px] font-semibold uppercase tracking-widest"><Sparkles className="size-3.5" />{t("shell.heroLabel")}</p>
      <h2 id="overview-job-title" className="max-w-lg text-3xl font-semibold leading-tight tracking-[-.04em] sm:text-4xl">{jobForm.c.title}</h2>
      <p className="mt-3 max-w-lg text-sm leading-relaxed">{jobForm.c.description}</p>
      <div className="mt-6 space-y-4 rounded-xl border bg-card p-4 text-card-foreground sm:p-5">
        {jobForm.error && <div role="alert" className="rounded-lg border border-destructive/25 bg-destructive/5 p-3 text-sm text-destructive">{jobForm.errorText}{jobForm.error === "FEATURE_NOT_AVAILABLE" && <Link className="ml-2 underline" href="/upgrade">{jobForm.c.upgrade}</Link>}</div>}
        {jobForm.busy && <p role="status" aria-live="polite" className="flex items-center gap-2 text-sm text-muted-foreground"><LoaderCircle className="size-4 shrink-0 animate-spin" />{jobForm.busy === "extract" ? jobForm.c.extracting : jobForm.busy === "analyze" ? jobForm.c.analyzing : jobForm.c.working}</p>}
        <JobAnalysisForm form={jobForm} />
      </div>
    </section>
    <section>
      <SectionHeader title={t("documents.recent")} description={t("documents.recentDescription")} action={<Button variant="ghost" asChild><Link href={documentHref}>{t("documents.viewAll")}<ArrowUpRight /></Link></Button>} />
      {error ? <div role="alert" className="app-section"><p className="text-sm text-muted-foreground">{t("shell.loadError")}</p><Button variant="outline" className="mt-3" onClick={() => void reload()}>{t("shell.retry")}</Button></div> : loading || documents.length ? <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3"><ResumeCards documents={documents.slice(0, 3)} loading={loading} onDeleted={() => void reload()} /></div> : <EmptyState icon={FileText} title={t("documents.emptyTitle")} description={t("documents.emptyDescription")} action={<Button asChild><Link href={documentHref}><Upload />{t("documents.upload")}</Link></Button>} />}
    </section>
    <div className="grid gap-4 sm:grid-cols-2">
      {[{ icon: ContactRound, title: "documents.profileAction", description: "documents.profileActionDescription", href: "/dashboard/profile" }, { icon: PanelsTopLeft, title: "shell.exploreTemplates", description: "documents.templateActionDescription", href: "/templates" }].map(({ icon: Icon, title, description, href }) => <Link key={href} href={href} className="flex min-w-0 items-start gap-4 rounded-xl border bg-card p-5 transition-colors hover:border-primary"><span className="rounded-lg bg-primary/10 p-2.5 text-primary"><Icon className="size-5" /></span><div className="min-w-0 flex-1"><h2 className="text-sm font-semibold">{t(title)}</h2><p className="mt-1 text-xs leading-5 text-muted-foreground">{t(description)}</p></div><ArrowUpRight className="size-4 shrink-0 text-muted-foreground" /></Link>)}
    </div>
  </div>;
}
