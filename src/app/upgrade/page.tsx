"use client";
import { useEffect, useState } from "react";
import Link from "next/link";
import { Check, Sparkles } from "lucide-react";
import { PageHeader } from "@/components/ui/page-header";
import { Button } from "@/components/ui/button";

type Plan = {
  key: "FREE" | "PRO" | "CAREER_PRO";
  label: string;
  included: string[];
  aiQuota: { daily: number; hourly: number; monthlyCredits: number };
  available: boolean;
  price: { currency: string; amountMinor: number; interval: string | null; intervalCount: number } | null;
};
function money(p: NonNullable<Plan["price"]>) {
  try {
    const fmt = new Intl.NumberFormat("en", { currency: p.currency, style: "currency" });
    return fmt.format(p.amountMinor / 10 ** fmt.resolvedOptions().maximumFractionDigits);
  } catch { return null; }
}
export default function Upgrade() {
  const [plans, setPlans] = useState<Plan[]>([]);
  const [busy, setBusy] = useState("");
  const [error, setError] = useState("");
  useEffect(() => {
    const ctrl = new AbortController();
    fetch("/api/billing/plans", { signal: ctrl.signal, cache: "no-store" })
      .then(async r => { if (!r.ok) throw new Error("UNAVAILABLE"); return r.json() as Promise<{ plans: Plan[] }>; })
      .then(d => setPlans(d.plans))
      .catch(() => { if (!ctrl.signal.aborted) setError("Plan prices are unavailable. Please try again."); });
    return () => ctrl.abort();
  }, []);
  const checkout = async (plan: "PRO" | "CAREER_PRO") => {
    setBusy(plan); setError("");
    try {
      const r = await fetch("/api/stripe/checkout", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ plan }) });
      const d: { url?: string; error?: string } = await r.json();
      if (!r.ok || !d.url || !d.url.startsWith("https://")) throw new Error(d.error || "CHECKOUT_UNAVAILABLE");
      location.assign(d.url);
    } catch { setError("Checkout could not be opened. Check your active subscription or try again later."); setBusy(""); }
  };
  return <div className="space-y-7">
    <PageHeader title="Plans that grow with your job search" description="See actual recurring prices from Stripe and compare the AI allowances before you subscribe." />
    {error && <p role="alert" className="rounded-lg border border-destructive/30 p-3 text-sm text-destructive">{error}</p>}
    {!plans.length && !error && <p role="status" className="text-sm text-muted-foreground">Loading current plans…</p>}
    <div className="grid gap-5 lg:grid-cols-3">{plans.map(p => <article key={p.key} className={`rounded-2xl border bg-card p-6 ${p.key === "PRO" ? "ring-2 ring-primary/30" : ""}`}>
      <div className="flex items-center justify-between"><h2 className="text-xl font-semibold">{p.label}</h2>{p.key === "PRO" && <span className="rounded-full bg-primary/10 px-2 py-1 text-xs text-primary">Popular</span>}</div>
      <p className="mt-3 text-lg font-semibold">{p.key === "FREE" ? "Free" : p.price && p.available ? `${money(p.price)} / ${p.price.intervalCount === 1 ? "" : `${p.price.intervalCount} `}${p.price.interval}${p.price.intervalCount > 1 ? "s" : ""}` : "Currently unavailable"}</p>
      <div className="mt-6 space-y-3">{p.included.map(f => <p className="flex gap-2 text-sm" key={f}><Check aria-hidden="true" className="size-4 shrink-0 text-primary"/>{f}</p>)}</div>
      <div className="mt-5 rounded-lg bg-muted/50 p-3 text-xs text-muted-foreground"><p>{p.aiQuota.daily} AI operations per day</p><p>{p.aiQuota.hourly} per hour</p><p>{p.aiQuota.monthlyCredits.toLocaleString()} internal workload credits per month</p></div>
      <div className="mt-8">{p.key === "FREE" ? <Button variant="outline" className="w-full" asChild><Link href="/signup">Start free</Link></Button> : <Button className="w-full" onClick={() => checkout(p.key as "PRO" | "CAREER_PRO")} disabled={!!busy || !p.available}><Sparkles/>{busy === p.key ? "Opening Stripe…" : `Choose ${p.label}`}</Button>}</div>
    </article>)}</div>
    <p className="text-center text-xs text-muted-foreground">Prices are loaded from configured active Stripe Price IDs. Taxes, discounts and the final amount are confirmed at Stripe Checkout. AI workload credits are not USD. <Link className="underline" href="/settings">Manage an existing subscription</Link>.</p>
  </div>;
}
