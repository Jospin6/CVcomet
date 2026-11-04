"use client";
import { translateCentral } from "@/lib/i18n/central-copy";

import { useState } from "react";
import {
  ArrowLeft,
  ArrowUpRight,
  Bookmark,
  BriefcaseBusiness,
  ChevronDown,
  ChevronUp,
  Clock3,
  FileText,
  Heart,
  Mail,
  MapPin,
  MessagesSquare,
  Monitor,
} from "lucide-react";

import { Button } from "@/components/ui/button";
import { JobDescription } from "@/components/jobs/job-description";

export type FindJob = {
  id: string;
  externalId: string;
  provider: string;
  title: string;
  company: string;
  description: string;
  logoUrl?: string | null;
  eligibleCountries?: string[];
  location: string | null;
  remote: boolean | null;
  contractType: string | null;
  seniority?: string | null;
  salaryMin: number | null;
  salaryMax: number | null;
  currency: string | null;
  publishedAt: string | null;
  sourceUrl: string;
  applyUrl: string;
  skills: string[];
  attribution: string;
  match?: {
    score: number | null;
    matched: string[];
    missing: string[];
    explanation: string;
  };
};

export type PrepareAction = "workspace" | "resume" | "interview" | "letter";

export function companyName(company: string): string {
  if (company.includes(" ") || /[A-Z]/.test(company.slice(1))) {
    return company;
  }

  return company
    .split(/[-_]/)
    .filter(Boolean)
    .map((part) => part[0].toUpperCase() + part.slice(1))
    .join(" ");
}

export function jobSalary(job: FindJob): string | null {
  const { salaryMin, salaryMax, currency } = job;
  if (salaryMin === null && salaryMax === null) return null;

  const format = (value: number) =>
    new Intl.NumberFormat("en", { maximumFractionDigits: 0 }).format(value);

  const amount = salaryMin !== null && salaryMax !== null
    ? salaryMin === salaryMax
      ? format(salaryMin)
      : `${format(salaryMin)}–${format(salaryMax)}`
    : salaryMin !== null
      ? `From ${format(salaryMin)}`
      : `Up to ${format(salaryMax!)}`;

  // Do not assume salary frequency. Providers may return annual or hourly figures.
  return `${currency || ""} ${amount}`.trim();
}

export function publishedLabel(
  value: string | null,
  french: boolean,
): string | null {
  if (!value) return null;
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return null;

  return date.toLocaleDateString(french ? "fr-FR" : "en-US", {
    day: "numeric",
    month: "short",
    year: "numeric",
    timeZone: "UTC",
  });
}

export function CompanyLogo({
  name,
  logoUrl,
  size = "md",
}: {
  name: string;
  logoUrl?: string | null;
  size?: "sm" | "md" | "lg";
}) {
  const [failed, setFailed] = useState(false);
  const boxSize = size === "lg"
    ? "size-12"
    : size === "sm"
      ? "size-10"
      : "size-11";

  // Display only the recruiting company's original logo. Never use
  // a job-board or distribution platform logo as the fallback.
  const safeLogo = (() => {
    try {
      if (!logoUrl) return null;
      const parsed = new URL(logoUrl);
      return parsed.protocol === "https:" ? parsed.href : null;
    } catch {
      return null;
    }
  })();

  return (
    <span
      className={`inline-flex ${boxSize} shrink-0 items-center justify-center`}
      title={name}
    >
      {safeLogo && !failed ? (
        // eslint-disable-next-line @next/next/no-img-element
        <img
          src={safeLogo}
          alt={name ? `${name} logo` : ""}
          className="max-h-full max-w-full object-contain"
          referrerPolicy="no-referrer"
          loading="lazy"
          onError={() => setFailed(true)}
        />
      ) : (
        <BriefcaseBusiness
          className="size-7 text-primary"
          aria-label={name ? `Job at ${name}` : "Job offer"}
          role="img"
        />
      )}
    </span>
  );
}

type JobRowProps = {
  job: FindJob;
  saved: boolean;
  saving: boolean;
  french: boolean;
  onOpen: (job: FindJob) => void;
  onSave: (job: FindJob) => void;
};

