"use client";

import { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import { ArrowRight, BriefcaseBusiness, Plus, Search } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { applicationStatusLabel, applicationStatusTone } from "@/lib/career/application-workspace";
import { ApplicationIntake } from "@/components/career/application-intake";

type Application = { id: string; company: string; jobTitle: string; status: string; location?: string | null; updatedAt: string; reminders: { id: string; dueAt: string }[] };
type Result = { items: Application[]; total: number; page: number; pageSize: number };
const filters = [{ label: "Toutes", value: "" }, { label: "Enregistrées", value: "SAVED" }, { label: "Envoyées", value: "APPLIED" }, { label: "Entretiens", value: "INTERVIEW" }, { label: "Offres", value: "OFFER" }];

export default function Applications() {
  const [data, setData] = useState<Result | null>(null);
  const [search, setSearch] = useState("");
  const [filter, setFilter] = useState("");
  const [page, setPage] = useState(1);
  const [creating, setCreating] = useState(false);
  const [form, setForm] = useState({ company: "", jobTitle: "" });
  const [busy, setBusy] = useState(false);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  const load = useCallback(async (signal?: AbortSignal) => {
    const params = new URLSearchParams({ archived: "false", page: String(page), pageSize: "20" });
    if (search.trim()) params.set("q", search.trim());
    if (filter) params.set("status", filter);
    const response = await fetch(`/api/applications?${params}`, { signal, cache: "no-store" });
    if (!response.ok) throw new Error("Impossible de charger vos candidatures.");
    return response.json() as Promise<Result>;
  }, [search, filter, page]);

  useEffect(() => {
    const controller = new AbortController();
    const timeout = setTimeout(() => {
      setLoading(true);
      void load(controller.signal).then(result => { setData(result); setError(""); }).catch(() => {
        if (!controller.signal.aborted) setError("Impossible de charger vos candidatures.");
      }).finally(() => { if (!controller.signal.aborted) setLoading(false); });
    }, search.trim() ? 220 : 0);
    return () => { clearTimeout(timeout); controller.abort(); };
  }, [load, search]);

  const create = async (event: React.FormEvent) => {
    event.preventDefault(); setBusy(true); setError("");
    try {
      const response = await fetch("/api/applications", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify(form) });
      const result = await response.json();
      if (!response.ok) throw new Error(result?.error === "DUPLICATE_APPLICATION" ? "Une candidature similaire existe déjà." : "Création impossible.");
      window.location.assign(`/dashboard/applications/${encodeURIComponent(result.id)}`);
    } catch (failure) { setError(failure instanceof Error ? failure.message : "Création impossible."); setBusy(false); }
  };

  return <main className="mx-auto max-w-6xl space-y-5 pb-12">
    <header className="flex min-h-10 flex-wrap items-center justify-between gap-3 border-b pb-5">
      <div><p className="text-xs font-medium text-muted-foreground">Mon espace de carrière</p><h1 className="mt-1 text-2xl font-semibold tracking-tight sm:text-3xl">Mes candidatures</h1></div>
      <Button size="sm" onClick={() => setCreating(value => !value)} aria-expanded={creating} aria-controls="application-create"><Plus className="size-4" /> Nouvelle candidature</Button>
    </header>

    {creating && <><ApplicationIntake onClose={() => setCreating(false)} />{false && <section id="application-create" className="ux-surface ux-enter p-4 sm:p-5" aria-label="Nouvelle candidature">
      <div className="mb-3 flex items-center justify-between"><h2 className="text-sm font-semibold">Ajouter un poste</h2><Button size="icon" variant="ghost" onClick={() => setCreating(false)} aria-label="Fermer"><X className="size-4"/></Button></div>
      <form className="grid gap-3 sm:grid-cols-[1fr_1fr_auto]" onSubmit={create}>
        <Input aria-label="Entreprise" required maxLength={300} placeholder="Entreprise (ex. Google)" value={form.company} onChange={e => setForm(value => ({ ...value, company: e.target.value }))} />
        <Input aria-label="Intitulé du poste" required maxLength={300} placeholder="Poste (ex. Software Engineer)" value={form.jobTitle} onChange={e => setForm(value => ({ ...value, jobTitle: e.target.value }))} />
        <Button size="sm" disabled={busy || !form.company.trim() || !form.jobTitle.trim()}><Plus className="size-4"/> Créer</Button>
      </form>
    </section>}</>}

    <div className="ux-surface overflow-hidden">
      <div className="flex flex-col gap-3 border-b p-3 sm:flex-row sm:items-center sm:justify-between sm:p-4">
        <div className="relative min-w-0 flex-1 sm:max-w-sm"><Search aria-hidden="true" className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground"/><Input className="h-9 pl-9" aria-label="Rechercher des candidatures" placeholder="Rechercher un poste ou une entreprise" value={search} onChange={e => { setSearch(e.target.value); setPage(1); }}/></div>
        <span className="text-xs text-muted-foreground" aria-live="polite">{loading ? "Chargement…" : data ? `${data.total} candidature${data.total > 1 ? "s" : ""}` : "—"}</span>
      </div>
      <div role="group" aria-label="Filtrer les candidatures" className="flex gap-1 overflow-x-auto border-b px-3 py-2 sm:px-4">
        {filters.map(item => <button type="button" key={item.value} onClick={() => { setFilter(item.value); setPage(1); }} aria-pressed={filter === item.value} className={`ux-filter shrink-0 border-b-2 border-transparent px-3 py-1.5 text-xs font-medium transition-colors ${filter === item.value ? "border-primary text-primary" : "text-muted-foreground hover:text-foreground"}`}>{item.label}</button>)}
      </div>
      {error && <p role="alert" className="p-4 text-sm text-destructive">{error} <button className="underline" onClick={() => void load().then(setData).catch(() => {})}>Réessayer</button></p>}
      {loading ? <div className="space-y-2 p-4" aria-label="Chargement des candidatures">{[1,2,3].map(i => <div key={i} className="h-16 animate-pulse rounded-[6px] bg-muted/60" />)}</div>
        : !data?.items.length ? <div className="flex flex-col items-center gap-3 p-12 text-center"><BriefcaseBusiness className="size-8 text-muted-foreground"/><p className="text-sm font-medium">Aucune candidature ici</p><p className="text-xs text-muted-foreground">Ajoutez votre première candidature pour commencer.</p><Button variant="outline" size="sm" onClick={() => setCreating(true)}><Plus className="size-4"/> Ajouter</Button></div>
        : <div className="divide-y" aria-label="Liste des candidatures">{data.items.map(app => <Link key={app.id} href={`/dashboard/applications/${app.id}`} className="ux-application-row group flex items-center gap-3 px-4 py-3.5 transition-colors hover:bg-muted/40 focus-visible:outline-2 focus-visible:outline-offset-[-2px] focus-visible:outline-ring sm:gap-4 sm:px-5">
          <div className="flex size-9 shrink-0 items-center justify-center rounded-md bg-secondary text-sm font-bold text-primary" aria-hidden="true">{app.company.slice(0, 1).toUpperCase()}</div>
          <div className="min-w-0 flex-1"><p className="truncate text-sm font-semibold">{app.jobTitle}</p><p className="mt-0.5 truncate text-xs text-muted-foreground">{app.company}{app.location ? ` · ${app.location}` : ""}</p></div>
          <span className={`hidden rounded-md px-2.5 py-1 text-[11px] font-medium sm:inline-flex ${applicationStatusTone(app.status)}`}>{applicationStatusLabel(app.status)}</span>
          <span className="hidden w-24 text-right text-xs text-muted-foreground md:block">{new Date(app.updatedAt).toLocaleDateString("fr-FR")}</span>
          <ArrowRight className="size-4 shrink-0 text-muted-foreground transition-transform group-hover:translate-x-1 group-hover:text-primary" aria-hidden="true"/>
        </Link>)}</div>}
      {data && data.total > data.pageSize && <div className="flex items-center justify-between border-t p-3"><Button size="sm" variant="ghost" disabled={page === 1} onClick={() => setPage(v => v - 1)}>Précédent</Button><span className="text-xs text-muted-foreground">Page {page}</span><Button size="sm" variant="ghost" disabled={page * data.pageSize >= data.total} onClick={() => setPage(v => v + 1)}>Suivant</Button></div>}
    </div>
  </main>;
}
