"use client";
import Link from "next/link";
import { useTranslation } from "react-i18next";
import { ArrowRight, ScanLine } from "lucide-react";
import { PageHeader } from "@/components/ui/page-header";
import { Button } from "@/components/ui/button";
import { useApi } from "@/components/career/data-state";

export default function AtsPage() {
  const { i18n } = useTranslation();
  const fr = i18n.resolvedLanguage?.startsWith("fr");
  const { data, loading, error } = useApi<{ id: string; title: string; design?: { documentName?: string } }[]>("/api/cvs?mine=1");
  return <div className="space-y-7"><PageHeader title="ATS checker" description={fr ? "Ouvrez votre CV pour vérifier le fichier PDF, la qualité des preuves et l’adéquation à une offre, puis corrigez chaque point dans l’éditeur." : "Open your resume to check the PDF, the quality of its evidence and alignment with a job posting, then address each issue in the editor."} />
    {loading && <p role="status" className="text-sm text-muted-foreground">{fr ? "Chargement de vos CV…" : "Loading your resumes…"}</p>}
    {error && <p role="alert" className="text-sm text-destructive">{fr ? "Impossible de charger vos CV." : "Could not load your resumes."}</p>}
    <div className="grid gap-4 md:grid-cols-2">{data?.map(resume => <article key={resume.id} className="app-section"><ScanLine className="size-5 text-primary" /><h2 className="mt-4 text-base font-semibold">{resume.design?.documentName || resume.title || (fr ? "Mon CV" : "My resume")}</h2><Button asChild className="mt-5"><Link href={`/dashboard/resumes/${resume.id}?ats=1`}>{fr ? "Vérifier et améliorer ce CV" : "Check and improve this resume"}<ArrowRight className="size-4" /></Link></Button></article>)}</div>
    {!loading && !error && !data?.length && <div className="app-section"><p className="text-sm text-muted-foreground">{fr ? "Créez ou importez un CV pour commencer le diagnostic." : "Create or import a resume to start the assessment."}</p><Button asChild className="mt-4"><Link href="/dashboard/resumes">{fr ? "Mes CV" : "My resumes"}</Link></Button></div>}
  </div>;
}
