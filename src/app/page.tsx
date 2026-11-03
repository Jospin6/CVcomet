"use client";

import { useEffect, useRef, useState } from "react";
import Link from "next/link";
import { useTranslation } from "react-i18next";
import {
  RotateCcw,
  ArrowLeft,
  ArrowRight,
  ArrowUpRight,
  BriefcaseBusiness,
  Check,
  ChevronDown,
  ClipboardCheck,
  FileCheck2,
  FilePlus2,
  FileSearch,
  FileText,
  Globe,
  GraduationCap,
  LayoutGrid,
  Linkedin,
  Mail,
  Map,
  MessageSquareText,
  Mic,
  Plus,
  Search,
  Settings2,
  ShieldCheck,
  Sparkles,
  TrendingUp,
  Upload,
  UserRound,
  type LucideIcon,
} from "lucide-react";

import { useCurrentUser } from "@/hooks/useCurrentUser";
import { useResumeLibrary } from "@/components/resumes/resume-library";
import { PdfPreview } from "@/components/resumes/pdf-preview";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import type { LibraryResume } from "@/lib/resume-documents";

// The app shell already provides navigation, background, accent and dark mode.
// This page only uses the existing theme tokens: bg-card, bg-muted, text-primary, etc.

type Locale = "fr" | "en";
type SectionId = "documents" | "jobs" | "map" | "interviews" | "tips" | "tools";

type Job = {
  id: string;
  title: string;
  company: string;
  provider: string;
  logoUrl?: string | null;
  sourceUrl?: string | null;
};

type Interview = {
  id: string;
  title: string;
  status: string;
};

type ToolLink = {
  id: string;
  icon: LucideIcon;
  href: string | null;
  title: [string, string];
  description: [string, string];
};

const sections: SectionId[] = [
  "documents",
  "jobs",
  "map",
  "interviews",
  "tips",
  "tools",
];

const tools: ToolLink[] = [
  {
    id: "linkedin",
    icon: Linkedin,
    href: "/dashboard/resumes",
    title: ["Import LinkedIn", "LinkedIn Import"],
    description: ["Importer les données de son profil", "Import your profile"],
  },
  {
    id: "pdf",
    icon: Upload,
    href: "/dashboard/resumes",
    title: ["Import PDF", "PDF Import"],
    description: ["Importer et modifier un ancien CV", "Import and edit a resume"],
  },
  {
    id: "resume",
    icon: FileText,
    href: "/dashboard/resumes",
    title: ["Créateur de CV", "Resume Builder"],
    description: ["Créer et modifier un CV", "Create and edit a resume"],
  },
  {
    id: "letter",
    icon: Mail,
    href: "/dashboard/cover-letters",
    title: ["Lettres de motivation", "Cover Letter Builder"],
    description: ["Adapter sa lettre à une offre", "Tailor a letter to a job"],
  },
  {
    id: "website",
    icon: Globe,
    href: "/dashboard/profile",
    title: ["Profil public", "Personal Website"],
    description: ["Gérer sa présence professionnelle", "Manage your public profile"],
  },
  {
    id: "ats",
    icon: TrendingUp,
    href: "/dashboard/resumes",
    title: ["Analyse de CV", "Resume Analysis"],
    description: ["Comprendre les points à améliorer", "Find ways to improve"],
  },
  {
    id: "examples",
    icon: LayoutGrid,
    href: "/templates",
    title: ["Modèles de CV", "Resume Examples"],
    description: ["Explorer les modèles disponibles", "Explore resume templates"],
  },
  {
    id: "feedback",
    icon: FileSearch,
    href: "/dashboard/resumes",
    title: ["Avis sur mon CV", "Resume Feedback"],
    description: ["Obtenir des conseils d'amélioration", "Get improvement feedback"],
  },
  {
    id: "career",
    icon: Map,
    href: "/dashboard/career-map",
    title: ["Carte de carrière", "Career Map"],
    description: ["Explorer les prochaines étapes", "Explore your next career steps"],
  },
  {
    id: "questions",
    icon: Mic,
    href: "/dashboard/interviews",
    title: ["Questions d'entretien", "Interview Questions"],
    description: ["S'entraîner pour les entretiens", "Practice interview answers"],
  },
  {
    id: "jobs",
    icon: BriefcaseBusiness,
    href: "/dashboard/find-jobs",
    title: ["Offres d'emploi", "Find Jobs"],
    description: ["Trouver des offres adaptées", "Discover matching jobs"],
  },
  {
    id: "agent",
    icon: Sparkles,
    href: "/dashboard/assistant",
    title: ["Career Agent", "Career Agent"],
    description: ["Un assistant pour votre carrière", "Your career assistant"],
  },
  {
    id: "tracking",
    icon: FileCheck2,
    href: "/dashboard/applications",
    title: ["Mes candidatures", "Applications"],
    description: ["Suivre mes candidatures", "Track your applications"],
  },
  {
    id: "benefits",
    icon: ShieldCheck,
    href: "/upgrade",
    title: ["Formules et avantages", "Plans & Benefits"],
    description: ["Découvrir les fonctionnalités Pro", "Explore Pro features"],
  },
];

