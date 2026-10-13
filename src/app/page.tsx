"use client";

import { useEffect } from "react";
import Link from "next/link";
import { useDispatch, useSelector } from "react-redux";
import { useTranslation } from "react-i18next";
import { ArrowRight, ArrowUpRight, ContactRound, FileText, PanelsTopLeft, Sparkles, Upload } from "lucide-react";
import type { AppDispatch } from "@/redux/store";
import { useCurrentUser } from "@/hooks/useCurrentUser";
import { fetchUser, selectUser } from "@/redux/user/userSlice";
import { Button } from "@/components/ui/button";
import { PageHeader, SectionHeader } from "@/components/ui/page-header";
import { EmptyState } from "@/components/ui/empty-state";
import { ScoreRing } from "@/components/ui/score-ring";
import { profileCompleteness } from "@/lib/career-profile/schema";
import { ResumeCards, useResumeLibrary } from "@/components/resumes/resume-library";

export default function Overview() {
  const { t } = useTranslation();
  const dispatch = useDispatch<AppDispatch>();
  const { user: session } = useCurrentUser();
  const user = useSelector(selectUser);
  const { documents, loading, error, reload } = useResumeLibrary(Boolean(session?.id));
  useEffect(() => { if (session?.id) void dispatch(fetchUser(session.id)); }, [session?.id, dispatch]);
  const completeness = profileCompleteness({
    name: user?.name, email: user?.email, headline: user?.headline,
    summary: user?.summary, skills: user?.skills, languages: user?.languages,
    careerGoal: user?.careerGoal, experienceLevel: user?.experienceLevel,
    targetJobTitle: user?.targetJobTitle, targetIndustry: user?.targetIndustry,
    targetCountry: user?.targetCountry, preferredWorkMode: user?.preferredWorkMode,
    targetMarket: user?.targetMarket,
    experiences: user?.Experience, education: user?.Education, projects: user?.Project,
  });
  const documentHref = session ? "/dashboard/resumes" : "/login";
  return <div className="space-y-7">
    <PageHeader eyebrow={t("shell.homeEyebrow")} title={user?.name ? t("shell.greeting", { name: user.name.split(" ")[0] }) : t("shell.homeTitle")} description={t("shell.homeDescription")} action={<Button asChild><Link href={documentHref}><Upload />{t("documents.upload")}</Link></Button>} />
    <div className="grid gap-5 lg:grid-cols-[minmax(0,2fr)_minmax(260px,1fr)]">
      <section className="flex flex-col justify-center rounded-xl border bg-hero p-6 text-hero-foreground sm:p-8">
        <p className="mb-4 flex items-center gap-2 text-[10px] font-semibold uppercase tracking-widest"><Sparkles className="size-3.5" />{t("shell.heroLabel")}</p>
        <h2 className="max-w-lg text-3xl font-semibold leading-tight tracking-[-.04em] sm:text-4xl">{t("documents.heroTitle")}</h2>
        <p className="mt-3 max-w-lg text-sm leading-relaxed">{t("documents.heroDescription")}</p>
        <div className="mt-6 flex flex-wrap gap-3"><Button asChild><Link href={documentHref}>{t("documents.manage")}<ArrowRight /></Link></Button><Button variant="outline" asChild><Link href="/templates">{t("shell.exploreTemplates")}<ArrowUpRight /></Link></Button></div>
      </section>
      <section className="app-section flex flex-col items-center text-center">
        <p className="mb-4 flex w-full items-center gap-2 text-xs text-muted-foreground"><ContactRound className="size-4" />{t("shell.careerProfile")}</p>
        <ScoreRing value={completeness.percentage} label={t("shell.profileCompleteness")} />
        <h2 className="mt-3 text-sm font-semibold">{t("shell.profileCompleteness")}</h2>
        <p className="my-3 text-xs text-muted-foreground">{user ? t("shell.profileFields", { complete: completeness.completed, total: completeness.total }) : t("shell.profileUnavailable")}</p>
        <Button variant="outline" asChild className="mt-auto w-full"><Link href={user && !user.onboardingCompletedAt ? "/onboarding" : "/dashboard/profile"}>{t("shell.completeProfile")}<ArrowUpRight /></Link></Button>
      </section>
    </div>
    <section>
      <SectionHeader title={t("documents.recent")} description={t("documents.recentDescription")} action={<Button variant="ghost" asChild><Link href={documentHref}>{t("documents.viewAll")}<ArrowUpRight /></Link></Button>} />
      {error ? <div role="alert" className="app-section"><p className="text-sm text-muted-foreground">{t("shell.loadError")}</p><Button variant="outline" className="mt-3" onClick={() => void reload()}>{t("shell.retry")}</Button></div> : loading || documents.length ? <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3"><ResumeCards documents={documents.slice(0, 3)} loading={loading} onDeleted={() => void reload()} /></div> : <EmptyState icon={FileText} title={t("documents.emptyTitle")} description={t("documents.emptyDescription")} action={<Button asChild><Link href={documentHref}><Upload />{t("documents.upload")}</Link></Button>} />}
    </section>
    <div className="grid gap-4 sm:grid-cols-2">
      {[{ icon: ContactRound, title: "documents.profileAction", description: "documents.profileActionDescription", href: "/dashboard/profile" }, { icon: PanelsTopLeft, title: "shell.exploreTemplates", description: "documents.templateActionDescription", href: "/templates" }].map(({ icon: Icon, title, description, href }) => <Link key={href} href={href} className="flex min-w-0 items-start gap-4 rounded-xl border bg-card p-5 transition-colors hover:border-primary"><span className="rounded-lg bg-primary/10 p-2.5 text-primary"><Icon className="size-5" /></span><div className="min-w-0 flex-1"><h2 className="text-sm font-semibold">{t(title)}</h2><p className="mt-1 text-xs leading-5 text-muted-foreground">{t(description)}</p></div><ArrowUpRight className="size-4 shrink-0 text-muted-foreground" /></Link>)}
    </div>
  </div>;
}
