"use client";
import { useEffect, useState } from "react";
import Link from "next/link";
import { PageHeader } from "@/components/ui/page-header";

type Overview = {
  scope: string; from: string; until: string; total: number; completed: number; failed: number;
  observedSuccessRate: number | null;
  latencyMs: { p50: number | null; p95: number | null; sampledCompleted: number; totalCompleted: number; sampleCap: number };
  errors: { code: string; count: number }[];
  feedback: { helpful: number; notHelpful: number; total: number; positiveShare: number | null; note: string };
  excluded: string[]; note: string;
};
export default function AdminQualityPage() {
  const [data, setData] = useState<Overview | null>(null);
  const [error, setError] = useState("");
  useEffect(() => {
    const controller = new AbortController();
    fetch("/api/admin/quality", { cache: "no-store", signal: controller.signal })
      .then(async response => {
        if (!response.ok) throw new Error("QUALITY_METRICS_UNAVAILABLE");
        return response.json() as Promise<Overview>;
      }).then(setData).catch(() => { if (!controller.signal.aborted) setError("Metrics unavailable or access denied."); });
    return () => controller.abort();
  }, []);
  return <main className="space-y-6">
    <PageHeader title="Career AI quality & observability" description="7-day operational measurements for Career Agent only; not a claim of AI accuracy or employment outcomes." />
    {error && <p role="alert" className="rounded-lg border p-3 text-sm text-destructive">{error}</p>}
    {!data && !error && <p role="status">Loading privacy-minimized metrics…</p>}
    {data && <>
      <p className="text-xs text-muted-foreground">Window: {new Date(data.from).toLocaleString()} – {new Date(data.until).toLocaleString()}</p>
      <section className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4" aria-label="Agent operational health">
        {[
          ["Recorded requests", String(data.total)],
          ["Completed / failed", `${data.completed} / ${data.failed}`],
          ["Observed completion rate", data.observedSuccessRate === null ? "No data" : `${data.observedSuccessRate}%`],
          ["Latency p95 (sample)", data.latencyMs.p95 === null ? "No data" : `${data.latencyMs.p95} ms`],
        ].map(([label, value]) => <div key={label} className="rounded-xl border bg-card p-4"><h2 className="text-xs text-muted-foreground">{label}</h2><p className="mt-3 text-2xl font-semibold tabular-nums">{value}</p></div>)}
      </section>
      <section className="grid gap-4 md:grid-cols-2">
        <div className="rounded-xl border p-5"><h2 className="font-semibold">Latency & coverage</h2>
          <p className="mt-2 text-sm">p50: {data.latencyMs.p50 ?? "n/a"} ms · p95: {data.latencyMs.p95 ?? "n/a"} ms</p>
          <p className="mt-2 text-xs text-muted-foreground">Most recent {data.latencyMs.sampledCompleted} completed requests sampled of {data.latencyMs.totalCompleted}; capped at {data.latencyMs.sampleCap}. Not all AI workflows are covered.</p>
        </div>
        <div className="rounded-xl border p-5"><h2 className="font-semibold">Voluntary answer feedback</h2>
          <p className="mt-2 text-sm">Helpful: {data.feedback.helpful} · Not helpful: {data.feedback.notHelpful}</p>
          <p className="mt-2 text-sm">Positive share: {data.feedback.positiveShare === null ? "Insufficient data" : `${data.feedback.positiveShare}%`}</p>
          <p className="mt-2 text-xs text-muted-foreground">{data.feedback.note}</p>
        </div>
      </section>
      <section className="rounded-xl border p-5"><h2 className="font-semibold">Safe error codes</h2>
        {data.errors.length ? <ul className="mt-3 space-y-2 text-sm">{data.errors.map(item => <li key={item.code} className="flex justify-between gap-4"><code>{item.code}</code><span>{item.count}</span></li>)}</ul> : <p className="mt-2 text-sm text-muted-foreground">No recorded failures in this window.</p>}
      </section>
      <p className="text-xs text-muted-foreground">{data.note} These metrics exclude: {data.excluded.join(", ")}.</p>
    </>}
    <Link href="/admin" className="text-sm underline">Return to administration</Link>
  </main>;
}