export function JobResultRow({
  job,
  saved,
  saving,
  french,
  onOpen,
  onSave,
}: JobRowProps) {
  const published = publishedLabel(job.publishedAt, french);
  const salary = jobSalary(job);

  return (
    <article
      className={
        "group flex items-start gap-3 rounded-2xl border " +
        "bg-card px-4 py-4 transition-[box-shadow,border-color] " +
        "hover:border-primary/20 hover:shadow-sm sm:gap-4 sm:px-5"
      }
    >
      <CompanyLogo
        name={job.company}
        logoUrl={job.logoUrl}
      />

      <button
        type="button"
        onClick={() => onOpen(job)}
        className="min-w-0 flex-1 text-left focus-visible:rounded focus-visible:outline-primary"
        aria-label={`${job.title} — ${companyName(job.company)}`}
      >
        <h3 className="truncate text-[15px] font-semibold text-foreground group-hover:text-primary sm:text-base">
          {job.title}
        </h3>
        <p className="mt-0.5 truncate text-sm text-foreground/85">
          {companyName(job.company)}
          {salary && <span className="text-muted-foreground"> · {salary}</span>}
        </p>
        <div className="mt-2 flex flex-wrap items-center gap-x-3 gap-y-1 text-xs text-muted-foreground">
          <Meta icon={Clock3}>
            {published || (translateCentral(french ? "fr" : "en", "uiText.components_jobs_find_jobs_view.text001"))}
          </Meta>
          {job.location && <Meta icon={MapPin}>{job.location}</Meta>}
          {job.contractType && <Meta icon={Clock3}>{job.contractType}</Meta>}
          {job.remote !== null && (
            <Meta icon={Monitor}>
              {job.remote
                ? (translateCentral(french ? "fr" : "en", "uiText.components_jobs_find_jobs_view.text002"))
                : (translateCentral(french ? "fr" : "en", "uiText.components_jobs_find_jobs_view.text003"))}
            </Meta>
          )}
        </div>
      </button>

      {job.match && job.match.score !== null && (
        <span
          title={translateCentral(french ? "fr" : "en", "uiText.components_jobs_find_jobs_view.text004")}
          className="hidden shrink-0 rounded-full bg-primary/10 px-2 py-1 text-xs text-primary md:inline-flex"
        >
          {job.match.score}%
        </span>
      )}

      <button
        type="button"
        onClick={() => onSave(job)}
        disabled={saving}
        aria-label={saved
          ? (translateCentral(french ? "fr" : "en", "uiText.components_jobs_find_jobs_view.text005"))
          : (translateCentral(french ? "fr" : "en", "uiText.components_jobs_find_jobs_view.text006"))}
        aria-pressed={saved}
        className={
          "flex size-10 shrink-0 items-center justify-center rounded-xl " +
          "border text-muted-foreground transition-colors hover:border-primary/40 " +
          "hover:text-primary disabled:opacity-50"
        }
      >
        <Heart className={`size-4 ${saved ? "fill-primary text-primary" : ""}`} />
      </button>
    </article>
  );
}

function Meta({
  icon: Icon,
  children,
}: {
  icon: typeof Clock3;
  children: React.ReactNode;
}) {
  return (
    <span className="inline-flex min-w-0 items-center gap-1">
      <Icon className="size-3.5 shrink-0" />
      <span className="truncate">{children}</span>
    </span>
  );
}

type JobDetailProps = {
  job: FindJob;
  saved: boolean;
  saving: boolean;
  preparing: boolean;
  french: boolean;
  onBack: () => void;
  onSave: (job: FindJob) => void;
  onPrepare: (job: FindJob, action: PrepareAction) => void;
};