const guides = [
  {
    id: "ats",
    icon: FileSearch,
    href: "/dashboard/resumes",
    fr: "Vérifier son CV avant de postuler",
    en: "Check your resume before applying",
  },
  {
    id: "job",
    icon: BriefcaseBusiness,
    href: "/dashboard/find-jobs",
    fr: "Trouver une offre qui vous correspond",
    en: "Find a job that matches your profile",
  },
  {
    id: "followup",
    icon: Mail,
    href: "/dashboard/applications",
    fr: "Organiser ses candidatures et relances",
    en: "Organize applications and follow-ups",
  },
  {
    id: "interview",
    icon: MessageSquareText,
    href: "/dashboard/interviews",
    fr: "Se préparer aux questions d'entretien",
    en: "Prepare for interview questions",
  },
];

const copy = {
  fr: {
    welcome: "Bon retour",
    upgrade: "Passer à Pro",
    documents: "Documents",
    website: "Mon site web",
    websiteType: "Site personnel",
    lastEdited: "Dernières créations",
    create: "Créer",
    newResume: "Nouveau CV",
    newLetter: "Lettre de motivation",
    importResume: "Importer un CV",
    documentsEmpty: "Vos CV et documents apparaîtront ici.",
    documentsError: "Impossible de charger les documents.",
    retry: "Réessayer",
    jobs: "Offres d'emploi",
    noJobs: "Aucune offre recommandée pour le moment.",
    map: "Carte de carrière",
    exploreMap: "Explorer ma carte",
    mapExplore: "Visualisez les prochaines étapes de votre carrière",
    interviews: "Entretiens",
    startInterview: "Préparer un entretien",
    noInterviews: "Aucun entretien préparé pour le moment.",
    tips: "Conseils et guides",
    guidesCaption: "Pour avancer dans votre recherche",
    allTools: "Tous les outils",
    edit: "Modifier la disposition",
    done: "Terminé",
    reset: "Réinitialiser",
    visibleSections: "Sections visibles",
    visibleTools: "Outils visibles",
    notAvailable: "Bientôt",
    viewMore: "Voir tout",
    scrollLeft: "Voir les outils précédents",
    scrollRight: "Voir les outils suivants",
    openSection: "Ouvrir",
  },
  en: {
    welcome: "Welcome back",
    upgrade: "Upgrade Now",
    documents: "Documents",
    website: "My Website",
    websiteType: "Website",
    lastEdited: "Last edited",
    create: "Create New",
    newResume: "New resume",
    newLetter: "Cover letter",
    importResume: "Import resume",
    documentsEmpty: "Your resumes and documents will appear here.",
    documentsError: "Could not load documents.",
    retry: "Try again",
    jobs: "Job Openings",
    noJobs: "No recommended jobs to show right now.",
    map: "Career Map",
    exploreMap: "Explore Your Map",
    mapExplore: "Explore the next steps in your career",
    interviews: "Interviews",
    startInterview: "Prepare an interview",
    noInterviews: "No interview sessions yet.",
    tips: "Tips and Guides",
    guidesCaption: "Practical career resources",
    allTools: "All Tools",
    edit: "Edit Layout",
    done: "Done",
    reset: "Reset",
    visibleSections: "Visible sections",
    visibleTools: "Visible tools",
    notAvailable: "Coming soon",
    viewMore: "View all",
    scrollLeft: "Previous tools",
    scrollRight: "Next tools",
    openSection: "Open",
  },
} as const;

