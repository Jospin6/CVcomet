"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import Link from "next/link";
import {
  ArrowRight,
  BriefcaseBusiness,
  Check,
  ChevronRight,
  Clock3,
  Eye,
  FileText,
  Heart,
  LoaderCircle,
  MapPin,
  Search,
  Settings2,
  SlidersHorizontal,
  Sparkles,
  X,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { AtsResumePreview, type AtsResumeRecord } from "@/components/resumes/ats-resume-preview";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { CompanyLogo, companyName, jobSalary, publishedLabel } from "./find-jobs-view";
import type { FindJob } from "./find-jobs-view";
import type { SavedResume } from "@/lib/resume-documents";
import type { MatchingPreferences } from "@/lib/find-jobs/for-you";
import { defaultMatchingPreferences } from "@/lib/find-jobs/for-you";

type FullResume = Omit<SavedResume, "experiences"> & {
  updatedAt: string;
  skills?: { hardskills?: string; softskills?: string; tools?: string }[];
  experiences?: {
    title: string;
    company: string;
    start?: string;
    end?: string;
    description?: string[];
  }[];
  projects?: { title: string; description: string }[];
  certifications?: { title: string; issuer: string }[];
  educations?: { degree: string; school: string }[];
};

type Country = { code: string; label: string; count: number };
type MatchJob = Omit<FindJob, "match"> & {
  match: {
    score: number | null;
    matched: string[];
    missing: string[];
    explanation: string;
  };
  outsidePreferences?: boolean;
};

type Props = {
  french: boolean;
  savedUrls: Set<string>;
  savingUrl: string | null;
  onOpen: (job: FindJob) => void;
  onSave: (job: FindJob) => void;
};

const contractOptions = [
  ["full-time", "Full-time", "Temps plein"],
  ["part-time", "Part-time", "Temps partiel"],
  ["contract", "Contract", "Contrat"],
  ["temporary", "Temporary", "Temporaire"],
  ["internship", "Internship", "Stage"],
  ["volunteer", "Volunteer", "Bénévolat"],
  ["other", "Other", "Autre"],
] as const;
const levelOptions = [
  ["entry", "Entry Level", "Débutant"],
  ["mid", "Mid Level", "Intermédiaire"],
  ["senior", "Senior Level", "Senior"],
  ["executive", "Executive", "Direction"],
] as const;
const workplaceOptions = [
  ["onsite", "On-site", "Sur site"],
  ["hybrid", "Hybrid", "Hybride"],
  ["remote", "Remote", "À distance"],
] as const;

function getWords(french: boolean) {
  return french ? {
    myResume: "Mon CV",
    edited: "Modifié le",
    choose: "Changer de CV",
    preview: "Aperçu du CV",
    prefs: "Préférences de correspondance",
    adjust: "Ajuster les préférences",
    matchFor: "Rechercher des offres pour",
    find: "Analyser mon CV et trouver des offres",
    analyzing: "L'IA compare votre CV aux offres…",
    top: "Vos 5 meilleures correspondances",
    none: "Aucune offre suffisamment proche du CV parmi les annonces disponibles.",
    noSources: "Aucune offre n’a pu être chargée. Réessayez dans un moment.",
    outsideTag: "Hors filtres",
    noResume: "Créez ou importez puis convertissez un CV pour obtenir des correspondances personnalisées.",
    error: "Impossible de terminer la recherche. Veuillez réessayer.",
    retry: "Relancer l’analyse",
    select: "Sélectionnez un CV à analyser",
    keyword: "Intitulé de poste",
    keywordPlaceholder: "Métier ou mot-clé (optionnel)",
    country: "Pays",
    countryHint: "Seuls les pays présents dans les offres sont proposés.",
    countrySearch: "Chercher un pays",
    date: "Date de publication",
    any: "Sans limite",
    day: "Dernières 24 h",
    week: "7 derniers jours",
    month: "30 derniers jours",
    type: "Type de contrat",
    level: "Niveau d'expérience",
    salary: "Salaire annuel minimum (USD)",
    salaryHint: "Les offres sans salaire annuel USD vérifiable sont exclues si ce filtre est actif.",
    workplace: "Mode de travail",
    visa: "Parrainage de visa",
    visaHint: "Uniquement les offres indiquant explicitement un parrainage",
    reset: "Réinitialiser",
    update: "Appliquer et analyser",
    save: "Enregistrer",
    saved: "Enregistrée",
    score: "Correspondance du CV",
    unverified: "Non évaluée",
    why: "Détails de la correspondance",
    demonstrated: "Exigences démontrées",
    missing: "Éléments non démontrés",
    result: "Offres examinées",
    page: "Page",
    textPreview: "Aperçu du contenu (pas le rendu PDF définitif)",
    noCountries: "Aucun pays identifié dans les offres",
    profileOnly: "Le score est calculé exclusivement à partir du CV sélectionné.",
    verifiedCoverage: "Offres analysées en profondeur",
  } : {
    myResume: "My Resume",
    edited: "Last edited",
    choose: "Change Resume",
    preview: "Resume preview",
    prefs: "Matching Preferences",
    adjust: "Adjust Preferences",
    matchFor: "Finding matches for",
    find: "Analyze my resume and find jobs",
    analyzing: "AI is comparing your resume with job requirements…",
    top: "Your Top 5 Matches",
    none: "No sufficiently resume-relevant openings were found in the current listings.",
    noSources: "No job listings could be loaded. Try again shortly.",
    outsideTag: "Outside filters",
    noResume: "Create or import and convert an editable resume to get personalized matches.",
    error: "Unable to finish this search. Please try again.",
    retry: "Retry match analysis",
    select: "Select a resume to analyze",
    keyword: "Job title",
    keywordPlaceholder: "Role or keyword (optional)",
    country: "Country",
    countryHint: "Only countries found in available job postings are shown.",
    countrySearch: "Search countries",
    date: "Posted within",
    any: "Any time",
    day: "Past 24 hours",
    week: "Past week",
    month: "Past month",
    type: "Job type",
    level: "Seniority level",
    salary: "Min. annual salary (USD)",
    salaryHint: "Jobs without verified annual USD salaries are excluded when this filter is set.",
    workplace: "Workplace",
    visa: "Visa sponsorship",
    visaHint: "Only jobs that explicitly state visa sponsorship",
    reset: "Reset All",
    update: "Apply and match",
    save: "Save",
    saved: "Saved",
    score: "Resume match",
    unverified: "Not evaluated",
    why: "Why this match?",
    demonstrated: "Demonstrated requirements",
    missing: "Not evidenced in the resume",
    result: "Jobs considered",
    page: "Page",
    textPreview: "Content preview (not the final PDF layout)",
    noCountries: "No job countries identified",
    profileOnly: "Match scores use only the selected resume.",
    verifiedCoverage: "Deeply analyzed offers",
  };
}

type MatchWarningCode = string | null | undefined;

/** All errors are explicit and actionable; never expose raw provider errors. */
function matchErrorMessage(code: MatchWarningCode, french: boolean) {
  const labels: Record<string, [string, string]> = {
    AI_UNAVAILABLE: ["Aucun modèle IA actif n’est configuré. Vérifiez les paramètres IA.", "No active AI model configured. Check AI settings."],
    AI_AUTH_ERROR: ["La clé API du fournisseur IA est refusée.", "The AI provider rejected its API key."],
    AI_MODEL_UNAVAILABLE: ["Le modèle IA sélectionné n’est pas disponible. Choisissez un modèle valide.", "The selected AI model is unavailable. Choose a supported model."],
    AI_PROVIDER_UNAVAILABLE: ["Le fournisseur IA ne répond pas actuellement. Réessayez.", "The AI provider is currently unavailable. Retry later."],
    AI_RATE_LIMIT: ["Le fournisseur IA limite temporairement les requêtes.", "The AI provider is rate limiting requests."],
    AI_LIMIT: ["Le quota quotidien d’IA est atteint. Réessayez après son renouvellement.", "Daily AI quota reached. Retry after it resets."],
    AI_HOURLY_LIMIT: ["Le quota IA horaire est atteint.", "Hourly AI quota reached."],
    AI_MONTHLY_LIMIT: ["Le crédit IA mensuel est épuisé.", "Monthly AI credits exhausted."],
    AI_TIMEOUT: ["L’analyse IA a expiré. Réessayez.", "AI matching timed out. Please retry."],
    AI_INVALID_RESPONSE: ["Le modèle IA a répondu dans un format invalide. Réessayez ou changez de modèle.", "The AI model returned an invalid response. Retry or change the model."],
    AI_FAILED: ["L’analyse IA a échoué. Consultez les logs du serveur.", "AI evaluation failed. Check server logs."],
    PREFERENCES_NOT_PERSISTED: ["La recherche fonctionne, mais les préférences ne peuvent pas être enregistrées pour le moment. Vérifiez le schéma de la base utilisée par l’application.", "Search works, but preferences cannot be saved right now. Check the database schema used by the application."],
    // Compatibility with deployments that still send the old, misleading code.
    PRISMA_MIGRATION_REQUIRED: ["Le stockage des préférences est indisponible. Vérifiez la base de données utilisée par l’application.", "Preference storage is unavailable. Check the database used by the app."],
    RESUME_NOT_FOUND: ["Le CV sélectionné est introuvable. Choisissez-en un autre.", "Selected resume not found. Choose a different one."],
    SELECT_RESUME_FIRST: ["Sélectionnez d’abord un CV.", "Select a resume first."],
    RESUME_CONTENT_TOO_SHORT: ["Ce CV est trop vide pour être analysé. Ajoutez vos expériences et compétences.", "This resume does not contain enough information. Add experience and skills."],
    RESUME_INVALID_CONTENT: ["Ce CV comporte des champs incompatibles. Ouvrez-le dans l’éditeur pour les corriger.", "This resume has incompatible fields. Open it in the editor to fix them."],
    UNAUTHORIZED: ["Session expirée. Reconnectez-vous.", "Session expired. Sign in again."],
    VALIDATION: ["Les préférences sont invalides. Réinitialisez les filtres.", "Preferences are invalid. Reset the filters."],
    UNAVAILABLE: ["Le service ne répond pas. Vérifiez la base de données et les logs.", "The service is unavailable. Check database connectivity and server logs."],
  };
  return (labels[code || ""] || [
    "Erreur lors de la recherche. Vérifiez la connexion et réessayez.",
    "Job search failed. Check your connection and retry.",
  ])[french ? 0 : 1];
}

async function readApiResponse(response: Response) {
  const data: unknown = await response.json().catch(() => null);
  if (!response.ok) {
    const code = data && typeof data === "object" && "error" in data &&
      typeof data.error === "string" ? data.error : "UNAVAILABLE";
    throw new Error(code);
  }
  return data;
}

function selector<K extends keyof MatchingPreferences>(
  update: (key: K, value: MatchingPreferences[K]) => void,
  key: K,
  items: MatchingPreferences[K] & string[],
  value: string,
) {
  const next = items.includes(value)
    ? items.filter((item) => item !== value)
    : [...items, value];
  update(key, next as MatchingPreferences[K]);
}

function ResumePreview({ resume, french, open, onOpenChange }: {
  resume: FullResume | undefined;
  french: boolean;
  open: boolean;
  onOpenChange: (value: boolean) => void;
}) {
  const words = getWords(french);
  if (!resume) return null;
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-h-[95dvh] overflow-hidden sm:max-w-[950px]">
        <DialogHeader>
          <DialogTitle>{words.preview}</DialogTitle>
          <DialogDescription>{resume.title || words.myResume}</DialogDescription>
        </DialogHeader>
        <div className="min-h-0 overflow-y-auto">
          <AtsResumePreview
            record={resume as unknown as AtsResumeRecord}
            language={french ? "fr" : "en"}
            large
          />
        </div>
      </DialogContent>
    </Dialog>
  );
}

