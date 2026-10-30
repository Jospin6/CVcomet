"use client";

import { useState, type KeyboardEvent, type ReactNode } from "react";
import Link from "next/link";
import {
  ArrowRight, CheckCircle2, ChevronDown, FilePenLine,
  Info, SearchCheck, ShieldAlert, Sparkles,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { ScoreRing } from "@/components/ui/score-ring";
import type { JobAnalysis, MatchResult, RequirementResult } from "@/lib/career/job-schema";
import { buildJobIntelligence } from "@/lib/career/job-intelligence";

type Tab = "overview" | "improvements" | "requirements" | "prepare";
type RequirementStatus = RequirementResult["status"];
type Props = {
  analysis: JobAnalysis;
  match: MatchResult;
  language: "fr" | "en";
  busy: boolean;
  onTailor: () => void;
  onImprove: () => void;
  proposalContent: ReactNode;
  prepareContent: ReactNode;
  originalText: string;
  cvId: string | null;
};

const statusStyle: Record<RequirementStatus, string> = {
  DEMONSTRATED: "bg-emerald-500/10 text-emerald-700 dark:text-emerald-300",
  PARTIAL: "bg-amber-500/10 text-amber-700 dark:text-amber-300",
  NOT_DEMONSTRATED: "bg-red-500/10 text-red-700 dark:text-red-300",
  VERIFY: "bg-muted text-muted-foreground",
};

const issueStyle = "rounded-lg bg-red-500/10 p-3 dark:bg-red-500/10";
const fixStyle = "rounded-lg bg-emerald-500/10 p-3 dark:bg-emerald-500/10";

export function JobMatchReport({
  analysis, match, language, busy, onTailor, onImprove,
  proposalContent, prepareContent, originalText, cvId,
}: Props) {
  const [tab, setTab] = useState<Tab>("overview");
  const [category, setCategory] = useState("");
  const [status, setStatus] = useState("");
  const fr = language === "fr";
  const intelligence = buildJobIntelligence(analysis, match, language);
  const importance = { REQUIRED: 0, PREFERRED: 1, MENTIONED: 2 } as const;
  const attention = { NOT_DEMONSTRATED: 0, PARTIAL: 1, VERIFY: 2, DEMONSTRATED: 3 } as const;
  const issues = intelligence.actions
    .filter(action => action.status !== "DEMONSTRATED")
    .sort((a, b) =>
      importance[a.priority] - importance[b.priority] ||
      attention[a.status] - attention[b.status]
    );
  const improvements = match.requirements.filter(item => item.status !== "DEMONSTRATED");
  const visibleRequirements = match.requirements.filter(item =>
    (!category || item.category === category) && (!status || item.status === status)
  );

  const labels = fr ? {
    overview: "Vue d’ensemble", improvements: "Améliorations", requirements: "Exigences", prepare: "Préparer",
    score: "Correspondance estimée", notRated: "Non évaluée", required: "Obligatoire", preferred: "Souhaité",
    evidenced: "Démontré", partial: "Partiel", missing: "Non démontré", verify: "À vérifier",
    priority: "Mes 3 priorités", noPriority: "Aucune amélioration prioritaire identifiée.",
    seeImprovements: "Voir les améliorations", improveResume: "Améliorer mon CV",
    explained: "Analyse basée sur les preuves de votre profil et de votre CV.",
    progress: "Répartition par domaine", detail: "Voir les preuves", jobExtract: "Exigence de l’offre",
    current: "Ce qui manque dans le CV", next: "Comment améliorer le CV", proof: "Ce que votre profil indique",
    none: "Aucun élément retrouvé dans le CV ou le profil.", noIssue: "Aucune lacune identifiée dans les critères évalués.",
    categories: "Catégorie", assessment: "Statut", all: "Tous", job: "Description du poste",
    source: "Texte de l’offre", limits: "Limites de cette analyse", fullAnalysis: "Exigences détaillées",
    actual: "Ce statut indique une preuve absente ou incomplète, pas nécessairement une compétence absente.",
    profileOnly: "Comparaison basée sur le profil seulement. Sélectionnez un CV pour juger le document que vous enverrez.",
  } : {
    overview: "Overview", improvements: "Improvements", requirements: "Requirements", prepare: "Prepare",
    score: "Estimated match", notRated: "Not rated", required: "Required", preferred: "Preferred",
    evidenced: "Evidenced", partial: "Partial", missing: "Not evidenced", verify: "To verify",
    priority: "My 3 priorities", noPriority: "No priority improvements identified.",
    seeImprovements: "Review improvements", improveResume: "Improve my resume",
    explained: "Based on available evidence in your profile and resume.",
    progress: "Match by area", detail: "View evidence", jobExtract: "Job requirement",
    current: "What the resume is missing", next: "How to improve the resume", proof: "What your profile says",
    none: "No supporting information found in your resume or profile.", noIssue: "No evidence gaps found among evaluated requirements.",
    categories: "Category", assessment: "Assessment", all: "All", job: "Role description",
    source: "Original job text", limits: "Assessment limitations", fullAnalysis: "Detailed requirements",
    actual: "A gap means missing or incomplete evidence, not necessarily a missing skill.",
    profileOnly: "This compares your profile only. Select a resume to evaluate the document you would submit.",
  };
  const statuses: Record<RequirementStatus, string> = {
    DEMONSTRATED: labels.evidenced, PARTIAL: labels.partial,
    NOT_DEMONSTRATED: labels.missing, VERIFY: labels.verify,
  };
  const nav: { value: Tab; label: string; count?: number }[] = [
    { value: "overview", label: labels.overview },
    { value: "improvements", label: labels.improvements, count: improvements.length },
    { value: "requirements", label: labels.requirements, count: match.requirements.length },
    { value: "prepare", label: labels.prepare },
  ];
  const countCards = [
    { value: intelligence.demonstratedCount, label: labels.evidenced, color: "text-emerald-700 dark:text-emerald-300" },
    { value: intelligence.partialCount, label: labels.partial, color: "text-amber-700 dark:text-amber-300" },
    { value: intelligence.missingCount, label: labels.missing, color: "text-red-700 dark:text-red-300" },
    { value: intelligence.verifyCount, label: labels.verify, color: "text-muted-foreground" },
  ];
  const handleTabKey = (event: KeyboardEvent<HTMLButtonElement>, index: number) => {
    if (event.key !== "ArrowRight" && event.key !== "ArrowLeft" &&
        event.key !== "Home" && event.key !== "End") return;
    event.preventDefault();
    const next = event.key === "Home" ? 0
      : event.key === "End" ? nav.length - 1
      : (index + (event.key === "ArrowRight" ? 1 : -1) + nav.length) % nav.length;
    setTab(nav[next].value);
    document.getElementById(`job-match-tab-${nav[next].value}`)?.focus();
  };
  const areas = [
    [fr ? "Compétences essentielles" : "Essential skills", match.components.essentialSkills],
    [fr ? "Compétences souhaitées" : "Desirable skills", match.components.desirableSkills],
    [fr ? "Expérience" : "Experience", match.components.experience],
    [fr ? "Qualifications" : "Qualifications", match.components.qualifications],
  ] as const;

  return (
    <div className="space-y-5">
      <section className="flex flex-wrap items-start justify-between gap-4">
        <div className="min-w-0">
          <h2 className="text-xl font-semibold">{analysis.title || (fr ? "Poste analysé" : "Analyzed role")}</h2>
          <p className="mt-1 text-sm text-muted-foreground">
            {[analysis.company, analysis.location].filter(Boolean).join(" · ")}
          </p>
        </div>
        {cvId && (
          <Button variant="outline" size="sm" asChild>
            <Link href={`/dashboard/resumes/${cvId}`}>
              <FilePenLine className="size-4" />
              {fr ? "Mon CV" : "My resume"}
            </Link>
          </Button>
        )}
      </section>

      <div className="flex gap-1 overflow-x-auto border-b" role="tablist" aria-label={fr ? "Résultats d’analyse" : "Analysis results"}>
        {nav.map((item, index) => (
          <button
            key={item.value}
            id={`job-match-tab-${item.value}`}
            role="tab"
            type="button"
            aria-selected={tab === item.value}
            tabIndex={tab === item.value ? 0 : -1}
            onKeyDown={event => handleTabKey(event, index)}
            aria-controls={`job-match-panel-${item.value}`}
            onClick={() => setTab(item.value)}
            className={`shrink-0 border-b-2 px-3 py-3 text-sm transition-colors ${
              tab === item.value
                ? "border-primary font-semibold text-foreground"
                : "border-transparent text-muted-foreground hover:text-foreground"
            }`}
          >
            {item.label}
            {item.count !== undefined && <span className="ml-1.5 text-xs opacity-60">{item.count}</span>}
          </button>
        ))}
      </div>

      {tab === "overview" && (
        <section role="tabpanel" id="job-match-panel-overview" aria-labelledby="job-match-tab-overview" className="space-y-5">
          <div className="grid gap-4 lg:grid-cols-[minmax(0,1fr)_minmax(0,1.25fr)]">
            <div className="rounded-xl border p-4">
              <p className="text-sm font-medium">{labels.score}</p>
              <div className="mt-3 flex items-center gap-5">
                {match.overallScore === null ? (
                  <strong className="text-2xl">—</strong>
                ) : (
                  <ScoreRing value={match.overallScore} label={labels.score} />
                )}
                <div className="space-y-1 text-sm text-muted-foreground">
                  <p className="font-medium text-foreground">
                    {match.overallScore === null ? labels.notRated : `${match.evaluatedCount}/${match.totalCount} ${fr ? "critères évalués" : "requirements assessed"}`}
                  </p>
                  <p className="text-xs leading-5">{labels.explained}</p>
                </div>
              </div>
            </div>
            <div className="rounded-xl border p-4">
              <h3 className="mb-4 text-sm font-medium">{labels.progress}</h3>
              <div className="space-y-3">
                {areas.map(([label, value]) => (
                  <div key={label}>
                    <div className="mb-1 flex justify-between gap-3 text-xs">
                      <span className="text-muted-foreground">{label}</span>
                      <span className="font-medium tabular-nums">{value === null ? "—" : `${Math.round(value)}%`}</span>
                    </div>
                    <div className="h-1.5 overflow-hidden rounded-full bg-muted">
                      <div className="h-full rounded-full bg-primary transition-[width]" style={{ width: `${value === null ? 0 : Math.max(0, Math.min(value, 100))}%` }} />
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </div>

          <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
            {countCards.map(card => (
              <div key={card.label} className="rounded-lg border px-3 py-3">
                <p className={`text-2xl font-semibold tabular-nums ${card.color}`}>{card.value}</p>
                <p className="mt-1 text-xs text-muted-foreground">{card.label}</p>
              </div>
            ))}
          </div>

          <section className="rounded-xl border p-4">
            <div className="mb-3 flex items-center justify-between gap-2">
              <h3 className="text-sm font-semibold">{labels.priority}</h3>
              <button onClick={() => setTab("improvements")} className="inline-flex items-center gap-1 text-xs text-primary hover:underline">
                {labels.seeImprovements} <ArrowRight className="size-3.5" />
              </button>
            </div>
            {!issues.length && <p className="text-sm text-muted-foreground">{labels.noPriority}</p>}
            <div className="divide-y">
              {issues.slice(0, 3).map((action, index) => (
                <button key={action.requirementId} type="button" onClick={() => setTab("improvements")} className="flex w-full items-start gap-3 py-3 text-left hover:text-primary">
                  <span className="mt-0.5 text-xs tabular-nums text-muted-foreground">0{index + 1}</span>
                  <span className="min-w-0 flex-1 text-sm leading-5">
                    <span className="block font-medium">{action.title}</span>
                    <span className="mt-1 block line-clamp-2 text-xs text-muted-foreground">{action.nextStep}</span>
                  </span>
                  <ArrowRight className="mt-0.5 size-4 shrink-0 text-muted-foreground" />
                </button>
              ))}
            </div>
            <div className="mt-3 flex flex-wrap gap-2">
              <Button size="sm" onClick={() => setTab("improvements")}>{labels.seeImprovements}</Button>
              <Button size="sm" variant="outline" disabled={busy} onClick={() => { setTab("improvements"); onImprove(); }}>
                <Sparkles className="size-4" /> {labels.improveResume}
              </Button>
            </div>
          </section>
          {match.source === "PROFILE" && (
            <p className="flex items-start gap-2 text-xs text-muted-foreground">
              <Info className="mt-0.5 size-4 shrink-0" /> {labels.profileOnly}
            </p>
          )}
        </section>
      )}

      {tab === "improvements" && (
        <section role="tabpanel" id="job-match-panel-improvements" aria-labelledby="job-match-tab-improvements" className="space-y-4">
          <p className="text-xs text-muted-foreground">{labels.actual}</p>
          <div className="flex flex-wrap gap-2">
            <Button size="sm" onClick={onImprove} disabled={busy}><Sparkles className="size-4" />{labels.improveResume}</Button>
            <Button size="sm" variant="outline" onClick={onTailor} disabled={busy}><FilePenLine className="size-4" />{fr ? "Adapter à l’offre" : "Tailor to this job"}</Button>
            {cvId && <Button size="sm" variant="ghost" asChild><Link href={`/dashboard/resumes/${cvId}`}>{fr ? "Éditer manuellement" : "Edit manually"}</Link></Button>}
          </div>
          {proposalContent}
          {!improvements.length && <div className="rounded-lg border p-4 text-sm text-muted-foreground">{labels.noIssue}</div>}
          <div className="space-y-3">
            {improvements.map(item => {
              const action = intelligence.actions.find(candidate => candidate.requirementId === item.id);
              const isVerify = item.status === "VERIFY";
              return (
                <article key={item.id} className="rounded-xl border p-4">
                  <div className="mb-3 flex flex-wrap items-start justify-between gap-3">
                    <h3 className="min-w-0 flex-1 text-sm font-semibold">{item.title}</h3>
                    <span className={`rounded-full px-2.5 py-1 text-xs ${statusStyle[item.status]}`}>{statuses[item.status]}</span>
                  </div>
                  <div className="grid gap-2 md:grid-cols-2">
                    <div className={isVerify ? "rounded-lg bg-amber-500/10 p-3" : issueStyle}>
                      <p className={`mb-1 text-xs font-semibold ${isVerify ? "text-amber-700 dark:text-amber-300" : "text-red-700 dark:text-red-300"}`}>{labels.current}</p>
                      <p className="text-sm leading-6">{item.status === "PARTIAL"
                        ? (fr ? "Preuve incomplète dans le CV." : "Incomplete evidence in the resume.")
                        : isVerify
                          ? (fr ? "Preuve à confirmer manuellement." : "Evidence needs manual review.")
                          : labels.none}</p>
                    </div>
                    <div className={fixStyle}>
                      <p className="mb-1 text-xs font-semibold text-emerald-700 dark:text-emerald-300">{labels.next}</p>
                      <p className="text-sm leading-6">{action?.nextStep || (fr ? "Ajoutez uniquement un exemple réel et vérifiable." : "Add only a genuine, verifiable example.")}</p>
                    </div>
                  </div>
                  <details className="mt-3 text-xs">
                    <summary className="flex cursor-pointer items-center gap-1 text-muted-foreground">{labels.detail} <ChevronDown className="size-3.5" /></summary>
                    <blockquote className="mt-2 border-l-2 pl-3 leading-6 text-muted-foreground">{item.evidence}</blockquote>
                    {item.evidenceSources.slice(0, 3).map(source => (
                      <div key={source.path} className="mt-2 text-muted-foreground"><strong className="font-medium">{source.label}</strong><p>{source.quote}</p></div>
                    ))}
                  </details>
                </article>
              );
            })}
          </div>
        </section>
      )}

      {tab === "requirements" && (
        <section role="tabpanel" id="job-match-panel-requirements" aria-labelledby="job-match-tab-requirements" className="space-y-4">
          <div className="flex flex-wrap gap-2">
            <label className="sr-only" htmlFor="job-result-category">{labels.categories}</label>
            <select id="job-result-category" className="h-9 max-w-full rounded-md border bg-background px-3 text-sm" value={category} onChange={event => setCategory(event.target.value)}>
              <option value="">{labels.all} · {labels.categories}</option>
              {Array.from(new Set(match.requirements.map(item => item.category))).map(value => (
                <option key={value} value={value}>{fr ? ({ TECHNICAL: "Technique", SOFT_SKILL: "Relationnel", EXPERIENCE: "Expérience", EDUCATION: "Formation", CERTIFICATION: "Certification", LANGUAGE: "Langues", ELIGIBILITY: "Éligibilité", OTHER: "Autres" } as Record<string, string>)[value] : value.replaceAll("_", " ")}</option>
              ))}
            </select>
            <label className="sr-only" htmlFor="job-result-status">{labels.assessment}</label>
            <select id="job-result-status" className="h-9 rounded-md border bg-background px-3 text-sm" value={status} onChange={event => setStatus(event.target.value)}>
              <option value="">{labels.all} · {labels.assessment}</option>
              {(Object.keys(statuses) as RequirementStatus[]).map(value => <option value={value} key={value}>{statuses[value]}</option>)}
            </select>
          </div>
          {!visibleRequirements.length && <p className="text-sm text-muted-foreground">{fr ? "Aucun résultat pour ces filtres." : "No requirements match these filters."}</p>}
          <div className="divide-y rounded-xl border">
            {visibleRequirements.map(item => (
              <details key={item.id} className="group px-4 py-3">
                <summary className="flex cursor-pointer list-none items-start gap-3 text-sm [&::-webkit-details-marker]:hidden">
                  {item.status === "DEMONSTRATED" ? <CheckCircle2 className="mt-0.5 size-4 shrink-0 text-emerald-600" /> : <ShieldAlert className={`mt-0.5 size-4 shrink-0 ${item.status === "NOT_DEMONSTRATED" ? "text-red-600" : "text-muted-foreground"}`} />}
                  <span className="min-w-0 flex-1 font-medium">{item.title}</span>
                  <span className={`shrink-0 rounded-full px-2 py-0.5 text-[11px] ${statusStyle[item.status]}`}>{statuses[item.status]}</span>
                  <ChevronDown className="mt-0.5 size-4 shrink-0 text-muted-foreground transition-transform group-open:rotate-180" />
                </summary>
                <div className="ml-7 mt-3 space-y-3 text-sm">
                  <div><p className="text-xs font-medium text-muted-foreground">{labels.jobExtract}</p><p className="mt-1 leading-6">{item.evidence}</p></div>
                  <div><p className="text-xs font-medium text-muted-foreground">{labels.proof}</p>
                    {item.evidenceSources.length ? item.evidenceSources.map(source => (
                      <div key={source.path} className="mt-2 rounded-md bg-muted/50 p-3"><p className="text-xs font-medium">{source.label}</p><p className="mt-1 whitespace-pre-wrap text-sm leading-6">{source.quote}</p></div>
                    )) : <p className="mt-1 text-muted-foreground">{labels.none}</p>}
                  </div>
                </div>
              </details>
            ))}
          </div>
          <details className="rounded-xl border p-4 text-sm"><summary className="cursor-pointer font-medium">{labels.job}</summary>
            <p className="mt-3 whitespace-pre-wrap leading-6 text-muted-foreground">{analysis.summary || analysis.objective}</p>
            <details className="mt-3"><summary className="cursor-pointer text-xs text-primary">{labels.source}</summary><p className="mt-2 max-h-80 overflow-y-auto whitespace-pre-wrap break-words text-xs leading-6 text-muted-foreground">{originalText}</p></details>
          </details>
          <details className="rounded-xl border p-4 text-sm"><summary className="cursor-pointer font-medium">{labels.limits}</summary><ul className="mt-2 list-disc space-y-1 pl-5 text-xs leading-6 text-muted-foreground">{intelligence.warnings.map((warning, index) => <li key={index}>{warning}</li>)}</ul></details>
        </section>
      )}

      {tab === "prepare" && (
        <section role="tabpanel" id="job-match-panel-prepare" aria-labelledby="job-match-tab-prepare">
          {prepareContent}
        </section>
      )}
    </div>
  );
}