const panelStyle = "min-w-0 rounded-2xl border border-border/50 bg-card";
const panelTitle = "text-sm font-semibold tracking-tight sm:text-base";
const squareLink =
  "inline-flex size-10 shrink-0 items-center justify-center " +
  "rounded-xl border border-border/40 bg-background/80 " +
  "shadow-sm transition-colors hover:bg-muted " +
  "focus-visible:outline-2 focus-visible:outline-ring";

function PanelHeading({
  title,
  href,
  label,
}: {
  title: string;
  href: string;
  label: string;
}) {
  return (
    <div className="flex items-start justify-between gap-3">
      <h2 className={panelTitle}>{title}</h2>
      <Link href={href} className={squareLink} aria-label={label}>
        <ArrowRight className="size-4" aria-hidden="true" />
      </Link>
    </div>
  );
}

function DocumentThumbnail({ document }: { document: LibraryResume }) {
  if (document.source === "upload" && document.mimeType === "application/pdf") {
    return (
      <div className="pointer-events-none h-full w-full overflow-hidden bg-white">
        <PdfPreview id={document.id} name={document.name} thumbnail />
      </div>
    );
  }

  const title = document.source === "upload"
    ? document.name
    : document.contact?.name || document.title;

  return (
    <div className="h-full overflow-hidden bg-white p-1.5 text-slate-800">
      <div className="truncate text-[5px] font-bold">{title}</div>
      <div className="mt-1 h-px bg-slate-300" />
      <div className="mt-2 space-y-1">
        {Array.from({ length: 5 }, (_, index) => (
          <div
            key={index}
            className="h-[2px] bg-slate-200"
            style={{ width: `${95 - (index % 3) * 20}%` }}
          />
        ))}
      </div>
      <div className="mt-2 h-px bg-slate-300" />
      <div className="mt-1 space-y-1">
        {Array.from({ length: 6 }, (_, index) => (
          <div
            key={index}
            className="h-[2px] bg-slate-200"
            style={{ width: `${95 - (index % 4) * 12}%` }}
          />
        ))}
      </div>
    </div>
  );
}

