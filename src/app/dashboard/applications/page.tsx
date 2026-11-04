"use client";

import { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import { useTranslation } from "react-i18next";
import { ArrowRight, BriefcaseBusiness, Plus, Search } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { applicationStatusLabel, applicationStatusTone } from "@/lib/career/application-workspace";
import { applicationCopy, applicationLocale } from "@/lib/career/application-copy";
import { ApplicationIntake } from "@/components/career/application-intake";

type Application = {
  id: string; company: string; jobTitle: string; status: string;
  location?: string | null; updatedAt: string;
  reminders: { id: string; dueAt: string }[];
};
type Result = { items: Application[]; total: number; page: number; pageSize: number };

export default function Applications() {
  const { i18n } = useTranslation();
  const language = i18n.resolvedLanguage?.startsWith("fr") ? "fr" : "en";
  const c = applicationCopy[language];
  const filters = [
    { label: c.all, value: "" }, { label: c.saved, value: "SAVED" },
    { label: c.applied, value: "APPLIED" }, { label: c.interviewFilter, value: "INTERVIEW" },
    { label: c.offers, value: "OFFER" },
  ];
  const [data, setData] = useState<Result | null>(null);
  const [search, setSearch] = useState("");
  const [filter, setFilter] = useState("");
  const [page, setPage] = useState(1);
  const [creating, setCreating] = useState(false);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(false);

  const load = useCallback(async (signal?: AbortSignal) => {
    const params = new URLSearchParams({ archived: "false", page: String(page), pageSize: "20" });
    if (search.trim()) params.set("q", search.trim());
    if (filter) params.set("status", filter);
    const response = await fetch(`/api/applications?${params}`, { signal, cache: "no-store" });
    if (!response.ok) throw new Error("LOAD_APPLICATIONS_FAILED");
    return response.json() as Promise<Result>;
  }, [search, filter, page]);

  useEffect(() => {
    const controller = new AbortController();
    const timeout = setTimeout(() => {
      setLoading(true);
      void load(controller.signal)
        .then(result => { setData(result); setError(false); })
        .catch(() => { if (!controller.signal.aborted) setError(true); })
        .finally(() => { if (!controller.signal.aborted) setLoading(false); });
    }, search.trim() ? 220 : 0);
    return () => { clearTimeout(timeout); controller.abort(); };
  }, [load, search]);

  return <main className="mx-auto max-w-6xl space-y-5 pb-12">
    <header className="flex min-h-10 flex-wrap items-center justify-between gap-3 border-b pb-5">
      <div><p className="text-xs font-medium text-muted-foreground">{c.careerSpace}</p><h1 className="mt-1 text-2xl font-semibold tracking-tight sm:text-3xl">{c.applications}</h1></div>
      <Button size="sm" onClick={() => setCreating(value => !value)} aria-expanded={creating} aria-controls="application-create"><Plus className="size-4" /> {c.newApplication}</Button>
    </header>

    {creating && <ApplicationIntake onClose={() => setCreating(false)} />}

    <div className="ux-surface overflow-hidden">
      <div className="flex flex-col gap-3 border-b p-3 sm:flex-row sm:items-center sm:justify-between sm:p-4">
        <div className="relative min-w-0 flex-1 sm:max-w-sm"><Search aria-hidden="true" className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground"/><Input className="h-9 pl-9" aria-label={c.searchApplications} placeholder={c.searchPlaceholder} value={search} onChange={e => { setSearch(e.target.value); setPage(1); }}/></div>
        <span className="text-xs text-muted-foreground" aria-live="polite">{loading ? c.loading : data ? c.applicationsCount(data.total) : "—"}</span>
      </div>
      <div role="group" aria-label={c.filterApplications} className="flex gap-1 overflow-x-auto border-b px-3 py-2 sm:px-4">
        {filters.map(item => <button type="button" key={item.value} onClick={() => { setFilter(item.value); setPage(1); }} aria-pressed={filter === item.value} className={`ux-filter shrink-0 border-b-2 border-transparent px-3 py-1.5 text-xs font-medium transition-colors ${filter === item.value ? "border-primary text-primary" : "text-muted-foreground hover:text-foreground"}`}>{item.label}</button>)}
      </div>
      {error && <p role="alert" className="p-4 text-sm text-destructive">{c.loadApplicationsFailed} <button className="underline" onClick={() => void load().then(result => { setData(result); setError(false); }).catch(() => setError(true))}>{c.retry}</button></p>}
      {loading ? <div className="space-y-2 p-4" aria-label={c.loadingApplications}>{[1,2,3].map(i => <div key={i} className="h-16 animate-pulse rounded-[6px] bg-muted/60" />)}</div>
        : !data?.items.length ? <div className="flex flex-col items-center gap-3 p-12 text-center"><BriefcaseBusiness className="size-8 text-muted-foreground"/><p className="text-sm font-medium">{c.emptyApplications}</p><p className="text-xs text-muted-foreground">{c.emptyApplicationsHint}</p><Button variant="outline" size="sm" onClick={() => setCreating(true)}><Plus className="size-4"/> {c.add}</Button></div>
        : <div className="divide-y" aria-label={c.applicationsList}>{data.items.map(app => <Link key={app.id} href={`/dashboard/applications/${encodeURIComponent(app.id)}`} className="ux-application-row group flex items-center gap-3 px-4 py-3.5 transition-colors hover:bg-muted/40 focus-visible:outline-2 focus-visible:outline-offset-[-2px] focus-visible:outline-ring sm:gap-4 sm:px-5">
          <div className="flex size-9 shrink-0 items-center justify-center rounded-md bg-secondary text-sm font-bold text-primary" aria-hidden="true">{app.company.slice(0, 1).toUpperCase()}</div>
          <div className="min-w-0 flex-1"><p className="truncate text-sm font-semibold">{app.jobTitle}</p><p className="mt-0.5 truncate text-xs text-muted-foreground">{app.company}{app.location ? ` · ${app.location}` : ""}</p></div>
          <span className={`hidden rounded-md px-2.5 py-1 text-[11px] font-medium sm:inline-flex ${applicationStatusTone(app.status)}`}>{applicationStatusLabel(app.status, language)}</span>
          <span className="hidden w-24 text-right text-xs text-muted-foreground md:block">{new Date(app.updatedAt).toLocaleDateString(applicationLocale(language))}</span>
          <ArrowRight className="size-4 shrink-0 text-muted-foreground transition-transform group-hover:translate-x-1 group-hover:text-primary" aria-hidden="true"/>
        </Link>)}</div>}
      {data && data.total > data.pageSize && <div className="flex items-center justify-between border-t p-3"><Button size="sm" variant="ghost" disabled={page === 1} onClick={() => setPage(v => v - 1)}>{c.previous}</Button><span className="text-xs text-muted-foreground">{c.page(page)}</span><Button size="sm" variant="ghost" disabled={page * data.pageSize >= data.total} onClick={() => setPage(v => v + 1)}>{c.next}</Button></div>}
    </div>
  </main>;
}
