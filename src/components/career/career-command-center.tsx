"use client";
import { translateCentral } from "@/lib/i18n/central-copy";
import { getCentralCopy } from "@/lib/i18n/central-copy";

import { useEffect, useState } from "react";
import Link from "next/link";
import { useTranslation } from "react-i18next";
import { applicationCount, chooseCareerNextStep, missionCount } from "@/lib/career/command-center";
import {
  ArrowRight, ArrowUpRight, BrainCircuit, BriefcaseBusiness, CheckCircle2,
  ClipboardList, FileCheck2, FileText, MessageSquareText, ScanSearch,
  Sparkles,
} from "lucide-react";

/** Only render numbers returned by authenticated endpoints; unavailable data is never displayed as zero. */
type CareerPulse = { applications: number | null; missions: number | null };
const emptyPulse: CareerPulse = { applications: null, missions: null };

export function useCareerPulse(enabled: boolean) {
  const [pulse, setPulse] = useState<CareerPulse>(emptyPulse);
  const [pending, setPending] = useState(enabled);
  useEffect(() => {
    if (!enabled) { setPulse(emptyPulse); setPending(false); return; }
    const controller = new AbortController();
    setPending(true);
    const get = async (url: string) => {
      const response = await fetch(url, { cache: "no-store", credentials: "same-origin", signal: controller.signal });
      if (!response.ok) throw new Error("CAREER_PULSE_UNAVAILABLE");
      return response.json() as Promise<unknown>;
    };
    void Promise.allSettled([
      get("/api/applications?page=1&pageSize=1&archived=false"),
      get("/api/career/v1/missions?limit=30"),
    ]).then(([applications, missions]) => {
      if (controller.signal.aborted) return;
      setPulse({
        applications: applications.status === "fulfilled" ? applicationCount(applications.value) : null,
        // Mission listing is paginated; this is not presented as a lifetime total.
        missions: missions.status === "fulfilled" ? missionCount(missions.value) : null,
      });
      setPending(false);
    });
    return () => controller.abort();
  }, [enabled]);
  return { pulse, pending };
}

const copy = getCentralCopy("careerCommandCenter");

type IconComponent = typeof FileText;
function ActionCard({ href, icon: Icon, title, description }: { href: string; icon: IconComponent; title: string; description: string }) {
  return <Link href={href} className="group flex min-h-20 min-w-0 items-center gap-3 border bg-card px-3 py-2.5 transition-[border-color,background-color] duration-150 hover:border-primary/45 hover:bg-muted/25 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ring">
    <span className="flex size-8 shrink-0 items-center justify-center rounded-md bg-secondary text-primary"><Icon className="size-4" aria-hidden="true" /></span>
    <div className="min-w-0 flex-1"><h3 className="truncate text-sm font-semibold leading-snug">{title}</h3><p className="sr-only">{description}</p></div>
    <ArrowUpRight className="size-4 shrink-0 text-muted-foreground transition-transform group-hover:-translate-y-0.5 group-hover:translate-x-0.5 group-hover:text-primary" aria-hidden="true" />
  </Link>;
}
function Metric({ label, value, icon: Icon, pending, unavailable }: { label: string; value: number | null; icon: IconComponent; pending: boolean; unavailable: string }) {
  return <div className="min-w-0 border-l-2 border-primary bg-card px-3 py-2.5 sm:px-4">
    <div className="flex items-center gap-1.5 text-muted-foreground"><Icon className="size-4" aria-hidden="true"/><span className="text-xs">{label}</span></div>
    <p className="mt-1 text-xl font-semibold tabular-nums sm:text-2xl" aria-label={value === null ? unavailable : `${value} ${label}`}>
      {pending ? <span className="inline-block h-5 w-8 animate-pulse rounded bg-muted" aria-hidden="true"/> : value ?? "—"}
    </p>
  </div>;
}

