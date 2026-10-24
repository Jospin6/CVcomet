"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { useTranslation } from "react-i18next";
import { applicationCount, chooseCareerNextStep, missionCount } from "@/lib/career/command-center";
import {
  ArrowRight, ArrowUpRight, BrainCircuit, BriefcaseBusiness, CheckCircle2,
  ClipboardList, FileCheck2, FileText, MessageSquareText, ScanSearch,
  ShieldCheck, Sparkles, WandSparkles,
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

const copy = {
  fr: {
    eyebrow: "VOTRE ESPACE DE CARRIÈRE", title: "Votre prochain pas, en toute clarté.",
    description: "CV, candidatures et préparation aux entretiens. Tous vos outils professionnels au même endroit.",
    lead: "Career Agent", leadDescription: "Posez une question sur votre profil et reprenez vos missions privées.",
    leadAction: "Ouvrir mon agent", quickTitle: "Que souhaitez-vous accomplir ?",
    quickDescription: "Accédez directement au bon espace de travail.",
    resume: "Créer ou améliorer mon CV", resumeDesc: "Rédiger, comparer et exporter",
    letter: "Rédiger une lettre", letterDesc: "Personnaliser ma candidature",
    match: "Analyser une offre", matchDesc: "Comprendre les exigences et les écarts",
    packet: "Préparer une candidature", packetDesc: "Assembler mon dossier et le valider",
    interview: "Préparer un entretien", interviewDesc: "Questions et feedback personnalisés",
    vault: "Mes faits professionnels", vaultDesc: "Contrôler les informations utilisées par l’IA",
    pulse: "Mon activité", docs: "Documents CV", apps: "Candidatures actives", missions: "Missions affichées",
    unavailable: "Indisponible", guest: "Connectez-vous pour voir votre activité.",
    next: "Prochaine action conseillée", start: "Préparer un premier CV", nextCv: "Vous avez déjà un CV. Analysez sa pertinence pour une offre.",
    nextApp: "Préparez un dossier de candidature à partir de votre CV.",
    nextGuest: "Connectez-vous pour retrouver vos documents et missions.",
    nextButton: "Continuer", privacy: "L’agent consulte uniquement les informations que vous êtes autorisé à partager.",
  },
  en: {
    eyebrow: "YOUR CAREER WORKSPACE", title: "Your next move, made clearer.",
    description: "Resumes, applications and interview preparation. Your career tools in one place.",
    lead: "Career Agent", leadDescription: "Ask about your profile and resume your private missions.",
    leadAction: "Open my agent", quickTitle: "What would you like to achieve?",
    quickDescription: "Jump straight to the right workspace.",
    resume: "Build or improve my resume", resumeDesc: "Write, review and export",
    letter: "Write a cover letter", letterDesc: "Tailor my application",
    match: "Analyze a job", matchDesc: "Understand requirements and gaps",
    packet: "Prepare an application", packetDesc: "Assemble and approve a packet",
    interview: "Practice an interview", interviewDesc: "Tailored questions and feedback",
    vault: "My career evidence", vaultDesc: "Control what AI can use",
    pulse: "My activity", docs: "Resumes", apps: "Active applications", missions: "Missions shown",
    unavailable: "Unavailable", guest: "Sign in to view your activity.",
    next: "Suggested next step", start: "Prepare your first resume", nextCv: "You already have a resume. Check it against a job description.",
    nextApp: "Prepare an application packet using your resume.",
    nextGuest: "Sign in to access your documents and missions.",
    nextButton: "Continue", privacy: "The agent only accesses information you're authorized to share.",
  },
} as const;

type IconComponent = typeof FileText;
function ActionCard({ href, icon: Icon, title, description }: { href: string; icon: IconComponent; title: string; description: string }) {
  return <Link href={href} className="group flex min-h-32 min-w-0 flex-col justify-between gap-4 rounded-2xl border bg-card p-4 shadow-sm transition-[border-color,transform,box-shadow] hover:-translate-y-0.5 hover:border-primary/45 hover:shadow-md focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ring sm:p-5">
    <div className="flex items-start justify-between gap-3"><span className="flex size-10 items-center justify-center rounded-xl bg-secondary text-primary"><Icon className="size-5" aria-hidden="true" /></span><ArrowUpRight className="size-4 text-muted-foreground transition-transform group-hover:-translate-y-0.5 group-hover:translate-x-0.5" aria-hidden="true" /></div>
    <div><h3 className="text-sm font-semibold leading-snug">{title}</h3><p className="mt-1 text-xs leading-relaxed text-muted-foreground">{description}</p></div>
  </Link>;
}
function Metric({ label, value, icon: Icon, pending, unavailable }: { label: string; value: number | null; icon: IconComponent; pending: boolean; unavailable: string }) {
  return <div className="min-w-0 rounded-xl border bg-card p-4">
    <div className="flex items-center gap-2 text-muted-foreground"><Icon className="size-4" aria-hidden="true"/><span className="text-xs">{label}</span></div>
    <p className="mt-2 text-2xl font-semibold tabular-nums" aria-label={value === null ? unavailable : `${value} ${label}`}>
      {pending ? <span className="inline-block h-7 w-10 animate-pulse rounded bg-muted" aria-hidden="true"/> : value ?? "—"}
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
    { href: "/dashboard/evidence", icon: ShieldCheck, title: c.vault, description: c.vaultDesc },
  ];
  return <div className="space-y-7">
    <section className="career-command-hero relative overflow-hidden rounded-3xl border border-primary/20 p-6 text-hero-foreground sm:p-8 lg:p-10" aria-labelledby="career-command-title">
      <div className="pointer-events-none absolute -right-14 -top-20 size-72 rounded-full border border-primary/10" aria-hidden="true" />
      <div className="pointer-events-none absolute right-4 top-4 size-48 rounded-full border border-primary/10" aria-hidden="true" />
      <div className="relative grid items-center gap-7 lg:grid-cols-[minmax(0,1fr)_minmax(250px,0.8fr)]">
        <div className="space-y-4">
          <p className="inline-flex items-center gap-2 text-[11px] font-semibold uppercase tracking-[.14em]"><Sparkles className="size-4" aria-hidden="true"/>{c.eyebrow}</p>
          <h1 id="career-command-title" className="max-w-xl text-3xl font-semibold leading-[1.15] tracking-[-.045em] sm:text-4xl lg:text-5xl">{c.title}</h1>
          <p className="max-w-lg text-sm leading-7 opacity-85">{c.description}</p>
          <Link href="/dashboard/assistant" className="inline-flex min-h-11 items-center gap-2 rounded-xl bg-primary px-5 py-2.5 text-sm font-semibold text-primary-foreground transition-opacity hover:opacity-90 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ring"><BrainCircuit className="size-4" aria-hidden="true"/>{c.leadAction}<ArrowRight className="size-4" aria-hidden="true"/></Link>
        </div>
        <div className="rounded-2xl border border-primary/15 bg-card/85 p-5 text-card-foreground shadow-sm backdrop-blur-sm sm:p-6">
          <span className="mb-3 flex size-11 items-center justify-center rounded-xl bg-secondary text-primary"><WandSparkles className="size-6" aria-hidden="true"/></span>
          <p className="font-semibold">{c.lead}</p><p className="mt-2 text-sm leading-6 text-muted-foreground">{c.leadDescription}</p>
          <div className="mt-5 flex items-start gap-2 border-t pt-4 text-xs leading-5 text-muted-foreground"><ShieldCheck className="mt-0.5 size-4 shrink-0 text-primary" aria-hidden="true"/>{c.privacy}</div>
        </div>
      </div>
    </section>
    <section aria-labelledby="career-pulse-title" className="space-y-3">
      <h2 id="career-pulse-title" className="text-base font-semibold">{c.pulse}</h2>
      {!signedIn && <p className="text-xs text-muted-foreground">{c.guest}</p>}
      <div className="grid grid-cols-1 gap-3 sm:grid-cols-3" aria-live="polite">
        <Metric label={c.docs} icon={FileText} value={signedIn ? resumes : null} pending={signedIn && resumesPending} unavailable={c.unavailable}/>
        <Metric label={c.apps} icon={ClipboardList} value={pulse.applications} pending={pending} unavailable={c.unavailable}/>
        <Metric label={c.missions} icon={BrainCircuit} value={pulse.missions} pending={pending} unavailable={c.unavailable}/>
      </div>
    </section>
    {next && <aside className="flex flex-wrap items-center justify-between gap-3 rounded-2xl border bg-card p-4 sm:p-5" aria-label={c.next}>
      <div className="flex items-start gap-3"><CheckCircle2 className="mt-0.5 size-5 shrink-0 text-primary" aria-hidden="true"/><div><h2 className="text-sm font-semibold">{c.next}</h2><p className="mt-1 text-sm text-muted-foreground">{next.text}</p></div></div>
      <Link href={next.href} className="inline-flex min-h-10 items-center gap-2 rounded-lg border px-4 text-sm font-medium transition-colors hover:bg-accent">{c.nextButton}<ArrowRight className="size-4" aria-hidden="true"/></Link>
    </aside>}
    <section aria-labelledby="career-actions-title" className="space-y-4"><div><h2 id="career-actions-title" className="text-xl font-semibold tracking-tight">{c.quickTitle}</h2><p className="mt-1 text-sm text-muted-foreground">{c.quickDescription}</p></div>
      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 xl:grid-cols-3">{actions.map(action => <ActionCard key={action.href} {...action}/>)}</div>
    </section>
  </div>;
}
