"use client";
import { useEffect, useState } from "react";
import Link from "next/link";
import { PageHeader } from "@/components/ui/page-header";

type BillingHealth = {
  monthStart: string;
  subscriptions: { plan: string; status: string; count: number }[];
  aiUsage: { trackedCalls: number; ratedCalls: number; estimatedUSD: string | null; coverage: string };
  note: string;
};
export default function AdminBilling() {
  const [data, setData] = useState<BillingHealth | null>(null);
  const [error, setError] = useState("");
  useEffect(() => {
    const abort = new AbortController();
    fetch("/api/admin/billing/summary", { cache: "no-store", signal: abort.signal })
      .then(async r => { if (!r.ok) throw new Error("ACCESS_DENIED"); return r.json() as Promise<BillingHealth>; })
      .then(setData)
      .catch(() => { if (!abort.signal.aborted) setError("Billing summary unavailable or access denied."); });
    return () => abort.abort();
  }, []);
  return <main className="space-y-6">
    <PageHeader title="Billing health" description="Subscription state and tracked AI workload; Stripe remains the source of truth for actual money." />
    {error && <p role="alert" className="text-sm text-destructive">{error}</p>}
    {!data && !error && <p role="status" className="text-sm text-muted-foreground">Loading billing metrics…</p>}
    {data && <>
      <section className="rounded-xl border p-5"><h2 className="font-semibold">Subscription distribution</h2><div className="mt-4 grid gap-3 sm:grid-cols-2 lg:grid-cols-3">{data.subscriptions.map(row => <div key={`${row.plan}:${row.status}`} className="rounded-lg bg-muted/50 p-4"><p className="text-xs text-muted-foreground">{row.plan.replace("_", " ")} / {row.status.toLowerCase()}</p><p className="mt-2 text-2xl font-semibold tabular-nums">{row.count}</p></div>)}</div>{!data.subscriptions.length && <p className="mt-3 text-sm text-muted-foreground">No subscription records.</p>}</section>
      <section className="rounded-xl border p-5"><h2 className="font-semibold">Recorded AI usage this month</h2><p className="mt-2 text-sm">{data.aiUsage.trackedCalls} calls recorded · {data.aiUsage.ratedCalls} calls with configured cost rates</p><p className="mt-2 text-sm">{data.aiUsage.estimatedUSD === null ? "Estimated USD cost: unavailable or incomplete" : `Estimated cost for recorded calls: $${data.aiUsage.estimatedUSD} USD`}</p><p className="mt-3 text-xs text-muted-foreground">{data.note}</p></section>
    </>}
    <Link href="/admin" className="text-sm underline">Return to admin</Link>
  </main>;
}
