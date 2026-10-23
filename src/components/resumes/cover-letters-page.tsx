"use client";

import Link from "next/link";
import { useTranslation } from "react-i18next";
import { FileText, Mail } from "lucide-react";
import { Button } from "@/components/ui/button";
import { PageHeader } from "@/components/ui/page-header";

/** Kept for existing bookmarks. New letters deliberately start in a CV studio. */
export function CoverLettersPage() {
  const { i18n } = useTranslation();
  const fr = i18n.resolvedLanguage?.startsWith("fr");
  return <div className="space-y-6">
    <PageHeader title={fr ? "Lettres de motivation" : "Cover letters"} description={fr ? "Chaque lettre est créée depuis le CV auquel elle est associée et l’offre analysée pour ce CV." : "Each letter is created from its linked resume and the job posting analyzed for that resume."} />
    <section className="app-section max-w-2xl"><Mail className="size-7 text-primary" /><h2 className="mt-4 type-h2">{fr ? "Créez votre lettre depuis votre CV" : "Create your letter from your resume"}</h2><p className="mt-3 text-sm leading-6 text-muted-foreground">{fr ? "Ouvrez le CV adapté à l’offre, puis choisissez « Générer une lettre ». Cela garantit que la lettre reprend uniquement les éléments de ce CV et de cette offre." : "Open the resume tailored to the posting, then choose “Generate cover letter”. This keeps the letter grounded in that resume and job posting."}</p><Button className="mt-5" asChild><Link href="/dashboard/resumes"><FileText />{fr ? "Ouvrir mes CV" : "Open my resumes"}</Link></Button></section>
  </div>;
}