function RecentDocuments({
  documents,
  loading,
  error,
  retry,
  locale,
  enabled,
}: {
  documents: LibraryResume[];
  loading: boolean;
  error: string;
  retry: () => void;
  locale: Locale;
  enabled: boolean;
}) {
  const c = copy[locale];
  const [portfolio, setPortfolio] = useState<{
    portfolioSlug: string | null;
    portfolioPublic: boolean;
  } | null>(null);

  useEffect(() => {
    if (!enabled) {
      setPortfolio(null);
      return;
    }

    const controller = new AbortController();
    void fetch("/api/portfolio", {
      cache: "no-store",
      signal: controller.signal,
    })
      .then((response) => {
        if (!response.ok) throw new Error("PORTFOLIO_UNAVAILABLE");
        return response.json();
      })
      .then((value) => {
        if (!controller.signal.aborted && value?.portfolioSlug) {
          setPortfolio(value);
        }
      })
      .catch(() => {});

    return () => controller.abort();
  }, [enabled]);

  const recent = documents.slice(0, portfolio ? 2 : 3);
  const href = enabled ? "/dashboard/resumes" : "/login";

  return (
    <section className={`${panelStyle} min-h-64 px-5 py-5 sm:px-8 sm:py-6`}>
      <div className="flex items-start justify-between gap-3">
        <div>
          <h2 className={panelTitle}>{c.documents}</h2>
          <p className="mt-4 text-xs text-muted-foreground">{c.lastEdited}</p>
        </div>

        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button variant="outline" size="sm" className="gap-3">
              <Plus className="size-4" />
              {c.create}
              <ChevronDown className="size-3.5" />
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end" className="min-w-48">
            <DropdownMenuItem asChild>
              <Link href={href}>
                <FilePlus2 className="size-4" />
                {c.newResume}
              </Link>
            </DropdownMenuItem>
            <DropdownMenuItem asChild>
              <Link href={enabled ? "/dashboard/cover-letters" : "/login"}>
                <Mail className="size-4" />
                {c.newLetter}
              </Link>
            </DropdownMenuItem>
            <DropdownMenuItem asChild>
              <Link href={href}>
                <Upload className="size-4" />
                {c.importResume}
              </Link>
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
      </div>

      {error ? (
        <div role="alert" className="mt-8 flex items-center gap-3 text-sm">
          <span className="text-muted-foreground">{c.documentsError}</span>
          <Button variant="outline" size="sm" onClick={retry}>
            {c.retry}
          </Button>
        </div>
      ) : loading ? (
        <div className="mt-6 grid gap-5 sm:grid-cols-3">
          {[0, 1, 2].map((index) => (
            <div key={index} className="h-20 animate-pulse rounded-lg bg-muted" />
          ))}
        </div>
      ) : recent.length || portfolio ? (
        <div className="mt-4 grid gap-x-6 gap-y-5 sm:grid-cols-3">
          {recent.map((document) => {
            const title = document.source === "upload"
              ? document.name
              : document.design?.documentName || document.title;
            const isUpload = document.source === "upload";
            const docHref = isUpload
              ? `/dashboard/resumes/import/${encodeURIComponent(document.id)}`
              : `/dashboard/resumes/${encodeURIComponent(document.id)}`;

            return (
              <Link
                key={`${document.source}-${document.id}`}
                href={docHref}
                className={"group flex min-w-0 items-center gap-4 rounded-lg p-1 " +
                  "transition-colors hover:bg-muted/40"}
              >
                <div
                  className={"h-[88px] w-[65px] shrink-0 overflow-hidden " +
                    "rounded border border-border/60 bg-white shadow-sm"}
                >
                  <DocumentThumbnail document={document} />
                </div>
                <div className="min-w-0">
                  <p className="truncate text-sm font-medium group-hover:text-primary">
                    {title}
                  </p>
                  <p className="mt-1 text-xs text-muted-foreground">
                    {isUpload ? c.importResume : c.newResume}
                  </p>
                </div>
              </Link>
            );
          })}
          {portfolio?.portfolioSlug && (
            <Link
              href={
                portfolio.portfolioPublic
                  ? `/u/${encodeURIComponent(portfolio.portfolioSlug)}`
                  : "/dashboard/profile"
              }
              className="group flex min-w-0 items-center gap-4 rounded-lg p-1 hover:bg-muted/40"
            >
              <div
                className={"flex h-[88px] w-[65px] shrink-0 items-center justify-center " +
                  "rounded border border-border/60 bg-muted/40 shadow-sm"}
              >
                <Globe className="size-7 text-primary/70" />
              </div>
              <div className="min-w-0">
                <p className="truncate text-sm font-medium group-hover:text-primary">
                  {c.website}
                </p>
                <p className="mt-1 text-xs text-muted-foreground">
                  {c.websiteType}
                </p>
              </div>
            </Link>
          )}
        </div>
      ) : (
        <div className="mt-7 flex items-center gap-3 text-sm text-muted-foreground">
          <FileText className="size-5 shrink-0" />
          <span>{c.documentsEmpty}</span>
          <Link href={href} className="ml-auto shrink-0 text-primary hover:underline">
            {c.create}
          </Link>
        </div>
      )}
    </section>
  );
}

function JobLogo({ job }: { job: Job }) {
  const [failed, setFailed] = useState(false);
  const safeLogo = job.logoUrl?.startsWith("https://") ? job.logoUrl : null;
  const initial = (job.company || "?").trim().charAt(0).toUpperCase();

  return (
    <span
      className={"flex size-10 shrink-0 items-center justify-center " +
        "overflow-hidden rounded-lg bg-secondary text-sm font-bold text-primary"}
    >
      {safeLogo && !failed ? (
        // Logos are remote employer assets. Do not use a Next image optimizer.
        // eslint-disable-next-line @next/next/no-img-element
        <img
          src={safeLogo}
          alt=""
          loading="lazy"
          className="size-full object-contain p-1"
          onError={() => setFailed(true)}
        />
      ) : (
        initial
      )}
    </span>
  );
}

