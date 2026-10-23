"use client";

import { useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { Heart, Loader2, Search, Sparkles, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { catalogCounts, countryProfiles, resumeFunctionalTypes, templateCatalog, type DocumentKind, type TemplateDefinition } from "@/lib/template-catalog";
import { TemplatePreview } from "./template-preview";

const label = (value: string) => value.replaceAll("_", " ").replace(/\b\w/g, c => c.toUpperCase());

export function TemplateGallery() {
  const router = useRouter();
  const [kind, setKind] = useState<DocumentKind>("CV"), [query, setQuery] = useState(""), [country, setCountry] = useState("ALL"), [functional, setFunctional] = useState("ALL"), [ats, setAts] = useState(false), [selected, setSelected] = useState<TemplateDefinition | null>(null), [creating, setCreating] = useState(false);
  const [favorites, setFavorites] = useState<string[]>(() => typeof window === "undefined" ? [] : JSON.parse(localStorage.getItem("cvcomet-template-favorites") || "[]"));
  const [visibleCount, setVisibleCount] = useState(24);
  useEffect(() => { setVisibleCount(24); }, [kind, query, country, functional, ats]);
  const results = useMemo(() => templateCatalog.filter(template => template.type === kind && (!query.trim() || [template.name, template.family, template.style, ...template.keywords].join(" ").toLowerCase().includes(query.toLowerCase())) && (country === "ALL" || template.countries.includes(country)) && (functional === "ALL" || template.functionalType === functional) && (!ats || template.atsFriendly)), [kind, query, country, functional, ats]);
  const favorite = (id: string) => { const next = favorites.includes(id) ? favorites.filter(value => value !== id) : [...favorites, id]; setFavorites(next); localStorage.setItem("cvcomet-template-favorites", JSON.stringify(next)); };
  const use = async () => {
    if (!selected || creating) return;
    if (selected.type === "COVER_LETTER") { router.push(`/dashboard/cover-letters?template=${encodeURIComponent(selected.id)}`); return; }
    setCreating(true);
    try { const response = await fetch("/api/cvs", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ source: "PROFILE", templateId: selected.id }) }); if (!response.ok) throw new Error(); const resume = await response.json(); router.push(`/dashboard/resumes/${resume.id}`); } finally { setCreating(false); }
  };
  return <div className="space-y-6">
    <section className="rounded-2xl border bg-card p-5 shadow-sm sm:p-7"><div className="flex flex-col justify-between gap-5 lg:flex-row lg:items-end"><div><p className="text-xs font-semibold uppercase tracking-[.18em] text-primary">CVComet studio</p><h1 className="mt-2 text-3xl font-semibold tracking-tight">Templates made for the market you target.</h1><p className="mt-2 max-w-2xl text-sm leading-6 text-muted-foreground">Choose a real, editable document layout. Your profile stays separate from the design, so you can change direction at any time.</p></div><div className="flex rounded-xl bg-muted p-1"><button className={`rounded-lg px-4 py-2 text-sm font-medium ${kind === "CV" ? "bg-card shadow-sm" : "text-muted-foreground"}`} onClick={() => { setKind("CV"); setFunctional("ALL"); }}>CV templates <span className="ml-1 text-xs">{catalogCounts.cvs}</span></button><button className={`rounded-lg px-4 py-2 text-sm font-medium ${kind === "COVER_LETTER" ? "bg-card shadow-sm" : "text-muted-foreground"}`} onClick={() => { setKind("COVER_LETTER"); setFunctional("ALL"); }}>Cover letters <span className="ml-1 text-xs">{catalogCounts.coverLetters}</span></button></div></div></section>
    <section className="rounded-xl border bg-card p-4"><div className="grid gap-3 md:grid-cols-2 xl:grid-cols-5"><label className="relative xl:col-span-2"><Search className="absolute left-3 top-3 size-4 text-muted-foreground" /><Input value={query} onChange={event => setQuery(event.target.value)} className="pl-9" placeholder="Search styles, roles or keywords" /></label><select value={country} onChange={event => setCountry(event.target.value)} className="h-10 rounded-md border bg-background px-3 text-sm"><option value="ALL">All destination countries</option>{countryProfiles.map(value => <option key={value} value={value}>{label(value)}</option>)}</select>{kind === "CV" && <select value={functional} onChange={event => setFunctional(event.target.value)} className="h-10 rounded-md border bg-background px-3 text-sm"><option value="ALL">All CV types</option>{resumeFunctionalTypes.map(item => <option key={item.id} value={item.id}>{item.label}</option>)}</select>}<button type="button" onClick={() => setAts(value => !value)} className={`h-10 rounded-md border px-3 text-sm ${ats ? "border-primary bg-primary/10 text-primary" : "bg-background"}`}>ATS-friendly</button></div><div className="mt-3 flex items-center justify-between text-xs text-muted-foreground"><span aria-live="polite">{results.length} layouts available</span><button className="inline-flex items-center gap-1 hover:text-foreground" onClick={() => { setQuery(""); setCountry("ALL"); setFunctional("ALL"); setAts(false); }}><X className="size-3" />Reset filters</button></div></section>
    <div className="grid grid-cols-1 gap-3 min-[420px]:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5 2xl:grid-cols-6">{results.slice(0, visibleCount).map(template => <article key={template.id} className="group min-w-0 overflow-hidden rounded-lg border bg-card transition hover:-translate-y-0.5 hover:shadow-lg"><button onClick={() => setSelected(template)} className="block w-full text-left"><div className="bg-muted p-3"><TemplatePreview template={template} /></div><div className="px-3 pb-2 pt-3"><div className="flex flex-wrap gap-1"><Badge variant="outline" className="text-[10px]">{template.style}</Badge>{template.atsFriendly && <Badge variant="success" className="text-[10px]">ATS</Badge>}</div><h2 className="mt-2 truncate text-sm font-semibold">{template.name}</h2><p className="mt-1 truncate text-[11px] text-muted-foreground">{template.functionalType === "COVER_LETTER" ? "Cover letter" : label(template.functionalType)} · {template.paper}</p></div></button><div className="flex items-center justify-between gap-1 border-t px-3 py-2"><span className="min-w-0 truncate text-[11px] text-muted-foreground">{template.family}</span><button onClick={() => favorite(template.id)} className={`shrink-0 rounded-md p-1 ${favorites.includes(template.id) ? "text-rose-500" : "text-muted-foreground"}`} aria-label="Toggle favorite"><Heart className="size-4" fill={favorites.includes(template.id) ? "currentColor" : "none"} /></button></div></article>)}</div>
    {results.length > visibleCount && <div className="text-center"><Button variant="outline" onClick={() => setVisibleCount(count => count + 24)}>Show more templates ({results.length - visibleCount})</Button></div>}
    {!results.length && <div className="rounded-xl border border-dashed p-12 text-center text-sm text-muted-foreground">No layouts match these filters. Reset filters to explore the complete library.</div>}
    <Dialog open={Boolean(selected)} onOpenChange={open => !open && setSelected(null)}>
      <DialogContent className="w-[calc(100%-1rem)] max-w-[1280px] gap-0 p-0 sm:max-w-[1280px]">
        <DialogHeader className="border-b px-5 py-5 pr-12">
          <DialogTitle>{selected?.name}</DialogTitle>
          <DialogDescription>{selected?.family} · {selected?.style} · {selected?.paper} · Full document preview</DialogDescription>
        </DialogHeader>
        {selected && <div className="grid min-w-0 lg:grid-cols-[minmax(0,1fr)_260px]">
          <div className="min-w-0 bg-muted p-3 sm:p-6"><TemplatePreview key={selected.id} template={selected} large /></div>
          <aside className="space-y-5 border-t p-5 lg:border-l lg:border-t-0">
            <div className="flex flex-wrap gap-2">
              {selected.atsFriendly && <Badge variant="success">Readable ATS structure</Badge>}
              <Badge variant="outline">{selected.photo ? "Photo optional" : "No photo"}</Badge>
              <Badge variant="outline">{selected.languages.join(" / ").toUpperCase()}</Badge>
            </div>
            <p className="text-sm leading-6 text-muted-foreground">Explore the complete example, then create your own document with your profile. John Doe and the sample content are fictional.</p>
            <Button className="w-full" onClick={() => void use()} disabled={creating}>{creating ? <Loader2 className="animate-spin" /> : <Sparkles />}{selected.type === "CV" ? "Use this template" : "Create cover letter"}</Button>
          </aside>
        </div>}
      </DialogContent>
    </Dialog>
  </div>;
}
