"use client";

import { useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { FileText, Mail, Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { PageHeader } from "@/components/ui/page-header";
import { catalogById, templateCatalog } from "@/lib/template-catalog";

type Choice = { id: string; title?: string; company?: string | null };
type Options = { jobs: Choice[]; resumes: Choice[] };
export function CoverLettersPage() {
  const router = useRouter();
  const [applicationId, setApplicationId] = useState("");
  const [templateId, setTemplateId] = useState(templateCatalog.find(t => t.type === "COVER_LETTER")?.id || "");
  const [cvId, setCvId] = useState("");
  const [jobId, setJobId] = useState("");
  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const requested = params.get("template") || "";
    if (catalogById.get(requested)?.type === "COVER_LETTER") setTemplateId(requested);
    setApplicationId(params.get("applicationId") || "");
    setCvId(params.get("cvId") || "");
    setJobId(params.get("jobId") || "");
  }, []);
  const [choices, setChoices] = useState<Options>({ jobs: [], resumes: [] });
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  useEffect(() => {
    const controller = new AbortController();
    void fetch("/api/career/v1/application-packets/options", { signal: controller.signal, cache: "no-store" }).then(async r => { if (!r.ok) throw new Error("LOAD_FAILED"); return r.json(); }).then(data => {
      setChoices({ jobs: data.data?.jobs || [], resumes: data.data?.resumes || [] });
    }).catch(() => { if (!controller.signal.aborted) setError("Impossible de charger vos documents et vos offres."); }).finally(() => { if (!controller.signal.aborted) setLoading(false); });
    return () => controller.abort();
  }, []);
  const validCv = useMemo(() => choices.resumes.some(item => item.id === cvId), [choices, cvId]);
  const validJob = !jobId || choices.jobs.some(item => item.id === jobId);
  const create = async () => {
    if (!validCv || !validJob || busy) return;
    setBusy(true); setError("");
    try {
      const response = await fetch("/api/cover-letters/from-template", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ templateId, cvId, ...(jobId ? { jobId } : {}), ...(applicationId ? { applicationId } : {}) }) });
      const result = await response.json();
      if (!response.ok || !result.id) throw new Error(result.code || result.error || "CREATE_FAILED");
      router.push(`/dashboard/cover-letters/${result.id}${applicationId ? `?applicationId=${encodeURIComponent(applicationId)}` : ""}`);
    } catch (e) { setError(e instanceof Error ? e.message : "Création impossible"); setBusy(false); }
  };
  return <main className="max-w-4xl space-y-6">
    <PageHeader title="Créer une lettre de motivation" description="Choisissez un modèle, votre CV et, si possible, une offre. La lettre sera un brouillon éditable lié aux documents choisis." />
    {applicationId && <Link className="text-sm text-primary" href={`/dashboard/applications/${encodeURIComponent(applicationId)}?tab=documents`}>← Retour au dossier de candidature</Link>}
    <section className="grid gap-5 rounded-xl border bg-card p-6 sm:grid-cols-2">
      <label className="grid gap-2 text-sm font-medium sm:col-span-2">Modèle de lettre
        <select className="h-10 rounded-md border bg-background px-3" value={templateId} onChange={e => setTemplateId(e.target.value)}>{templateCatalog.filter(x => x.type === "COVER_LETTER").map(x => <option key={x.id} value={x.id}>{x.name}</option>)}</select>
      </label>
      <label className="grid gap-2 text-sm font-medium">CV de référence (obligatoire)
        <select className="h-10 rounded-md border bg-background px-3" disabled={loading} value={cvId} onChange={e => setCvId(e.target.value)}><option value="">Choisir un CV</option>{choices.resumes.map(x => <option value={x.id} key={x.id}>{x.title || "CV sans titre"}</option>)}</select>
      </label>
      <label className="grid gap-2 text-sm font-medium">Offre d'emploi
        <select className="h-10 rounded-md border bg-background px-3" disabled={loading} value={jobId} onChange={e => setJobId(e.target.value)}><option value="">Aucune offre sélectionnée</option>{choices.jobs.map(x => <option value={x.id} key={x.id}>{x.title}{x.company ? ` — ${x.company}` : ""}</option>)}</select>
      </label>
      {error && <p role="alert" className="text-sm text-destructive sm:col-span-2">{error}</p>}
      <div className="flex flex-wrap items-center gap-3 sm:col-span-2"><Button disabled={!validCv || !validJob || loading || busy} onClick={() => void create()}>{busy ? <Loader2 className="size-4 animate-spin"/> : <Mail className="size-4"/>}Créer et ouvrir la lettre</Button><Button variant="outline" asChild><Link href="/dashboard/resumes"><FileText className="size-4"/> Mes CV</Link></Button></div>
    </section><p className="text-xs text-muted-foreground">Les textes ne sont pas inventés : le brouillon est vide tant que vous ne le rédigez pas ou ne validez pas une proposition IA dans l'éditeur.</p>
  </main>;
}