function JobOpenings({
  enabled,
  locale,
}: {
  enabled: boolean;
  locale: Locale;
}) {
  const c = copy[locale];
  const [jobs, setJobs] = useState<Job[]>([]);
  const [loading, setLoading] = useState(enabled);

  useEffect(() => {
    if (!enabled) {
      setJobs([]);
      setLoading(false);
      return;
    }

    const controller = new AbortController();
    const load = async () => {
      setLoading(true);
      try {
        const loadJobs = async (recommended: boolean) => {
          const query = recommended ? "?recommended=true&page=1" : "?page=1";
          const response = await fetch(`/api/find-jobs${query}`, {
            signal: controller.signal,
            cache: "no-store",
          });
          if (!response.ok) throw new Error("JOBS_UNAVAILABLE");
          const data = (await response.json()) as { jobs?: Job[] };
          return Array.isArray(data.jobs) ? data.jobs : [];
        };

        let result = await loadJobs(true);
        if (result.length === 0) result = await loadJobs(false);
        if (!controller.signal.aborted) setJobs(result.slice(0, 7));
      } catch {
        if (!controller.signal.aborted) setJobs([]);
      } finally {
        if (!controller.signal.aborted) setLoading(false);
      }
    };

    void load();
    return () => controller.abort();
  }, [enabled]);

  return (
    <section className={`${panelStyle} p-5 sm:p-7 lg:row-span-2`}>
      <PanelHeading
        title={c.jobs}
        href={enabled ? "/dashboard/find-jobs" : "/login"}
        label={`${c.openSection} : ${c.jobs}`}
      />

      <div className="mt-6 space-y-1">
        {loading ? (
          [0, 1, 2, 3, 4, 5].map((index) => (
            <div key={index} className="h-[63px] animate-pulse rounded-lg bg-muted" />
          ))
        ) : jobs.length ? (
          jobs.map((job) => {
            const url = job.sourceUrl?.startsWith("https://")
              ? job.sourceUrl
              : "/dashboard/find-jobs";
            const external = url.startsWith("https://");

            return (
              <a
                key={job.id}
                href={url}
                target={external ? "_blank" : undefined}
                rel={external ? "noopener noreferrer" : undefined}
                className={"group flex min-w-0 items-center gap-3 " +
                  "rounded-lg px-1 py-2.5 transition-colors hover:bg-muted/40"}
              >
                <JobLogo job={job} />
                <span className="min-w-0">
                  <span className="block truncate text-sm font-medium group-hover:text-primary">
                    {job.title}
                  </span>
                  <span className="mt-1 block truncate text-xs text-muted-foreground">
                    {job.company || job.provider}
                  </span>
                </span>
              </a>
            );
          })
        ) : (
          <div className="flex flex-col items-start gap-3 py-12 text-sm">
            <Search className="size-6 text-muted-foreground" />
            <p className="text-muted-foreground">{c.noJobs}</p>
            <Link href="/dashboard/find-jobs" className="text-primary hover:underline">
              {c.viewMore}
            </Link>
          </div>
        )}
      </div>
    </section>
  );
}

function CareerMapPanel({ locale }: { locale: Locale }) {
  const c = copy[locale];

  return (
    <section className={`${panelStyle} flex min-h-[280px] flex-col p-5 sm:p-7`}>
      <h2 className={panelTitle}>{c.map}</h2>

      {/* The map is an illustration, not invented user career data. */}
      <div
        className={"relative my-5 flex min-h-36 flex-1 items-center justify-center " +
          "overflow-hidden rounded-xl bg-muted/20"}
        aria-hidden="true"
      >
        <div className="absolute left-[12%] top-[15%] rotate-[-6deg] rounded-lg border bg-card p-3 shadow-sm">
          <span className="text-[9px] text-muted-foreground">Junior</span>
          <div className="mt-2 h-1.5 w-12 rounded-full bg-primary/25" />
        </div>
        <div className="absolute right-[11%] top-[18%] rotate-[5deg] rounded-lg border bg-card p-3 shadow-sm">
          <span className="text-[9px] text-muted-foreground">Senior</span>
          <div className="mt-2 h-1.5 w-16 rounded-full bg-primary/60" />
        </div>
        <div
          className={
            "absolute bottom-[12%] left-[31%] rotate-[3deg] " +
            "rounded-lg border bg-card p-3 shadow-sm"
          }
        >
          <span className="flex items-center gap-1 text-[9px] text-muted-foreground">
            <GraduationCap className="size-3" />
            Skills
          </span>
          <div className="mt-2 h-1.5 w-14 rounded-full bg-primary/40" />
        </div>
        <ArrowUpRight className="size-7 text-primary/40" />
      </div>

      <Link
        href="/dashboard/career-map"
        className={"inline-flex min-h-10 items-center justify-center " +
          "rounded-xl border bg-background text-sm font-medium text-primary " +
          "shadow-sm transition-colors hover:bg-muted"}
      >
        {c.exploreMap}
      </Link>
    </section>
  );
}