export function CareerCommandCenter({ signedIn, resumes, resumesPending }: { signedIn: boolean; resumes: number | null; resumesPending: boolean }) {
  const { i18n } = useTranslation();
  const c = copy[i18n.resolvedLanguage?.startsWith("fr") ? "fr" : "en"];
  const { pulse, pending } = useCareerPulse(signedIn);
  const nextStep = chooseCareerNextStep(signedIn, resumesPending ? null : resumes, pulse.applications);
  const next = nextStep === "SIGN_IN" ? { text: c.nextGuest, href: "/login" }
    : nextStep === "CREATE_RESUME" ? { text: c.start, href: "/dashboard/resumes" }
    : nextStep === "PREPARE_PACKET" ? { text: c.nextApp, href: "/dashboard/application-agent" }
    : nextStep === "REVIEW_MATCH" ? { text: c.nextCv, href: "/dashboard/job-match" } : null;
  const actions: { href: string; icon: IconComponent; title: string; description: string }[] = [
    { href: "/dashboard/resumes", icon: FileText, title: c.resume, description: c.resumeDesc },
    { href: "/dashboard/cover-letters", icon: MessageSquareText, title: c.letter, description: c.letterDesc },
    { href: "/dashboard/job-match", icon: ScanSearch, title: c.match, description: c.matchDesc },
    { href: "/dashboard/application-agent", icon: FileCheck2, title: c.packet, description: c.packetDesc },
    { href: "/dashboard/interviews", icon: BriefcaseBusiness, title: c.interview, description: c.interviewDesc },
  ];
  return <div className="space-y-5">
    <section className="flex min-h-10 flex-wrap items-center justify-between gap-4 border-b pb-5" aria-labelledby="career-command-title">
      <div><p className="text-[11px] font-medium uppercase tracking-[0.12em] text-muted-foreground">{c.eyebrow}</p><h1 id="career-command-title" className="mt-1 text-2xl font-semibold tracking-tight sm:text-3xl">{c.title}</h1></div>
      <Link href="/dashboard/assistant" className="inline-flex h-9 items-center gap-2 rounded-[6px] bg-primary px-3 text-xs font-semibold text-primary-foreground transition-[background-color,transform] duration-150 hover:opacity-90 active:translate-y-px focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ring"><Sparkles className="size-4" aria-hidden="true"/>{c.leadAction}<ArrowRight className="size-3.5" aria-hidden="true"/></Link>
    </section>
    <section aria-label={c.pulse} className="grid grid-cols-3 gap-2 sm:gap-3">
      <Metric label={c.docs} icon={FileText} value={signedIn ? resumes : null} pending={signedIn && resumesPending} unavailable={c.unavailable}/>
      <Metric label={c.apps} icon={ClipboardList} value={pulse.applications} pending={pending} unavailable={c.unavailable}/>
      <Metric label={c.missions} icon={BrainCircuit} value={pulse.missions} pending={pending} unavailable={c.unavailable}/>
    </section>
    {next && <aside className="flex flex-wrap items-center justify-between gap-3 border-y bg-primary/[0.03] px-4 py-3" aria-label={c.next}>
      <div className="flex min-w-0 items-center gap-2"><span className="flex size-8 shrink-0 items-center justify-center rounded-md bg-primary/10 text-primary"><CheckCircle2 className="size-4" aria-hidden="true"/></span><p className="text-sm"><span className="font-semibold">{c.next}</span><span className="ml-2 text-muted-foreground">{next.text}</span></p></div>
      <Link href={next.href} className="inline-flex items-center gap-1 text-xs font-semibold text-primary hover:underline">{c.nextButton}<ArrowRight className="size-3.5" aria-hidden="true"/></Link>
    </aside>}
    <RecentApplications enabled={signedIn} />
    <details className="group border bg-card">
      <summary className="cursor-pointer list-none px-4 py-3 text-xs font-semibold text-muted-foreground transition-colors hover:text-foreground">{c.quickTitle} <span className="ml-2 text-primary">+</span></summary>
      <div className="grid gap-2 border-t p-3 sm:grid-cols-2 lg:grid-cols-3">{actions.map(action => <ActionCard key={action.href} {...action}/>)}</div>
    </details>
  </div>;
}

type RecentApplication = { id: string; company: string; jobTitle: string; status: string };
function RecentApplications({ enabled }: { enabled: boolean }) {
  const { i18n } = useTranslation();
  const fr = i18n.resolvedLanguage?.startsWith("fr");
  const [items, setItems] = useState<RecentApplication[] | null>(null);
  useEffect(() => {
    if (!enabled) { setItems([]); return; }
    const controller = new AbortController();
    void fetch("/api/applications?archived=false&pageSize=4", { cache: "no-store", credentials: "same-origin", signal: controller.signal }).then(r => {
      if (!r.ok) throw new Error("UNAVAILABLE"); return r.json();
    }).then(data => { if (!controller.signal.aborted) setItems(Array.isArray(data.items) ? data.items : null); }).catch(() => { if (!controller.signal.aborted) setItems(null); });
    return () => controller.abort();
  }, [enabled]);
  return <section className="ux-surface overflow-hidden" aria-labelledby="recent-apps-title">
    <div className="flex items-center justify-between gap-2 border-b px-4 py-3"><h2 id="recent-apps-title" className="text-sm font-semibold">{translateCentral(fr ? "fr" : "en", "uiText.components_career_career_command_center.text001")}</h2><Link className="inline-flex items-center gap-1 text-xs font-semibold text-primary hover:underline" href="/dashboard/applications">{translateCentral(fr ? "fr" : "en", "uiText.components_career_career_command_center.text002")}<ArrowRight className="size-3.5"/></Link></div>
    {items === null ? <p className="px-4 py-6 text-xs text-muted-foreground">{translateCentral(fr ? "fr" : "en", "uiText.components_career_career_command_center.text003")}</p>
      : items.length === 0 ? <div className="flex flex-wrap items-center justify-between gap-2 px-4 py-6"><p className="text-sm text-muted-foreground">{translateCentral(fr ? "fr" : "en", "uiText.components_career_career_command_center.text004")}</p><Link className="text-xs font-semibold text-primary hover:underline" href="/dashboard/applications">{translateCentral(fr ? "fr" : "en", "uiText.components_career_career_command_center.text005")}</Link></div>
      : <div className="divide-y">{items.map(item => <Link key={item.id} href={`/dashboard/applications/${item.id}`} className="group flex items-center gap-3 px-4 py-3 text-sm transition-colors hover:bg-muted/30"><span className="flex size-8 shrink-0 items-center justify-center rounded-lg bg-secondary text-xs font-semibold text-primary">{item.company.slice(0,1).toUpperCase()}</span><span className="min-w-0 flex-1"><span className="block truncate font-medium">{item.jobTitle}</span><span className="block truncate text-xs text-muted-foreground">{item.company}</span></span><ArrowRight className="size-4 text-muted-foreground transition-transform group-hover:translate-x-0.5"/></Link>)}</div>}
  </section>;
}
