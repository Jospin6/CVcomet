"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { CreditCard, ArrowUpRight } from "lucide-react";
import { Button } from "@/components/ui/button";

type Overview = {
  plan: "FREE" | "PRO" | "CAREER_PRO";
  subscription: { status: string; currentPeriodEnd: string | null; cancelAtPeriodEnd: boolean };
  quota: {
    daily: { used: number; limit: number; resetsAt: string };
    hourly: { used: number; limit: number; resetsAt: string };
    monthlyCredits: { used: number; limit: number; resetsAt: string };
  };
  aiUsage: { trackedCalls: number; ratedCalls: number; estimatedUSD: string | null; coverage: string };
};

export function BillingPanel() {
  const [data, setData] = useState<Overview | null>(null);
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);
  useEffect(() => {
    const abort = new AbortController();
    fetch("/api/billing/overview", { signal: abort.signal, cache: "no-store" })
      .then(async r => { if (!r.ok) throw new Error("UNAVAILABLE"); return r.json() as Promise<Overview>; })
      .then(setData)
      .catch(() => { if (!abort.signal.aborted) setError("Billing information is temporarily unavailable."); });
    return () => abort.abort();
  }, []);
  const portal = async () => {
    setBusy(true); setError("");
    try {
      const res = await fetch("/api/billing/portal", { method: "POST" });
      const payload: { url?: string } = await res.json();
      if (!res.ok || !payload.url || !payload.url.startsWith("https://")) throw new Error("UNAVAILABLE");
      location.assign(payload.url);
    } catch { setError("Unable to open Stripe billing portal. Please try again."); setBusy(false); }
  };
  return <div className="space-y-4">
    {error && <p role="alert" className="text-sm text-destructive">{error}</p>}
    {!data && !error && <p role="status" className="text-sm text-muted-foreground">Loading your billing details…</p>}
    {data && <>
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div><p className="text-sm font-semibold">{data.plan.replace("_", " ")}</p><p className="text-xs text-muted-foreground">Subscription: {data.subscription.status.toLowerCase().replace("_", " ")}</p></div>
        {data.subscription.cancelAtPeriodEnd && <span className="text-xs text-muted-foreground">Scheduled to end at the close of the paid period</span>}
      </div>
      <div className="grid gap-3 sm:grid-cols-3">
        {([ ["Daily AI operations",data.quota.daily], ["Hourly AI operations",data.quota.hourly], ["Monthly workload credits",data.quota.monthlyCredits] ] as const).map(([label,stats])=><div key={label} className="rounded-lg border p-3"><p className="text-xs text-muted-foreground">{label}</p><p className="mt-1 font-semibold tabular-nums">{stats.used.toLocaleString()} / {stats.limit.toLocaleString()}</p><div role="progressbar" aria-label={label} aria-valuenow={stats.used} aria-valuemin={0} aria-valuemax={stats.limit} className="mt-2 h-2 overflow-hidden rounded-full bg-muted"><div className="h-full bg-primary" style={{width:`${Math.min(100, Math.round(stats.used/stats.limit*100))}%`}}/></div></div>)}
      </div>
      <p className="text-xs text-muted-foreground">Internal workload credits are not money and are not billed individually. {data.aiUsage.trackedCalls} recorded AI calls this month. {data.aiUsage.estimatedUSD !== null ? `Estimated recorded model usage: $${data.aiUsage.estimatedUSD} USD (not your Stripe invoice).` : "USD cost is unavailable or incomplete; no amount is inferred."}</p>
    </>}
    <div className="flex flex-wrap gap-3"><Button variant="outline" onClick={portal} disabled={busy}><CreditCard/>{busy ? "Opening…" : "Manage billing"}</Button><Button variant="outline" asChild><Link href="/upgrade">Compare plans<ArrowUpRight/></Link></Button></div>
  </div>;
}