function InterviewsPanel({
  enabled,
  locale,
}: {
  enabled: boolean;
  locale: Locale;
}) {
  const c = copy[locale];
  const [interviews, setInterviews] = useState<Interview[]>([]);

  useEffect(() => {
    if (!enabled) {
      setInterviews([]);
      return;
    }
    const controller = new AbortController();

    void fetch("/api/interviews", {
      signal: controller.signal,
      cache: "no-store",
    })
      .then((response) => {
        if (!response.ok) throw new Error("INTERVIEWS_UNAVAILABLE");
        return response.json() as Promise<Interview[]>;
      })
      .then((data) => {
        if (!controller.signal.aborted && Array.isArray(data)) {
          setInterviews(data.slice(0, 3));
        }
      })
      .catch(() => {});

    return () => controller.abort();
  }, [enabled]);

  return (
    <section className={`${panelStyle} min-h-[280px] p-5 sm:p-7`}>
      <PanelHeading
        title={c.interviews}
        href="/dashboard/interviews"
        label={`${c.openSection} : ${c.interviews}`}
      />

      {interviews.length ? (
        <div className="mt-8 space-y-3">
          {interviews.map((interview) => (
            <Link
              key={interview.id}
              href="/dashboard/interviews"
              className="flex items-center gap-3 rounded-lg px-2 py-2 hover:bg-muted/40"
            >
              <span className="flex size-10 shrink-0 items-center justify-center rounded-xl bg-muted">
                <Mic className="size-5 text-primary" />
              </span>
              <span className="min-w-0">
                <span className="block truncate text-sm font-medium">
                  {interview.title}
                </span>
                <span className="text-xs text-muted-foreground">
                  {interview.status}
                </span>
              </span>
            </Link>
          ))}
        </div>
      ) : (
        <div className="mt-12 flex flex-col items-center gap-3 text-center">
          <span className="flex size-12 items-center justify-center rounded-xl bg-muted">
            <Mic className="size-6 text-primary" />
          </span>
          <p className="text-xs text-muted-foreground">
            {c.noInterviews}
          </p>
          <Link
            href="/dashboard/interviews"
            className="text-xs font-medium text-primary hover:underline"
          >
            {c.startInterview}
          </Link>
        </div>
      )}
    </section>
  );
}

function TipsPanel({ locale }: { locale: Locale }) {
  const c = copy[locale];
  const french = locale === "fr";

  return (
    <section className={`${panelStyle} p-5 sm:p-7 lg:col-span-2`}>
      <PanelHeading
        title={c.tips}
        href="/help"
        label={`${c.openSection} : ${c.tips}`}
      />
      <p className="mt-1 text-xs text-muted-foreground">{c.guidesCaption}</p>

      <div className="mt-5 grid grid-cols-4 gap-4 xl:grid-cols-4">
        {guides.map((guide) => {
          const Icon = guide.icon;
          return (
            <Link
              href={guide.href}
              key={guide.id}
              className="group min-w-0 rounded-lg focus-visible:outline-2 focus-visible:outline-ring"
            >
              <div
                className={"flex h-24 items-center justify-center rounded-xl " +
                  "border bg-muted/50 transition-colors group-hover:bg-muted"}
              >
                <Icon className="size-9 text-primary/75" aria-hidden="true" />
              </div>
              <p className="mt-2 text-xs font-medium leading-5 group-hover:text-primary">
                {french ? guide.fr : guide.en}
              </p>
            </Link>
          );
        })}
      </div>
    </section>
  );
}

