"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import {
  Bookmark, ChevronLeft, ChevronRight, ClipboardList, ExternalLink,
  FileText, Mail, MessagesSquare, Search, X,
} from "lucide-react";
import { PageHeader } from "@/components/ui/page-header";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { JobDescription } from "@/components/jobs/job-description";

type Job = {
  id: string; externalId: string; provider: string; title: string; company: string;
  description: string; logoUrl?: string | null; location: string | null; remote: boolean | null;
  contractType: string | null; salaryMin: number | null; salaryMax: number | null;
  currency: string | null; publishedAt: string | null; sourceUrl: string; applyUrl: string;
  skills: string[]; attribution: string;
  match?: { score: number; matched: string[]; missing: string[]; explanation: string };
};

type Result = {
  jobs: Job[];
  warnings: string[];
  totalAvailable: number;
  page: number;
  pageSize: number;
};

const emptyResult: Result = { jobs: [], warnings: [], totalAvailable: 0, page: 1, pageSize: 30 };

const sourceArtwork: Record<string, string> = {
  GREENHOUSE: "/job-sources/greenhouse.svg",
  LEVER: "/job-sources/lever.svg",
  HIMALAYAS: "/job-sources/himalayas.svg",
  REMOTIVE: "/job-sources/remotive.svg",
  REMOTE_OK: "/job-sources/remote-ok.svg",
  ARBEITNOW: "/job-sources/arbeitnow.svg",
};

const sourceName = (provider: string) => ({
  GREENHOUSE: "Greenhouse", LEVER: "Lever", HIMALAYAS: "Himalayas",
  REMOTIVE: "Remotive", REMOTE_OK: "Remote OK", ARBEITNOW: "Arbeitnow",
}[provider] || provider);

const readableCompany = (company: string) => company.includes(" ") || /[A-Z]/.test(company.slice(1))
  ? company
  : company.split(/[-_]/).filter(Boolean).map((word) => word.charAt(0).toUpperCase() + word.slice(1)).join(" ");

function JobVisual({ job, large = false }: { job: Job; large?: boolean }) {
  const [logoFailed, setLogoFailed] = useState(false);
  const artwork = !logoFailed && job.logoUrl ? job.logoUrl : sourceArtwork[job.provider] || "/job-sources/generic.svg";
  return <div className={`relative overflow-hidden bg-gradient-to-br from-primary/15 via-accent to-muted ${large ? "h-44" : "h-32"}`}>
    {/* External company images are optional; the local source artwork is always available as fallback. */}
    {/* eslint-disable-next-line @next/next/no-img-element */}
    <img src={artwork} alt="" loading="lazy" decoding="async" referrerPolicy="no-referrer"
      onError={() => setLogoFailed(true)}
      className={`absolute object-contain drop-shadow-sm ${job.logoUrl && !logoFailed ? "inset-5 h-20 w-20 rounded-xl bg-white p-2" : "inset-0 h-full w-full"}`} />
    <div className="absolute inset-x-0 bottom-0 flex items-end justify-between bg-gradient-to-t from-black/60 to-transparent p-4 pt-10 text-white">
      <span className="rounded-full border border-white/25 bg-black/20 px-2.5 py-1 text-xs font-medium backdrop-blur-sm">{sourceName(job.provider)}</span>
      <span className="max-w-[65%] truncate text-sm font-semibold">{readableCompany(job.company)}</span>
    </div>
  </div>;
}

