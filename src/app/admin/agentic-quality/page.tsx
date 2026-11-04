"use client";
import { useEffect, useState } from "react";
import Link from "next/link";
import { useTranslation } from "react-i18next";
import { PageHeader } from "@/components/ui/page-header";
import type { EvaluationOverview, QualityGate } from "@/lib/agentic/agents/evaluation/tools/contracts.tool";
import type { RolloutComparison } from "@/lib/agentic/agents/evaluation/tools/rollout-compare.tool";

const cell = "rounded-xl border border-border bg-card px-4 py-4";
function display(value: number | null, missing: string, suffix = "") { return value === null ? missing : `${value}${suffix}`; }

export default function AgenticQualityPage() {
  const { t, i18n } = useTranslation();
  const locale = i18n.resolvedLanguage?.startsWith("fr") ? "fr-FR" : "en-US";
  const displayValue = (value: number | null, suffix = "") => display(value, t("agenticQuality.unmeasured"), suffix);
  const [data, setData] = useState<EvaluationOverview | null>(null);
  const [error, setError] = useState(false);
  const [rollout, setRollout] = useState<RolloutComparison | null>(null);
  const [rolloutUnavailable, setRolloutUnavailable] = useState(false);
  useEffect(() => {
    const ctrl = new AbortController();
    fetch("/api/admin/agentic/quality", { signal: ctrl.signal, cache: "no-store" })
      .then(response => { if (!response.ok) throw new Error("UNAVAILABLE"); return response.json() as Promise<EvaluationOverview>; })
      .then(setData)
      .catch(() => { if (!ctrl.signal.aborted) setError(true); });
    fetch("/api/admin/agentic/rollout", { signal: ctrl.signal, cache: "no-store" })
      .then(response => { if (!response.ok) throw new Error("UNAVAILABLE"); return response.json() as Promise<RolloutComparison>; })
      .then(setRollout)
      .catch(() => { if (!ctrl.signal.aborted) setRolloutUnavailable(true); });
    return () => ctrl.abort();
  }, []);
  return <main className="mx-auto max-w-6xl space-y-6">
    <PageHeader title={t("agenticQuality.headTitle")} description={t("agenticQuality.headDesc")} />
    {error && <p role="alert" className="text-sm text-destructive">{t("agenticQuality.unavailable")}</p>}
    {!data && !error && <p role="status" className="text-sm text-muted-foreground">{t("agenticQuality.loading")}</p>}
    {data && <>
      <p className="text-xs text-muted-foreground">{new Date(data.window.from).toLocaleDateString(locale)} – {new Date(data.window.until).toLocaleDateString(locale)} · {t("agenticQuality.partialScope")}</p>
      <section className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4" aria-label={t("agenticQuality.ops")}>
        <div className={cell}><p className="text-xs text-muted-foreground">{t("agenticQuality.runs")}</p><p className="mt-2 text-2xl font-semibold tabular-nums">{data.careerAssistant.total}</p></div>
        <div className={cell}><p className="text-xs text-muted-foreground">{t("agenticQuality.completed")}</p><p className="mt-2 text-2xl font-semibold tabular-nums">{displayValue(data.careerAssistant.observedSuccessRate, "%")}</p></div>
        <div className={cell}><p className="text-xs text-muted-foreground">{t("agenticQuality.latency")}</p><p className="mt-2 text-2xl font-semibold tabular-nums">{displayValue(data.careerAssistant.latencyMs.p95, " ms")}</p></div>
        <div className={cell}><p className="text-xs text-muted-foreground">{t("agenticQuality.expired")}</p><p className="mt-2 text-2xl font-semibold tabular-nums">{data.missions.expiredLeases}</p></div>
      </section>
      <section className={cell}>
        <div className="flex flex-wrap items-center justify-between gap-3"><h2 className="font-semibold">{t("agenticQuality.gates")}</h2><p className="text-xs font-medium">{data.decision === "BLOCKED" ? t("agenticQuality.blocked") : t("agenticQuality.furtherReview")}</p></div>
        <div className="mt-4 divide-y">
          {data.gates.map((g: QualityGate) => <div className="flex flex-wrap items-start justify-between gap-3 py-3" key={g.key}>
            <div className="max-w-2xl"><p className="text-sm font-medium">{g.key.replaceAll("_", " ")}</p><p className="mt-1 text-xs text-muted-foreground">{g.explanation}</p></div>
            <span className="rounded-md border px-2 py-1 text-xs" aria-label={`${t("agenticQuality.status")} ${g.status}`}>
              {g.status === "PASS" ? t("agenticQuality.pass") : g.status === "FAIL" ? t("agenticQuality.fail") : g.status === "INSUFFICIENT_DATA" ? t("agenticQuality.insufficient") : t("agenticQuality.review")}
            </span>
          </div>)}
        </div>
      </section>
      <section className="grid gap-3 md:grid-cols-2">
        <div className={cell}><h2 className="font-semibold">{t("agenticQuality.missions")}</h2><p className="mt-3 text-sm">{t("agenticQuality.ended")}: {data.missions.completed} · {t("agenticQuality.failed")}: {data.missions.failed} · {t("agenticQuality.running")}: {data.missions.running}</p><p className="mt-2 text-sm">{t("agenticQuality.success")}: {displayValue(data.missions.terminalCompletionPercent, "%")}</p><p className="mt-3 text-xs text-muted-foreground">{t("agenticQuality.toolEvents", { started: data.missions.toolEventCounts.started, completed: data.missions.toolEventCounts.completed, failed: data.missions.toolEventCounts.failed })}</p></div>
        <div className={cell}><h2 className="font-semibold">{t("agenticQuality.usage")}</h2><p className="mt-3 text-sm">{t("agenticQuality.calls")}: {data.aiUsage.trackedCalls}, {t("agenticQuality.priced")}: {data.aiUsage.pricedCalls}</p><p className="mt-2 text-sm">{t("agenticQuality.estimated")}: {data.aiUsage.estimatedUSD === null ? t("agenticQuality.costUnknown") : `${data.aiUsage.estimatedUSD} USD`}</p><p className="mt-3 text-xs text-muted-foreground">{t("agenticQuality.usageNote")}</p></div>
      </section>
      <section className={cell} aria-label={t("agenticQuality.rolloutAria")}>
        <h2 className="font-semibold">{t("agenticQuality.rolloutTitle")}</h2>
        {rolloutUnavailable && <p role="status" className="mt-2 text-sm text-muted-foreground">{t("agenticQuality.rolloutUnavailable")}</p>}
        {!rollout && !rolloutUnavailable && <p role="status" className="mt-2 text-sm text-muted-foreground">{t("agenticQuality.rolloutLoading")}</p>}
        {rollout && <>
          <p className="mt-2 text-xs text-muted-foreground">{t("agenticQuality.configuredMode")}: {rollout.config.effectiveMode} {rollout.config.percent === null ? "" : t("agenticQuality.cohort", { percent: rollout.config.percent })} {rollout.config.killSwitch ? t("agenticQuality.killSwitch") : ""}. {t("agenticQuality.decision")}: {rollout.decision === "BLOCKED" ? t("agenticQuality.blocked") : rollout.decision === "INSUFFICIENT_DATA" ? t("agenticQuality.insufficient") : t("agenticQuality.review")}.</p>
          <div className="mt-3 grid gap-3 md:grid-cols-2">
            {rollout.engines.map(engine => <div className="rounded-xl border p-3" key={engine.engine}>
              <p className="text-sm font-medium">{engine.engine === "GRAPH" ? "LangGraph" : t("agenticQuality.legacy")}</p>
              <p className="mt-1 text-sm">{t("agenticQuality.observations")}: {engine.total} · {t("agenticQuality.completed")}: {displayValue(engine.completionPercent, "%")}</p>
              <p className="text-sm">{t("agenticQuality.latency")}: {displayValue(engine.p95Ms, " ms")}, {t("agenticQuality.fromResponses", { count: engine.sampledCompleted })}.</p>
              <p className="mt-1 text-xs text-muted-foreground">{engine.sampleAdequate ? t("agenticQuality.sampleEnough") : t("agenticQuality.sampleInsufficient")}</p>
            </div>)}
          </div>
          <p className="mt-2 text-xs text-muted-foreground">{t("agenticQuality.historicalNote", { count: rollout.unattributedHistorical })}</p>
        </>}
      </section>
      <section className={cell}><h2 className="font-semibold">{t("agenticQuality.coverage")}</h2><ul className="mt-3 list-disc space-y-1 pl-4 text-xs text-muted-foreground">{data.limitations.map((value: string, i: number) => <li key={i}>{value}</li>)}</ul></section>
    </>}
    <div className="flex flex-wrap gap-5 text-sm"><Link className="underline" href="/admin/quality">{t("agenticQuality.qualityLink")}</Link><Link className="underline" href="/admin">{t("agenticQuality.administration")}</Link></div>
  </main>;
}