function ToolsPanel({
  locale,
  editing,
  visibleTools,
}: {
  locale: Locale;
  editing: boolean;
  visibleTools: string[];
}) {
  const c = copy[locale];
  const track = useRef<HTMLDivElement>(null);
  const selected = tools.filter((tool) => visibleTools.includes(tool.id));
  const translatedIndex = locale === "fr" ? 0 : 1;

  const scroll = (direction: -1 | 1) => {
    track.current?.scrollBy({ left: 380 * direction, behavior: "smooth" });
  };

  return (
    <section className={`${panelStyle} p-5 sm:p-7`}>
      <div className="flex items-center justify-between gap-3">
        <h2 className={panelTitle}>{c.allTools}</h2>
        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={() => scroll(-1)}
            className={squareLink}
            aria-label={c.scrollLeft}
          >
            <ArrowLeft className="size-4" />
          </button>
          <button
            type="button"
            onClick={() => scroll(1)}
            className={squareLink}
            aria-label={c.scrollRight}
          >
            <ArrowRight className="size-4" />
          </button>
        </div>
      </div>

      <div
        ref={track}
        className={"mt-7 flex snap-x snap-mandatory gap-4 overflow-x-auto " +
          "pb-4 [scrollbar-width:thin]"}
      >
        {selected.map((tool) => {
          const Icon = tool.icon;
          const content = (
            <>
              <span className="flex h-20 items-center justify-center rounded-lg bg-muted/40">
                <Icon className="size-9 text-primary/80" aria-hidden="true" />
              </span>
              <span className="mt-4 block text-xs font-semibold text-primary">
                {tool.title[translatedIndex]}
              </span>
              <span className="mt-1 block text-xs leading-5 text-muted-foreground">
                {tool.description[translatedIndex]}
              </span>
              {!tool.href && (
                <span className="mt-2 inline-flex text-[10px] text-muted-foreground">
                  {c.notAvailable}
                </span>
              )}
            </>
          );
          const cardClass =
            "flex min-h-48 w-44 shrink-0 snap-start flex-col rounded-2xl " +
            "border border-border/60 p-3.5 text-left " +
            "transition-colors hover:border-primary/40";

          return tool.href ? (
            <Link href={tool.href} key={tool.id} className={cardClass}>
              {content}
            </Link>
          ) : (
            <div key={tool.id} className={`${cardClass} opacity-60`}>
              {content}
            </div>
          );
        })}
      </div>

      {editing && (
        <p className="mt-2 text-xs text-muted-foreground">
          {locale === "fr"
            ? "Sélectionnez les outils à afficher ci-dessous."
            : "Choose which tools appear below."}
        </p>
      )}
    </section>
  );
}

