"use client";
import { useEffect, useState } from "react";
import Link from "next/link";
import { PageHeader } from "@/components/ui/page-header";
import type { EvaluationOverview, QualityGate } from "@/lib/agentic/agents/evaluation/tools/contracts.tool";
import type { RolloutComparison } from "@/lib/agentic/agents/evaluation/tools/rollout-compare.tool";

const cell = "rounded-xl border border-border bg-card px-4 py-4";
function display(value: number | null, suffix = "") { return value === null ? "Non mesuré" : `${value}${suffix}`; }

export default function AgenticQualityPage() {
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
    <PageHeader title="Supervision des agents" description="Observations techniques sur 7 jours. Les valeurs manquantes restent non mesurées, et ne prouvent pas la qualité factuelle des réponses." />
    {error && <p role="alert" className="text-sm text-destructive">Supervision indisponible ou accès non autorisé.</p>}
    {!data && !error && <p role="status" className="text-sm text-muted-foreground">Lecture des mesures agrégées…</p>}
    {data && <>
      <p className="text-xs text-muted-foreground">{new Date(data.window.from).toLocaleDateString()} – {new Date(data.window.until).toLocaleDateString()} · Périmètre partiel</p>
      <section className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4" aria-label="Mesures opérationnelles">
        <div className={cell}><p className="text-xs text-muted-foreground">Exécutions Career Assistant</p><p className="mt-2 text-2xl font-semibold tabular-nums">{data.careerAssistant.total}</p></div>
        <div className={cell}><p className="text-xs text-muted-foreground">Terminaisons observées</p><p className="mt-2 text-2xl font-semibold tabular-nums">{display(data.careerAssistant.observedSuccessRate, "%")}</p></div>
        <div className={cell}><p className="text-xs text-muted-foreground">Latence p95 (échantillon)</p><p className="mt-2 text-2xl font-semibold tabular-nums">{display(data.careerAssistant.latencyMs.p95, " ms")}</p></div>
        <div className={cell}><p className="text-xs text-muted-foreground">Leases expirés non réconciliés</p><p className="mt-2 text-2xl font-semibold tabular-nums">{data.missions.expiredLeases}</p></div>
      </section>
      <section className={cell}>
        <div className="flex flex-wrap items-center justify-between gap-3"><h2 className="font-semibold">Contrôles avant mise en production</h2><p className="text-xs font-medium">{data.decision === "BLOCKED" ? "Blocage détecté" : "Validation complémentaire requise"}</p></div>
        <div className="mt-4 divide-y">
          {data.gates.map((g: QualityGate) => <div className="flex flex-wrap items-start justify-between gap-3 py-3" key={g.key}>
            <div className="max-w-2xl"><p className="text-sm font-medium">{g.key.replaceAll("_", " ")}</p><p className="mt-1 text-xs text-muted-foreground">{g.explanation}</p></div>
            <span className="rounded-md border px-2 py-1 text-xs" aria-label={`Statut ${g.status}`}>
              {g.status === "PASS" ? "Conforme" : g.status === "FAIL" ? "Échec" : g.status === "INSUFFICIENT_DATA" ? "Échantillon insuffisant" : "À évaluer"}
            </span>
          </div>)}
        </div>
      </section>
      <section className="grid gap-3 md:grid-cols-2">
        <div className={cell}><h2 className="font-semibold">Missions enregistrées</h2><p className="mt-3 text-sm">Terminées : {data.missions.completed} · Échouées : {data.missions.failed} · En cours : {data.missions.running}</p><p className="mt-2 text-sm">Terminaisons réussies : {display(data.missions.terminalCompletionPercent, "%")}</p><p className="mt-3 text-xs text-muted-foreground">Événements de tools : {data.missions.toolEventCounts.started} démarrés, {data.missions.toolEventCounts.completed} terminés, {data.missions.toolEventCounts.failed} échoués. Ces compteurs ne prouvent pas la fiabilité par outil.</p></div>
        <div className={cell}><h2 className="font-semibold">Consommation IA comptabilisée</h2><p className="mt-3 text-sm">Appels enregistrés : {data.aiUsage.trackedCalls}, tarifés : {data.aiUsage.pricedCalls}</p><p className="mt-2 text-sm">Coût estimé : {data.aiUsage.estimatedUSD === null ? "Indisponible ou incomplet" : `${data.aiUsage.estimatedUSD} USD`}</p><p className="mt-3 text-xs text-muted-foreground">Toutes fonctionnalités IA enregistrées confondues ; ni facture fournisseur, ni coût propre à chaque agent.</p></div>
      </section>
      <section className={cell} aria-label="Comparaison du déploiement progressif">
        <h2 className="font-semibold">Déploiement progressif : ancien moteur / LangGraph</h2>
        {rolloutUnavailable && <p role="status" className="mt-2 text-sm text-muted-foreground">Comparaison indisponible. Vérifier la migration de l’étape 20.</p>}
        {!rollout && !rolloutUnavailable && <p role="status" className="mt-2 text-sm text-muted-foreground">Lecture des observations par moteur…</p>}
        {rollout && <>
          <p className="mt-2 text-xs text-muted-foreground">Mode configuré : {rollout.config.effectiveMode} {rollout.config.percent === null ? "" : `· cohorte LangGraph ${rollout.config.percent} %`} {rollout.config.killSwitch ? "· retour arrière activé" : ""}. Décision : {rollout.decision === "BLOCKED" ? "blocage opérationnel" : rollout.decision === "INSUFFICIENT_DATA" ? "échantillon insuffisant" : "examen humain requis"}.</p>
          <div className="mt-3 grid gap-3 md:grid-cols-2">
            {rollout.engines.map(engine => <div className="rounded-xl border p-3" key={engine.engine}>
              <p className="text-sm font-medium">{engine.engine === "GRAPH" ? "LangGraph" : "Moteur historique"}</p>
              <p className="mt-1 text-sm">Observations : {engine.total} · Terminaisons : {display(engine.completionPercent, "%")}</p>
              <p className="text-sm">Latence p95 : {display(engine.p95Ms, " ms")}, sur {engine.sampledCompleted} réponses.</p>
              <p className="mt-1 text-xs text-muted-foreground">{engine.sampleAdequate ? "Échantillon opérationnel atteint (30 minimum)." : "Données insuffisantes pour comparer."}</p>
            </div>)}
          </div>
          <p className="mt-2 text-xs text-muted-foreground">{rollout.unattributedHistorical} ancienne(s) observation(s) non attribuée(s). La comparaison ne démontre pas la fiabilité factuelle, ni l’équivalence des cohortes. L’activation reste une opération de déploiement administrateur.</p>
        </>}
      </section>
      <section className={cell}><h2 className="font-semibold">Limites de couverture</h2><ul className="mt-3 list-disc space-y-1 pl-4 text-xs text-muted-foreground">{data.limitations.map((value: string, i: number) => <li key={i}>{value}</li>)}</ul></section>
    </>}
    <div className="flex flex-wrap gap-5 text-sm"><Link className="underline" href="/admin/quality">Qualité Career Assistant</Link><Link className="underline" href="/admin">Administration</Link></div>
  </main>;
}