export function JobDetailView({
  job,
  saved,
  saving,
  preparing,
  french,
  onBack,
  onSave,
  onPrepare,
}: JobDetailProps) {
  const [expanded, setExpanded] = useState<"resume" | "interview" | "letter">("resume");
  const salary = jobSalary(job);
  const published = publishedLabel(job.publishedAt, french);
  const local = french
    ? {
        back: "Retour aux offres",
        save: saved ? "Enregistrée" : "Enregistrer",
        apply: "Postuler",
        prepare: "Préparer cette candidature",
        resume: "Adapter mon CV",
        resumeTitle: "Adaptez votre CV à ce poste",
        resumeDescription: "Comparez votre parcours à l'offre, puis préparez un CV ciblé.",
        resumeAction: "Adapter mon CV",
        interview: "Préparer un entretien",
        interviewDescription: "Entraînez-vous avec des questions adaptées au poste.",
        interviewAction: "Préparer l'entretien",
        letter: "Rédiger une lettre de motivation",
        letterDescription: "Choisissez votre CV et créez une lettre liée au dossier.",
        letterAction: "Créer une lettre",
        skills: "Compétences mentionnées",
        match: "Correspondance indicative",
      }
    : {
        back: "Back to Search",
        save: saved ? "Saved" : "Save Job",
        apply: "Apply",
        prepare: "Prepare for this job",
        resume: "Tailor Your Resume",
        resumeTitle: "Be the perfect match.",
        resumeDescription: "Tailor your resume to this job with your existing CV.",
        resumeAction: "Tailor Your Resume",
        interview: "Practice Job Interview",
        interviewDescription: "Practice questions related to this role.",
        interviewAction: "Prepare Interview",
        letter: "Write a Cover Letter",
        letterDescription: "Create a cover letter linked to this application.",
        letterAction: "Write a Cover Letter",
        skills: "Skills mentioned",
        match: "Estimated match",
      };

  const accordionItems = [
    { id: "resume" as const, title: local.resume, description: local.resumeDescription, action: local.resumeAction, icon: FileText },
    { id: "interview" as const, title: local.interview, description: local.interviewDescription, action: local.interviewAction, icon: MessagesSquare },
    { id: "letter" as const, title: local.letter, description: local.letterDescription, action: local.letterAction, icon: Mail },
  ];

  return (
    <div className="mx-auto max-w-6xl space-y-7 pb-12">
      <button
        type="button"
        onClick={onBack}
        className="inline-flex items-center gap-2 text-sm font-medium hover:text-primary"
      >
        <ArrowLeft className="size-4" />
        {local.back}
      </button>

      <div className="grid items-start gap-5 lg:grid-cols-[minmax(0,1fr)_290px] xl:grid-cols-[minmax(0,1fr)_310px]">
        <article className="min-w-0 rounded-2xl border bg-card p-5 sm:p-7 lg:p-8">
          <div className="flex flex-wrap items-start gap-3 sm:gap-4">
            <CompanyLogo
              name={job.company}
              logoUrl={job.logoUrl}
                    size="lg"
            />

            <div className="min-w-0 flex-1">
              <h1 className="text-xl font-semibold leading-snug tracking-tight sm:text-2xl">
                {job.title}
              </h1>
              <p className="mt-1 text-sm text-muted-foreground">
                {companyName(job.company)}
              </p>
            </div>

            <div className="flex flex-wrap gap-2">
              <Button
                size="sm"
                variant="outline"
                disabled={saving}
                onClick={() => onSave(job)}
              >
                <Heart className={`size-4 ${saved ? "fill-primary" : ""}`} />
                {local.save}
              </Button>
              <Button size="sm" asChild>
                <a href={job.applyUrl} target="_blank" rel="noopener noreferrer">
                  {local.apply}
                  <ArrowUpRight className="size-4" />
                </a>
              </Button>
            </div>
          </div>

          {salary && (
            <p className="mt-5 text-lg font-medium text-foreground">
              {salary}
            </p>
          )}

          <div className="mt-4 flex flex-wrap gap-2 text-xs text-muted-foreground">
            {job.location && <DetailTag icon={MapPin}>{job.location}</DetailTag>}
            <DetailTag icon={Clock3}>
              {published || (translateCentral(french ? "fr" : "en", "uiText.components_jobs_find_jobs_view.text007"))}
            </DetailTag>
            {job.contractType && <DetailTag icon={Clock3}>{job.contractType}</DetailTag>}
            {job.remote !== null && (
              <DetailTag icon={Monitor}>
                {job.remote
                  ? (translateCentral(french ? "fr" : "en", "uiText.components_jobs_find_jobs_view.text008"))
                  : (translateCentral(french ? "fr" : "en", "uiText.components_jobs_find_jobs_view.text009"))}
              </DetailTag>
            )}
            {job.seniority && (
              <DetailTag icon={BriefcaseBusiness}>{job.seniority}</DetailTag>
            )}
          </div>

          {job.match && (
            <div className="mt-5 rounded-xl border bg-muted/30 px-4 py-3 text-sm">
              <p className="font-medium">
                {local.match}: {job.match.score === null ? (translateCentral(french ? "fr" : "en", "uiText.components_jobs_find_jobs_view.text010")) : `${job.match.score}%`}
              </p>
              <p className="mt-1 text-xs text-muted-foreground">
                {job.match.explanation}
              </p>
            </div>
          )}

          <div className="my-7 border-t" />
          <JobDescription value={job.description} />

          {job.skills.length > 0 && (
            <section className="mt-8 border-t pt-6">
              <h2 className="text-sm font-semibold">{local.skills}</h2>
              <div className="mt-3 flex flex-wrap gap-2">
                {job.skills.slice(0, 20).map((skill) => (
                  <span key={skill} className="rounded-full border px-2.5 py-1 text-xs">
                    {skill}
                  </span>
                ))}
              </div>
            </section>
          )}

        </article>

        <aside className="rounded-2xl border bg-card p-4 shadow-sm lg:sticky lg:top-6">
          <h2 className="mb-4 px-1 text-base font-semibold">{local.prepare}</h2>
          <div className="space-y-2">
            {accordionItems.map((item) => {
              const isOpen = expanded === item.id;
              const Icon = item.icon;

              return (
                <section key={item.id} className="overflow-hidden rounded-xl border bg-background">
                  <button
                    type="button"
                    aria-expanded={isOpen}
                    onClick={() => setExpanded(item.id)}
                    className={
                      "flex w-full items-center justify-between gap-3 " +
                      "px-3 py-3 text-left text-sm font-medium"
                    }
                  >
                    {item.title}
                    {isOpen
                      ? <ChevronUp className="size-4" />
                      : <ChevronDown className="size-4" />}
                  </button>

                  {isOpen && (
                    <div className="space-y-4 border-t px-3 pb-3 pt-4">
                      <div className="rounded-xl bg-muted/40 p-4">
                        <Icon className="size-6 text-primary" />
                        <h3 className="mt-3 text-base font-semibold">
                          {item.id === "resume"
                            ? local.resumeTitle
                            : item.title}
                        </h3>
                        <p className="mt-2 text-sm leading-6 text-muted-foreground">
                          {item.description}
                        </p>
                      </div>
                      <Button
                        className="w-full"
                        variant="outline"
                        disabled={preparing}
                        onClick={() => onPrepare(job, item.id)}
                      >
                        {item.action}
                        <ArrowUpRight className="size-4" />
                      </Button>
                    </div>
                  )}
                </section>
              );
            })}
          </div>

          <button
            type="button"
            className="mt-4 flex w-full items-center justify-center gap-2 text-xs text-muted-foreground hover:text-primary"
            disabled={preparing}
            onClick={() => onPrepare(job, "workspace")}
          >
            <Bookmark className="size-3.5" />
            {translateCentral(french ? "fr" : "en", "uiText.components_jobs_find_jobs_view.text011")}
          </button>
        </aside>
      </div>
    </div>
  );
}

function DetailTag({
  icon: Icon,
  children,
}: {
  icon: typeof Clock3;
  children: React.ReactNode;
}) {
  return (
    <span className="inline-flex items-center gap-1 rounded bg-muted/60 px-2 py-1">
      <Icon className="size-3.5" />
      {children}
    </span>
  );
}