export default function Overview() {
  const { i18n } = useTranslation();
  const locale: Locale = i18n.resolvedLanguage?.startsWith("fr") ? "fr" : "en";
  const c = copy[locale];
  const { user } = useCurrentUser();
  const signedIn = Boolean(user?.id);
  const firstName = user?.name?.trim().split(/\s+/)[0];

  const { documents, loading, error, reload } = useResumeLibrary(signedIn);

  const [editing, setEditing] = useState(false);
  const [visibleSections, setVisibleSections] = useState<SectionId[]>(sections);
  const [visibleTools, setVisibleTools] = useState<string[]>(
    tools.map((tool) => tool.id)
  );
  const [preferencesLoaded, setPreferencesLoaded] = useState(false);

  // Preferences are local to this browser; the app's color/theme is untouched.
  useEffect(() => {
    try {
      const raw = window.localStorage.getItem("cvcomet-overview-layout-v1");
      if (raw) {
        const data = JSON.parse(raw) as {
          sections?: unknown;
          tools?: unknown;
        };
        const savedSections = data.sections;
        const savedTools = data.tools;
        if (Array.isArray(savedSections)) {
          setVisibleSections(
            sections.filter((section) => savedSections.includes(section))
          );
        }
        if (Array.isArray(savedTools)) {
          setVisibleTools(
            tools.map((tool) => tool.id).filter((id) => savedTools.includes(id))
          );
        }
      }
    } catch {
      // Invalid or unavailable browser storage: use the default layout.
    }
    setPreferencesLoaded(true);
  }, []);

  useEffect(() => {
    if (!preferencesLoaded) return;
    try {
      window.localStorage.setItem(
        "cvcomet-overview-layout-v1",
        JSON.stringify({ sections: visibleSections, tools: visibleTools })
      );
    } catch {
      // The overview remains usable when storage is disabled.
    }
  }, [preferencesLoaded, visibleSections, visibleTools]);

  const isVisible = (section: SectionId) => visibleSections.includes(section);

  const toggleSection = (section: SectionId) => {
    setVisibleSections((current) =>
      current.includes(section)
        ? current.filter((item) => item !== section)
        : [...current, section]
    );
  };

  const toggleTool = (id: string) => {
    setVisibleTools((current) =>
      current.includes(id)
        ? current.filter((item) => item !== id)
        : [...current, id]
    );
  };

  const resetLayout = () => {
    setVisibleSections(sections);
    setVisibleTools(tools.map((tool) => tool.id));
  };

  return (
    <div className="mx-auto max-w-[1320px] space-y-6 pb-10">
      {/* Welcome / subscription — no statistics or marketing-heavy hero. */}
      <header className="flex flex-wrap items-center justify-between gap-4 py-1">
        <h1 className="text-base font-semibold tracking-tight sm:text-lg">
          {c.welcome}{firstName ? `, ${firstName}` : ""}!
        </h1>
      </header>

      {/* 1. Documents: three latest items + Create New menu. */}
      {isVisible("documents") && (
        <RecentDocuments
          documents={documents}
          loading={loading}
          error={error}
          retry={() => void reload()}
          locale={locale}
          enabled={signedIn}
        />
      )}

      {/* 2. Jobs, Career Map, Interviews and Tips in a compact grid. */}
      {(["jobs", "map", "interviews", "tips"] as SectionId[]).some(isVisible) && (
        <div className="grid items-stretch gap-5 md:grid-cols-2 lg:grid-cols-3">
          {isVisible("jobs") && (
            <JobOpenings enabled={signedIn} locale={locale} />
          )}
          {isVisible("map") && <CareerMapPanel locale={locale} />}
          {isVisible("interviews") && (
            <InterviewsPanel enabled={signedIn} locale={locale} />
          )}
          {isVisible("tips") && <TipsPanel locale={locale} />}
        </div>
      )}

      {/* 3. Horizontal tools catalog, like the reference screenshots. */}
      {isVisible("tools") && (
        <ToolsPanel
          locale={locale}
          editing={editing}
          visibleTools={visibleTools}
        />
      )}

      {/* 4. Edit Layout: hide/show sections and tools, without styling changes. */}
      {editing && (
        <section className={`${panelStyle} space-y-5 p-5 sm:p-7`}>
          <div className="flex flex-wrap items-center justify-between gap-3">
            <h2 className={panelTitle}>{c.edit}</h2>
            <Button variant="ghost" size="sm" onClick={resetLayout}>
              <RotateCcw className="size-4" />
              {c.reset}
            </Button>
          </div>

          <div>
            <h3 className="mb-3 text-xs font-semibold">{c.visibleSections}</h3>
            <div className="flex flex-wrap gap-2">
              {sections.map((section) => {
                const sectionName =
                  section === "documents" ? c.documents :
                  section === "jobs" ? c.jobs :
                  section === "map" ? c.map :
                  section === "interviews" ? c.interviews :
                  section === "tips" ? c.tips : c.allTools;
                const checked = isVisible(section);

                return (
                  <button
                    type="button"
                    key={section}
                    aria-pressed={checked}
                    onClick={() => toggleSection(section)}
                    className={
                      "inline-flex items-center gap-2 rounded-lg border " +
                      "px-3 py-2 text-xs transition-colors " +
                      (checked
                        ? "border-primary/50 bg-primary/10 text-primary"
                        : "bg-background text-muted-foreground")
                    }
                  >
                    {checked && <Check className="size-3" />}
                    {sectionName}
                  </button>
                );
              })}
            </div>
          </div>

          <div>
            <h3 className="mb-3 text-xs font-semibold">{c.visibleTools}</h3>
            <div className="flex flex-wrap gap-2">
              {tools.map((tool) => {
                const checked = visibleTools.includes(tool.id);
                return (
                  <button
                    type="button"
                    key={tool.id}
                    aria-pressed={checked}
                    onClick={() => toggleTool(tool.id)}
                    className={
                      "inline-flex items-center gap-2 rounded-lg border " +
                      "px-3 py-2 text-xs transition-colors " +
                      (checked
                        ? "border-primary/50 bg-primary/10 text-primary"
                        : "bg-background text-muted-foreground")
                    }
                  >
                    {checked && <Check className="size-3" />}
                    {tool.title[locale === "fr" ? 0 : 1]}
                  </button>
                );
              })}
            </div>
          </div>
        </section>
      )}
    </div>
  );
}