export function JobsForYou({
  french, savedUrls, savingUrl, onOpen, onSave,
}: Props) {
  const c = getWords(french);
  const [resumes, setResumes] = useState<FullResume[]>([]);
  const [prefs, setPrefs] = useState<MatchingPreferences>(
    defaultMatchingPreferences,
  );
  const [draft, setDraft] = useState<MatchingPreferences>(
    defaultMatchingPreferences,
  );
  const [countries, setCountries] = useState<Country[]>([]);
  const [countryTerm, setCountryTerm] = useState("");
  const [countryExpanded, setCountryExpanded] = useState(false);
  const [drawer, setDrawer] = useState(false);
  const [picker, setPicker] = useState(false);
  const [preview, setPreview] = useState(false);
  const [pending, setPending] = useState(false);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [warning, setWarning] = useState("");
  const requestSequence = useRef(0);
  const [hasResults, setHasResults] = useState(false);
  const [jobs, setJobs] = useState<MatchJob[]>([]);
  const [considered, setConsidered] = useState(0);
  const [verifiedCount, setVerifiedCount] = useState(0);
  const [deepMatchCount, setDeepMatchCount] = useState(0);
  const [emptyReason, setEmptyReason] = useState<string | null>(null);
  const firstMatchStarted = useRef(false);
  const [explained, setExplained] = useState<string | null>(null);

  const selected = resumes.find((resume) => resume.id === prefs.cvId);
  const update = <K extends keyof MatchingPreferences>(
    field: K,
    value: MatchingPreferences[K],
  ) => setDraft((current) => ({ ...current, [field]: value }));

  useEffect(() => {
    let alive = true;
    void Promise.all([
      fetch("/api/cvs?mine=1", { cache: "no-store" })
        .then(readApiResponse),
      fetch("/api/find-jobs/for-you", { cache: "no-store" })
        .then(readApiResponse),
      fetch("/api/find-jobs?page=1", { cache: "no-store" })
        .then((r) => r.ok ? r.json() : { countries: [] }),
    ]).then(([cvs, saved, listing]) => {
      if (!alive) return;
      const items = Array.isArray(cvs) ? cvs as FullResume[] : [];
      const previous = saved && typeof saved === "object" &&
        "preferences" in saved && saved.preferences
        ? saved.preferences as MatchingPreferences
        : defaultMatchingPreferences;
      const cvId = items.some((item) => item.id === previous.cvId)
        ? previous.cvId : items[0]?.id || null;
      const initial = { ...previous, cvId };
      setResumes(items);
      setPrefs(initial);
      setDraft(initial);
      setCountries(listing.countries || []);
      if (saved && typeof saved === "object" && "warningCode" in saved &&
          typeof saved.warningCode === "string") {
        setWarning(matchErrorMessage(saved.warningCode, french));
      }
    }).catch((reason: unknown) => {
      if (alive) setError(matchErrorMessage(
        reason instanceof Error ? reason.message : null, french,
      ));
    }).finally(() => {
      if (alive) setLoading(false);
    });
    return () => { alive = false; };
    // Refetch only on remount, not on language switches.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const runMatch = useCallback(async (next: MatchingPreferences) => {
    if (!next.cvId) {
      setPicker(true);
      setError(matchErrorMessage("SELECT_RESUME_FIRST", french));
      return;
    }
    const requestId = ++requestSequence.current;
    setPending(true);
    setError("");
    setWarning("");
    // The previous results remain visible during a retry.
    try {
      const response = await fetch("/api/find-jobs/for-you", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ preferences: next, save: true, language: french ? "fr" : "en" }),
      });
      const data = await readApiResponse(response) as {
        jobs?: MatchJob[];
        totalConsidered?: number;
        countries?: Country[];
        warningCode?: string | null;
        verifiedCount?: number;
        deepMatchCount?: number;
        reason?: string;
      };
      if (requestId !== requestSequence.current) return;
      setJobs(data.jobs || []);
      setConsidered(data.totalConsidered || 0);
      setVerifiedCount(data.verifiedCount || 0);
      setDeepMatchCount(data.deepMatchCount || 0);
      setEmptyReason(data.reason || null);
      if (data.countries) setCountries(data.countries);
      setPrefs(next);
      setDraft(next);
      setHasResults(true);
      setDrawer(false);
      if (data.warningCode) {
        setWarning(matchErrorMessage(data.warningCode, french));
      }
    } catch (reason) {
      if (requestId !== requestSequence.current) return;
      setError(matchErrorMessage(
        reason instanceof Error ? reason.message : null, french,
      ));
    } finally {
      if (requestId === requestSequence.current) setPending(false);
    }
  }, [french]);

  // As in the reference interface, existing editable resumes immediately
  // get personalized results on entering the Jobs for You tab. The server
  // caches recent evaluations and still enforces AI quotas.
  useEffect(() => {
    if (loading || !prefs.cvId || firstMatchStarted.current) return;
    firstMatchStarted.current = true;
    void runMatch(prefs);
  }, [loading, prefs, runMatch]);

  const filteredCountries = useMemo(() => countries.filter((entry) =>
    entry.label.toLowerCase().includes(countryTerm.toLowerCase()) ||
    entry.code.toLowerCase().includes(countryTerm.toLowerCase()),
  ), [countries, countryTerm]);

  if (loading) return (
    <div role="status" className="flex justify-center py-16 text-muted-foreground">
      <LoaderCircle className="mr-2 size-5 animate-spin" /> Loading…
    </div>
  );

  return (
    <div className="mx-auto max-w-5xl space-y-8">
      <section className="flex flex-col gap-5 sm:flex-row sm:items-start">
        <button
          type="button"
          disabled={!selected}
          onClick={() => setPreview(true)}
          aria-label={c.preview}
          className="group relative h-[140px] w-[105px] shrink-0 overflow-hidden rounded-md border bg-white text-left shadow-sm transition-shadow hover:shadow-md disabled:opacity-50"
        >
          {selected && (
            <div className="pointer-events-none h-full w-full overflow-hidden">
              <AtsResumePreview
                record={selected as unknown as AtsResumeRecord}
                language={french ? "fr" : "en"}
              />
            </div>
          )}
          <span className="absolute inset-0 flex items-center justify-center bg-black/35 opacity-0 transition-opacity group-hover:opacity-100 group-focus-visible:opacity-100">
            <Eye aria-hidden="true" className="size-5 text-white" />
          </span>
        </button>

        <div className="min-w-0 flex-1 space-y-2">
          <h1 className="text-xl font-semibold">
            {selected?.title || c.myResume}
          </h1>
          {selected?.updatedAt && (
            <p className="text-xs text-muted-foreground">
              {c.edited} {publishedLabel(selected.updatedAt, french)}
            </p>
          )}
          <div className="flex flex-wrap items-center gap-2">
            <Button
              variant="outline" size="sm" onClick={() => setDrawer(true)}
              disabled={!resumes.length}
            >
              <Settings2 className="size-4" /> {c.adjust}
            </Button>
            <Button
              size="sm" variant="ghost" onClick={() => setPicker(true)}
            >
              {c.choose} <ChevronRight className="size-4" />
            </Button>
          </div>
          <div className="flex flex-wrap items-center gap-3 text-xs text-muted-foreground">
            {prefs.countries.length > 0 && (
              <span className="inline-flex items-center gap-1">
                <MapPin className="size-3.5" />
                {prefs.countries.map((code) =>
                  countries.find((entry) => entry.code === code)?.label || code,
                ).join(", ")}
              </span>
            )}
            <span className="inline-flex items-center gap-1">
              <Clock3 className="size-3.5" />
              {({ any: c.any, day: c.day, week: c.week, month: c.month })
                [prefs.postedWithin]}
            </span>
            {prefs.seniorities.length > 0 && <span>
              {prefs.seniorities.join(", ")}
            </span>}
          </div>
          <p className="text-xs text-muted-foreground">
            {c.profileOnly}
          </p>
        </div>
      </section>

      <section className="space-y-4" aria-labelledby="jobs-for-you-title">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <h2 id="jobs-for-you-title" className="text-2xl font-semibold">
            {c.top}
          </h2>
          {hasResults && <span className="text-xs text-muted-foreground">
            {c.result}: {considered}
            {jobs.length > 0 && deepMatchCount > 0 && (
              <> · {c.verifiedCoverage}: {verifiedCount}/{deepMatchCount}</>
            )}
          </span>}
        </div>
        {!resumes.length ? (
          <div className="rounded-xl border bg-card px-6 py-10 text-center">
            <FileText className="mx-auto mb-3 size-7 text-muted-foreground" />
            <p>{c.noResume}</p>
            <Button className="mt-4" asChild>
              <Link href="/dashboard/resumes">{c.choose}</Link>
            </Button>
          </div>
        ) : !hasResults && !pending ? (
          <div className="rounded-xl border bg-card p-6 text-center">
            <Sparkles className="mx-auto mb-3 size-7 text-primary" />
            <p className="mb-4 text-sm text-muted-foreground">
              {c.matchFor} {selected?.title || c.myResume}.
            </p>
            <Button onClick={() => void runMatch(prefs)}>
              <Sparkles className="size-4" /> {c.find}
            </Button>
          </div>
        ) : null}
        {error && (
          <div role="alert" className="flex flex-wrap items-center justify-between gap-3 rounded-lg border p-3 text-sm text-destructive">
            <span>{error}</span>
            <Button variant="outline" size="sm" disabled={pending || !prefs.cvId}
              onClick={() => void runMatch(prefs)}>
              {c.retry}
            </Button>
          </div>
        )}
        {warning && (
          <div role="status" className="flex flex-wrap items-center justify-between gap-3 rounded-lg border p-3 text-sm text-muted-foreground">
            <span>{warning}</span>
            <Button variant="outline" size="sm" disabled={pending || !prefs.cvId}
              onClick={() => void runMatch(prefs)}>
              {c.retry}
            </Button>
          </div>
        )}
        {pending && <div role="status" className="flex items-center justify-center gap-2 rounded-xl border bg-card px-5 py-10 text-sm text-muted-foreground">
          <LoaderCircle className="size-5 animate-spin" /> {c.analyzing}
        </div>}
        {hasResults && !jobs.length && !pending && (
          <div className="rounded-xl bg-muted p-7 text-center text-sm">
            <p>{emptyReason === "NO_JOBS_AVAILABLE" ? c.noSources : c.none}</p>
            <Button variant="outline" size="sm" className="mt-4" onClick={() => setDrawer(true)}>
              {c.adjust}
            </Button>
          </div>
        )}
        {hasResults && jobs.map((job) => (
          <article key={job.id} className="rounded-2xl border bg-card p-4 transition-shadow hover:shadow-sm">
            <div className="flex items-start gap-3 sm:gap-4">
              <CompanyLogo name={job.company} logoUrl={job.logoUrl} />
              <button
                type="button"
                onClick={() => onOpen(job)}
                className="min-w-0 flex-1 text-left"
              >
                <h3 className="text-base font-semibold hover:text-primary">
                  {job.title}
                </h3>
                <p className="text-sm">
                  {companyName(job.company)}
                  {jobSalary(job) && (
                    <span className="text-muted-foreground"> · {jobSalary(job)}</span>
                  )}
                </p>
                <div className="mt-2 flex flex-wrap gap-x-3 gap-y-1 text-xs text-muted-foreground">
                  <span className="inline-flex items-center gap-1">
                    <Clock3 className="size-3.5" />
                    {publishedLabel(job.publishedAt, french) || "—"}
                  </span>
                  {job.location && <span className="inline-flex items-center gap-1">
                    <MapPin className="size-3.5" /> {job.location}
                  </span>}
                  {job.contractType && <span>{job.contractType}</span>}
                  {job.remote !== null && <span>
                    {job.remote ? "Remote" : "On-site"}
                  </span>}
                </div>
              </button>
              <div className="flex shrink-0 flex-col items-stretch gap-2">
                {job.outsidePreferences && (
                  <span className="text-center text-[11px] text-muted-foreground">
                    {c.outsideTag}
                  </span>
                )}
                <span
                  className="rounded-lg bg-primary/10 px-3 py-1 text-center text-xs font-semibold text-primary"
                >
                  {job.match.score !== null
                    ? `${job.match.score}% ${c.score}`
                    : c.unverified}
                </span>
                <Button
                  size="sm" variant="outline"
                  disabled={savingUrl === job.sourceUrl}
                  onClick={() => onSave(job)}
                >
                  <Heart className={`size-4 ${savedUrls.has(job.sourceUrl)
                    ? "fill-primary text-primary" : ""}`} />
                  {savedUrls.has(job.sourceUrl) ? c.saved : c.save}
                </Button>
              </div>
            </div>
            {job.match.score !== null && (
              <div className="mt-3 border-t pt-2">
                <button
                  type="button" className="text-xs text-primary hover:underline"
                  onClick={() => setExplained(
                    explained === job.id ? null : job.id,
                  )}
                  aria-expanded={explained === job.id}
                >
                  {c.why} <ChevronRight className="inline size-3" />
                </button>
                {explained === job.id && (
                  <div className="mt-2 grid gap-2 text-xs sm:grid-cols-2">
                    <div>
                      <strong>{c.demonstrated}</strong>
                      {job.match.matched.map((text) => (
                        <p key={text} className="mt-1 text-muted-foreground">
                          <Check className="mr-1 inline size-3" /> {text}
                        </p>
                      ))}
                    </div>
                    <div>
                      <strong>{c.missing}</strong>
                      {job.match.missing.map((text) => (
                        <p key={text} className="mt-1 text-muted-foreground">
                          {text}
                        </p>
                      ))}
                    </div>
                  </div>
                )}
              </div>
            )}
          </article>
        ))}
      </section>

      {/* Resume picker: only editable CVs belong to the score source. */}
      <Dialog open={picker} onOpenChange={setPicker}>
        <DialogContent className="max-h-[90dvh] overflow-hidden sm:max-w-[780px]">
          <DialogHeader>
            <DialogTitle>{c.select}</DialogTitle>
            <DialogDescription>{c.profileOnly}</DialogDescription>
          </DialogHeader>
          <div className="min-h-0 max-h-[66dvh] overflow-y-auto pr-1">
            {resumes.length === 0 && (
              <p className="py-10 text-center text-sm text-muted-foreground">{c.noResume}</p>
            )}
            <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 sm:gap-4">
              {resumes.map((resume) => {
                const active = resume.id === prefs.cvId;
                return (
                  <button
                    type="button"
                    key={resume.id}
                    aria-pressed={active}
                    aria-label={`${resume.title || c.myResume}${active ? (french ? " — sélectionné" : " — selected") : ""}`}
                    onClick={() => {
                      const next = { ...prefs, cvId: resume.id };
                      // Only the chosen resume is sent to the matching agent.
                      requestSequence.current++;
                      setPrefs(next);
                      setDraft(next);
                      setJobs([]);
                      setHasResults(false);
                      setPicker(false);
                      void runMatch(next);
                    }}
                    className={`group relative min-w-0 overflow-hidden rounded-xl border bg-card text-left transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary focus-visible:ring-offset-2 hover:border-primary/60 ${
                      active ? "border-primary ring-1 ring-primary" : "border-border"
                    }`}
                  >
                    <div className="relative flex h-[230px] items-start justify-center overflow-hidden border-b bg-muted/30 p-2 sm:h-[240px]">
                      <div className="pointer-events-none h-full w-[150px] max-w-full overflow-hidden rounded-t-sm border border-neutral-200 bg-white shadow-sm">
                        <AtsResumePreview
                          record={resume as unknown as AtsResumeRecord}
                          language={french ? "fr" : "en"}
                        />
                      </div>
                      {active && (
                        <span className="absolute right-2 top-2 flex size-6 items-center justify-center rounded-full bg-primary text-primary-foreground" aria-hidden="true">
                          <Check className="size-4" />
                        </span>
                      )}
                    </div>
                    <div className="space-y-1 px-3 py-2.5">
                      <p className="truncate text-sm font-medium" title={resume.title || c.myResume}>
                        {resume.title || c.myResume}
                      </p>
                      <p className={`truncate text-xs ${active ? "text-primary" : "text-muted-foreground"}`}>
                        {active ? (french ? "CV sélectionné" : "Selected resume") : resume.contact?.name || (french ? "Cliquez pour sélectionner" : "Click to select")}
                      </p>
                    </div>
                  </button>
                );
              })}
            </div>
          </div>
        </DialogContent>
      </Dialog>
      <ResumePreview
        resume={selected} french={french}
        open={preview} onOpenChange={setPreview}
      />

      {/* Floating right drawer, using the app's existing semantic theme tokens. */}
      {drawer && (
        <div className="fixed inset-0 z-50" role="presentation">
          <button
            className="absolute inset-0 bg-black/20 sm:bg-transparent"
            type="button" aria-label="Close preferences"
            onClick={() => setDrawer(false)}
          />
          <aside
            role="dialog" aria-modal="true" aria-label={c.prefs}
            className="absolute inset-y-3 right-3 flex w-[min(375px,calc(100%-24px))] flex-col rounded-2xl border bg-card shadow-xl sm:inset-y-6 sm:right-6"
          >
            <div className="flex items-center justify-between border-b px-5 py-4">
              <h2 className="text-sm font-semibold">{c.prefs}</h2>
              <Button variant="ghost" size="icon" onClick={() => setDrawer(false)} aria-label="Close">
                <X className="size-5" />
              </Button>
            </div>
            <div className="min-h-0 flex-1 space-y-6 overflow-y-auto px-5 py-5">
              <div className="flex gap-3">
                <FileText className="size-9 shrink-0 text-primary" />
                <div className="min-w-0 flex-1">
                  <p className="text-xs text-muted-foreground">{c.matchFor}</p>
                  <p className="truncate text-sm font-semibold">
                    {resumes.find((r) => r.id === draft.cvId)?.title || c.myResume}
                  </p>
                  <Button size="sm" variant="outline" className="mt-2" onClick={() => {
                    setDrawer(false);
                    setPicker(true);
                  }}>{c.choose}</Button>
                </div>
              </div>
              <fieldset className="space-y-2">
                <label htmlFor="match-title" className="block text-sm font-medium">
                  <Search className="mr-2 inline size-4" /> {c.keyword}
                </label>
                <input
                  id="match-title" value={draft.title}
                  onChange={(event) => update("title", event.target.value)}
                  placeholder={c.keywordPlaceholder}
                  className="w-full rounded-lg border bg-background px-3 py-2 text-sm outline-primary"
                />
              </fieldset>
              <fieldset className="space-y-2">
                <legend className="mb-2 text-sm font-medium">
                  <MapPin className="mr-2 inline size-4" />{c.country}
                </legend>
                <button
                  type="button" onClick={() => setCountryExpanded(!countryExpanded)}
                  aria-expanded={countryExpanded}
                  className="w-full rounded-lg bg-foreground px-3 py-2 text-left text-xs text-background"
                >
                  {draft.countries.length
                    ? draft.countries.map((code) => countries.find((item) =>
                        item.code === code)?.label || code).join(", ")
                    : c.any}
                  <SlidersHorizontal className="float-right size-4" />
                </button>
                {countryExpanded && <div className="space-y-2 rounded-xl border p-2">
                  <input
                    value={countryTerm}
                    onChange={(event) => setCountryTerm(event.target.value)}
                    placeholder={c.countrySearch}
                    aria-label={c.countrySearch}
                    className="w-full rounded-lg border bg-background px-3 py-2 text-sm"
                  />
                  <div className="max-h-36 space-y-1 overflow-y-auto">
                    {filteredCountries.length ? filteredCountries.map((item) => (
                      <label key={item.code} className="flex cursor-pointer items-center gap-2 rounded-lg px-2 py-1.5 text-xs hover:bg-muted">
                        <input type="checkbox"
                          checked={draft.countries.includes(item.code)}
                          onChange={() => selector(update, "countries", draft.countries, item.code)}
                          className="accent-primary"
                        />
                        <span className="flex-1">{item.label}</span>
                        <span className="text-muted-foreground">{item.count}</span>
                      </label>
                    )) : <p className="text-xs text-muted-foreground">{c.noCountries}</p>}
                  </div>
                </div>}
                <p className="text-xs text-muted-foreground">{c.countryHint}</p>
              </fieldset>
              <fieldset className="space-y-2">
                <legend className="text-sm font-medium">
                  <Clock3 className="mr-2 inline size-4" />{c.date}
                </legend>
                <div className="flex flex-wrap gap-2">
                  {(["any", "day", "week", "month"] as const).map((value) => (
                    <button
                      key={value} type="button" aria-pressed={draft.postedWithin === value}
                      onClick={() => update("postedWithin", value)}
                      className={`rounded-lg px-3 py-2 text-xs ${draft.postedWithin === value
                        ? "bg-foreground text-background" : "bg-muted text-foreground"}`}
                    >{c[value]}</button>
                  ))}
                </div>
              </fieldset>
              <fieldset className="space-y-2">
                <legend className="text-sm font-medium">{c.type}</legend>
                <div className="flex flex-wrap gap-2">
                  {contractOptions.map(([value, en, fr]) => (
                    <button key={value} type="button"
                      aria-pressed={draft.contracts.includes(value)}
                      onClick={() => selector(update, "contracts", draft.contracts, value)}
                      className={`rounded-lg px-3 py-2 text-xs ${draft.contracts.includes(value)
                        ? "bg-foreground text-background" : "bg-muted text-foreground"}`}
                    >{french ? fr : en}</button>
                  ))}
                </div>
              </fieldset>
              <fieldset className="space-y-2">
                <legend className="text-sm font-medium">{c.level}</legend>
                <div className="flex flex-wrap gap-2">
                  {levelOptions.map(([value, en, fr]) => (
                    <button key={value} type="button"
                      aria-pressed={draft.seniorities.includes(value)}
                      onClick={() => selector(update, "seniorities", draft.seniorities, value)}
                      className={`rounded-lg px-3 py-2 text-xs ${draft.seniorities.includes(value)
                        ? "bg-foreground text-background" : "bg-muted text-foreground"}`}
                    >{french ? fr : en}</button>
                  ))}
                </div>
              </fieldset>
              <div className="space-y-2">
                <label htmlFor="minimum-salary" className="block text-sm font-medium">
                  {c.salary}
                </label>
                <input id="minimum-salary" type="number" min={0}
                  value={draft.minimumAnnualUsd ?? ""}
                  placeholder="$0"
                  onChange={(event) => update("minimumAnnualUsd",
                    event.target.value ? Number(event.target.value) : null)}
                  className="w-full rounded-lg border bg-background px-3 py-2 text-sm"
                />
                <p className="text-xs text-muted-foreground">{c.salaryHint}</p>
              </div>
              <fieldset className="space-y-2">
                <legend className="text-sm font-medium">
                  <BriefcaseBusiness className="mr-2 inline size-4" />{c.workplace}
                </legend>
                <div className="flex flex-wrap gap-2">
                  {workplaceOptions.map(([value, en, fr]) => (
                    <button key={value} type="button"
                      aria-pressed={draft.workplaces.includes(value)}
                      onClick={() => selector(update, "workplaces", draft.workplaces, value)}
                      className={`rounded-lg px-3 py-2 text-xs ${draft.workplaces.includes(value)
                        ? "bg-foreground text-background" : "bg-muted text-foreground"}`}
                    >{french ? fr : en}</button>
                  ))}
                </div>
              </fieldset>
              <label className="flex cursor-pointer items-start gap-2 text-sm">
                <input type="checkbox" checked={draft.visaSponsorship}
                  onChange={(event) => update("visaSponsorship", event.target.checked)}
                  className="mt-1 accent-primary" />
                <span><strong>{c.visa}</strong>
                  <span className="block text-xs text-muted-foreground">{c.visaHint}</span>
                </span>
              </label>
            </div>
            <div className="flex gap-2 border-t p-4">
              <Button variant="outline" className="flex-1" onClick={() =>
                setDraft({ ...defaultMatchingPreferences, cvId: draft.cvId })}>
                {c.reset}
              </Button>
              <Button className="flex-1" disabled={pending || !draft.cvId}
                onClick={() => void runMatch(draft)}>
                {pending ? <LoaderCircle className="size-4 animate-spin" /> :
                  <ArrowRight className="size-4" />}
                {c.update}
              </Button>
            </div>
          </aside>
        </div>
      )}
    </div>
  );
}