export default function FindJobs() {
  const router = useRouter();
  const [location, setLocation] = useState("");
  const [workMode, setWorkMode] = useState("all");
  const [contract, setContract] = useState("all");
  const [q, setQ] = useState("");
  const [term, setTerm] = useState("");
  const [tab, setTab] = useState<"all" | "recommended" | "saved">("all");
  const [page, setPage] = useState(1);
  const [data, setData] = useState<Result>(emptyResult);
  const [saved, setSaved] = useState<Record<string, string>>({});
  const [selected, setSelected] = useState<Job | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  useEffect(() => {
    let cancelled = false;

    const load = async () => {
      setLoading(true);
      setError("");
      try {
        if (tab === "saved") {
          const response = await fetch("/api/find-jobs/saved");
          if (!response.ok) throw new Error();
          const rows = await response.json();
          if (cancelled) return;
          const jobs: Job[] = rows.map((item: {
            id: string; title: string; company: string | null; description: string;
            location: string | null; sourceUrl: string; sourceName: string | null; requiredSkills: unknown;
          }) => ({
            id: item.id, externalId: item.id, provider: item.sourceName || "SAVED",
            title: item.title, company: item.company || "", description: item.description,
            location: item.location, remote: null, contractType: null, salaryMin: null,
            salaryMax: null, currency: null, publishedAt: null, sourceUrl: item.sourceUrl,
            applyUrl: item.sourceUrl, skills: Array.isArray(item.requiredSkills) ? item.requiredSkills : [],
            attribution: `Source : ${item.sourceName || "originale"}`,
          }));
          setData({ jobs, warnings: [], totalAvailable: jobs.length, page: 1, pageSize: jobs.length || 30 });
          return;
        }

        const params = new URLSearchParams({
          q: term,
          recommended: String(tab === "recommended"),
          page: String(page),
        });
        const response = await fetch(`/api/find-jobs?${params.toString()}`);
        if (!response.ok) throw new Error();
        const result: Result = await response.json();
        if (!cancelled) setData(result);
      } catch {
        if (!cancelled) setError("Les offres sont temporairement indisponibles.");
      } finally {
        if (!cancelled) setLoading(false);
      }
    };

    void load();
    return () => { cancelled = true; };
  }, [page, tab, term]);

  const save = async (job: Job) => {
    const response = await fetch("/api/find-jobs/saved", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({
        externalId: job.externalId, provider: job.provider, title: job.title,
        company: job.company, location: job.location, description: job.description,
        sourceUrl: job.sourceUrl, skills: job.skills,
      }),
    });
    if (response.ok) {
      const result = await response.json();
      setSaved((current) => ({ ...current, [job.id]: result.id }));
    }
  };

  const track = async (job: Job) => {
    const response = await fetch("/api/applications", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({
        company: job.company || "Non précisée", jobTitle: job.title,
        location: job.location || undefined, jobUrl: job.sourceUrl,
        source: job.provider, status: "SAVED", reopenExisting: true, notes: `Offre originale : ${job.sourceUrl}`,
      }),
    });
    if (!response.ok) { setError("Impossible de créer cette candidature."); return; }
    const result = await response.json();
    if (result.id) router.push(`/dashboard/applications/${encodeURIComponent(result.id)}?tab=documents`);
  };

  const totalPages = Math.max(1, Math.ceil(data.totalAvailable / data.pageSize));
  const visibleJobs = useMemo(() => data.jobs.filter(job => {
    const inLocation = !location.trim() || `${job.location || ""} ${job.company}`.toLowerCase().includes(location.toLowerCase().trim());
    const remote = workMode === "all" || (workMode === "remote" ? job.remote === true : job.remote === false);
    const contractFit = contract === "all" || (job.contractType || "").toLowerCase().includes(contract);
    return inLocation && remote && contractFit;
  }), [data.jobs, location, workMode, contract]);

  return (
    <div className="space-y-5">
      <PageHeader
        eyebrow="Find Jobs"
        title="Découvrez des offres réelles"
        description="Offres issues de sources publiques. Le score est un indicateur de correspondance, jamais une probabilité d’embauche."
      />

      <section className="flex flex-col gap-2 border-y bg-card px-4 py-3 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <p className="text-3xl font-semibold tabular-nums text-foreground">
            {data.totalAvailable.toLocaleString("fr-FR")}
          </p>
          <p className="text-sm text-muted-foreground">
            {tab === "saved" ? "offres enregistrées" : "offres synchronisées disponibles"}
          </p>
        </div>
        {tab !== "saved" && data.totalAvailable > 0 && (
          <p className="text-sm text-muted-foreground">Page {Math.min(page, totalPages)} sur {totalPages}</p>
        )}
      </section>

      <form className="flex gap-2 border-b pb-5" onSubmit={(event) => {
        event.preventDefault();
        setPage(1);
        setTerm(q.trim());
      }}>
        <Input value={q} onChange={(event) => setQ(event.target.value)}
          placeholder="Métier, compétence ou entreprise" aria-label="Rechercher des offres" />
        <Button type="submit"><Search />Rechercher</Button>
      </form>

      <div className="flex gap-1 border-b" role="tablist">
        {([['all', 'Toutes'], ['recommended', 'Recommandées'], ['saved', 'Enregistrées']] as const).map(([id, label]) => (
          <Button key={id} role="tab" aria-selected={tab === id}
            variant="ghost"
            className={`rounded-none border-b-2 px-3 ${tab === id ? "border-primary text-primary hover:bg-transparent hover:text-primary" : "border-transparent text-muted-foreground"}`}
            onClick={() => { setPage(1); setTab(id); }}>
            {label}
          </Button>
        ))}
      </div>

      {data.warnings.length > 0 && <p className="text-xs text-warning">
        Certaines sources sont indisponibles : {data.warnings.join(" · ")}
      </p>}
      {error && <p role="alert" className="text-sm text-destructive">{error}</p>}

      <div className="grid gap-3 rounded-xl border bg-card p-3 sm:grid-cols-3" aria-label="Filtres des offres">
        <label className="grid gap-1 text-xs">Ville ou pays<Input value={location} onChange={e => setLocation(e.target.value)} placeholder="Toutes les localisations"/></label>
        <label className="grid gap-1 text-xs">Mode de travail<select className="h-10 rounded-md border bg-background px-2 text-sm" value={workMode} onChange={e => setWorkMode(e.target.value)}><option value="all">Tous les modes</option><option value="remote">À distance</option><option value="onsite">Sur site (si précisé)</option></select></label>
        <label className="grid gap-1 text-xs">Contrat<select className="h-10 rounded-md border bg-background px-2 text-sm" value={contract} onChange={e => setContract(e.target.value)}><option value="all">Tous les contrats</option><option value="full">Temps plein</option><option value="part">Temps partiel</option><option value="contract">Contrat / freelance</option><option value="intern">Stage</option></select></label>
      </div>
      {tab === "recommended" && <p className="text-xs text-muted-foreground">Recommandations basées sur votre métier, votre domaine, vos compétences déclarées, la séniorité et les restrictions de lieu lorsque disponibles. Les offres hors domaine sont masquées, mais l’éligibilité doit être vérifiée.</p>}
      {loading ? <p role="status" className="text-sm text-muted-foreground">Chargement des offres…</p> : <div className="divide-y rounded-xl border bg-card" role="list" aria-label="Résultats des offres">
        {visibleJobs.map(job => <article key={job.id} role="listitem" className="flex flex-wrap items-center gap-3 px-4 py-4 transition-colors hover:bg-muted/30 sm:flex-nowrap">
          <div className="flex size-11 shrink-0 items-center justify-center overflow-hidden rounded-lg border bg-background">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src={job.logoUrl || sourceArtwork[job.provider] || "/job-sources/generic.svg"} alt="" className="size-9 object-contain" referrerPolicy="no-referrer" onError={e => { e.currentTarget.src = "/job-sources/generic.svg"; }}/>
          </div>
          <button type="button" className="min-w-[180px] flex-1 text-left" onClick={() => setSelected(job)} aria-label={`Consulter ${job.title} chez ${job.company}`}>
            <h2 className="text-sm font-semibold hover:text-primary">{job.title}</h2><p className="mt-0.5 text-xs text-muted-foreground">{readableCompany(job.company)}{job.location ? ` · ${job.location}` : ""}</p>
            <p className="mt-1 text-[11px] text-muted-foreground">{job.remote ? "Remote · " : ""}{job.contractType ? `${job.contractType} · ` : ""}{sourceName(job.provider)}</p>
            {job.match && <p className="mt-1 line-clamp-1 text-[11px] text-muted-foreground">{job.match.explanation}</p>}
          </button>
          {job.match && <span className="shrink-0 rounded-md bg-primary/10 px-2.5 py-1 text-xs font-semibold text-primary" title="Correspondance indicative, pas un score ATS">{job.match.score}%</span>}
          <div className="ml-auto flex shrink-0 gap-1"><Button size="sm" variant="ghost" onClick={() => setSelected(job)}>Détails</Button><Button size="sm" variant="outline" onClick={() => void save(job)}><Bookmark className="size-3.5"/>{saved[job.id] ? "Enregistrée" : "Sauver"}</Button><Button size="sm" onClick={() => void track(job)}><ClipboardList className="size-3.5"/>Préparer</Button></div>
        </article>)}
      </div>}

      {!loading && !visibleJobs.length && <div className="border bg-card p-4 text-sm text-muted-foreground">
        Aucune offre disponible pour cette recherche. Essayez un métier plus large ou retirez un filtre géographique.
      </div>}

      {!loading && tab !== "saved" && totalPages > 1 && <nav
        className="flex items-center justify-center gap-3" aria-label="Pagination des offres">
        <Button variant="outline" disabled={page <= 1}
          onClick={() => setPage((current) => Math.max(1, current - 1))}>
          <ChevronLeft />Précédente
        </Button>
        <span className="min-w-28 text-center text-sm text-muted-foreground">{page} / {totalPages}</span>
        <Button variant="outline" disabled={page >= totalPages}
          onClick={() => setPage((current) => Math.min(totalPages, current + 1))}>
          Suivante<ChevronRight />
        </Button>
      </nav>}

      {selected && <div className="fixed inset-0 z-50 grid place-items-center bg-black/50 p-4"
        role="dialog" aria-modal="true" aria-label={selected.title}>
        <section className="max-h-[92vh] w-full max-w-4xl overflow-auto rounded-[6px] border bg-card shadow-2xl">
          <JobVisual job={selected} large />
          <div className="p-6 sm:p-8">
          <div className="flex items-start justify-between gap-4">
            <div className="min-w-0">
              <p className="text-xs font-medium uppercase tracking-wider text-muted-foreground">{selected.attribution}</p>
              <h2 className="mt-2 type-h1">{selected.title}</h2>
              <p className="mt-1 text-base text-muted-foreground">{readableCompany(selected.company)}{selected.location ? ` · ${selected.location}` : ""}</p>
            </div>
            <Button size="icon" variant="ghost" onClick={() => setSelected(null)} aria-label="Fermer" className="shrink-0"><X /></Button>
          </div>
          <div className="my-7 h-px bg-border" />
          <JobDescription value={selected.description} />
          <div className="mt-6 flex flex-wrap gap-2">
            <Button asChild><a href={selected.applyUrl} target="_blank" rel="noopener noreferrer">
              Postuler sur le site officiel<ExternalLink />
            </a></Button>
            <Button variant="outline" asChild><Link href={`/dashboard/resumes?target=${encodeURIComponent(selected.title)}`}>
              <FileText />CV ciblé
            </Link></Button>
            <Button variant="outline" asChild><Link href={`/dashboard/cover-letters?target=${encodeURIComponent(selected.title)}`}>
              <Mail />Lettre
            </Link></Button>
            <Button variant="outline" asChild><Link href={`/dashboard/interviews?role=${encodeURIComponent(selected.title)}`}>
              <MessagesSquare />Entretien
            </Link></Button>
          </div>
          </div>
        </section>
      </div>}
    </div>
  );
}
