"use client";
import { translateCentral } from "@/lib/i18n/central-copy";

import { AlertCircle, ArrowUpRight, CheckCircle2, ClipboardList, ShieldCheck } from "lucide-react";
import Link from "next/link";
import type { JobIntelligence } from "@/lib/career/job-intelligence";

type Props = { intelligence: JobIntelligence; language: "fr" | "en" };

export function JobIntelligencePanel({ intelligence, language }: Props) {
  const fr = language === "fr";
  const statusLabels = fr ? {
    VERIFY: "À confirmer", PARTIAL: "Partiellement documenté", NOT_DEMONSTRATED: "Non documenté", DEMONSTRATED: "Documenté",
  } : {
    VERIFY: "To verify", PARTIAL: "Partially evidenced", NOT_DEMONSTRATED: "Not evidenced", DEMONSTRATED: "Evidenced",
  };
  const actions = intelligence.actions.filter(action => action.kind !== "HIGHLIGHT");
  const highlights = intelligence.actions.filter(action => action.kind === "HIGHLIGHT");
  return <section className="app-section space-y-5" aria-labelledby="job-intelligence-heading">
    <div className="flex flex-wrap items-start justify-between gap-3">
      <div>
        <h2 id="job-intelligence-heading" className="text-xl font-semibold">{translateCentral(fr ? "fr" : "en", "uiText.components_career_job_intelligence_panel.text001")}</h2>
        <p className="mt-1 text-sm leading-6 text-muted-foreground">{translateCentral(fr ? "fr" : "en", "uiText.components_career_job_intelligence_panel.text002")}</p>
      </div>
      <span className="rounded-full border px-3 py-1 text-xs font-medium">{intelligence.coveragePercent}% {translateCentral(fr ? "fr" : "en", "uiText.components_career_job_intelligence_panel.text003")}</span>
    </div>
    <div className="grid grid-cols-2 gap-2 sm:grid-cols-4" aria-label={translateCentral(fr ? "fr" : "en", "uiText.components_career_job_intelligence_panel.text004")}>
      {([
        ["Documentées", "Evidenced", intelligence.demonstratedCount],
        ["Partielles", "Partial", intelligence.partialCount],
        ["Sans preuve", "No evidence", intelligence.missingCount],
        ["À vérifier", "To verify", intelligence.verifyCount],
      ] as const).map(([labelFr, labelEn, count]) => <div key={labelEn} className="rounded-xl border p-3">
        <p className="text-2xl font-semibold tabular-nums">{count}</p>
        <p className="mt-1 text-xs text-muted-foreground">{fr ? labelFr : labelEn}</p>
      </div>)}
    </div>
    {intelligence.warnings.length > 0 && <div className="rounded-xl border bg-muted/40 p-4 text-sm" role="note">
      <div className="mb-2 flex items-center gap-2 font-semibold"><ShieldCheck className="size-4" />{translateCentral(fr ? "fr" : "en", "uiText.components_career_job_intelligence_panel.text005")}</div>
      <ul className="list-disc space-y-1 pl-5 text-muted-foreground">{intelligence.warnings.map((warning, i) => <li key={i}>{warning}</li>)}</ul>
    </div>}
    <div className="space-y-3">
      <h3 className="flex items-center gap-2 font-semibold"><ClipboardList className="size-5" />{translateCentral(fr ? "fr" : "en", "uiText.components_career_job_intelligence_panel.text006")}</h3>
      {!actions.length && <p className="text-sm text-muted-foreground">{translateCentral(fr ? "fr" : "en", "uiText.components_career_job_intelligence_panel.text007")}</p>}
      {actions.slice(0, 8).map((action, index) => <details key={action.requirementId} className="rounded-xl border p-4">
        <summary className="cursor-pointer text-sm font-medium"><span className="mr-2 text-muted-foreground">{index + 1}.</span>{action.title}
          <span className="ml-2 text-xs font-normal text-muted-foreground">· {statusLabels[action.status]} · {action.priority === "REQUIRED" ? (translateCentral(fr ? "fr" : "en", "uiText.components_career_job_intelligence_panel.text008")) : action.priority === "PREFERRED" ? (translateCentral(fr ? "fr" : "en", "uiText.components_career_job_intelligence_panel.text009")) : (translateCentral(fr ? "fr" : "en", "uiText.components_career_job_intelligence_panel.text010"))}</span>
        </summary>
        <div className="mt-3 space-y-3 text-sm leading-6">
          <p>{action.nextStep}</p>
          <div><p className="text-xs font-semibold text-muted-foreground">{translateCentral(fr ? "fr" : "en", "uiText.components_career_job_intelligence_panel.text011")}</p><blockquote className="mt-1 border-l-2 pl-3 text-muted-foreground">{action.postingQuote}</blockquote></div>
          {action.candidateSources.length ? <div><p className="text-xs font-semibold text-muted-foreground">{translateCentral(fr ? "fr" : "en", "uiText.components_career_job_intelligence_panel.text012")}</p>
            <ul className="mt-1 space-y-2">{action.candidateSources.map((source, idx) => <li key={`${source.path}-${idx}`} className="rounded-lg bg-muted/50 p-2"><span className="font-medium">{source.label}</span><p className="text-muted-foreground">{source.quote}</p></li>)}</ul>
          </div> : <p className="flex items-center gap-2 text-muted-foreground"><AlertCircle className="size-4" />{translateCentral(fr ? "fr" : "en", "uiText.components_career_job_intelligence_panel.text013")}</p>}
        </div>
      </details>)}
    </div>
    {highlights.length > 0 && <details className="text-sm"><summary className="flex cursor-pointer items-center gap-2 font-medium"><CheckCircle2 className="size-4" />{translateCentral(fr ? "fr" : "en", "uiText.components_career_job_intelligence_panel.text014")} ({highlights.length})</summary>
      <ul className="mt-2 list-disc space-y-1 pl-5 text-muted-foreground">{highlights.map(action => <li key={action.requirementId}>{action.title}</li>)}</ul>
    </details>}
    <Link href="/dashboard/profile" className="inline-flex items-center gap-2 text-sm text-primary underline">{translateCentral(fr ? "fr" : "en", "uiText.components_career_job_intelligence_panel.text015")}<ArrowUpRight className="size-4" /></Link>
  </section>;
}
