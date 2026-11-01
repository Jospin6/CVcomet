"use client";
import { useCallback, useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { useDispatch } from "react-redux";
import { useTranslation } from "react-i18next";
import { Check, ChevronLeft, ChevronRight, Save, UploadCloud, Sparkles, FileText, ShieldCheck, Globe2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { ProgressBar } from "@/components/ui/progress-bar";
import { PageHeader } from "@/components/ui/page-header";
import { Skeleton } from "@/components/ui/skeleton";
import { ProfileFields, TargetFields, type ProfileTab } from "./profile-fields";
import { profileCompleteness, mergeExtractedProfile, saveProfileSchema, type ProfileData, type CareerProfile } from "@/lib/career-profile/schema";
import { fetchUser } from "@/redux/user/userSlice";
import { useCurrentUser } from "@/hooks/useCurrentUser";
import type { AppDispatch } from "@/redux/store";
import { marketProfiles, resumeMarkets, referralSources } from "@/lib/resume-market";
import type { ProfileImportReview } from "@/lib/career-profile/merge";

const steps = ["resume", "market", "goal", "level", "job", "review"];
const profileTabs = [
  { id: "overview", en: "Overview", fr: "Profil" },
  { id: "experience", en: "Experience", fr: "Expériences" },
  { id: "education", en: "Education", fr: "Formations" },
  { id: "skills", en: "Skills", fr: "Compétences" },
  { id: "links", en: "Links", fr: "Liens" },
] as const satisfies ReadonlyArray<{ id: ProfileTab; en: string; fr: string }>;
function draftOf({ revision: _revision, onboardingCompletedAt: _date, ...data }: CareerProfile): ProfileData { return data; }

export function CareerProfilePage({ onboarding = false }: { onboarding?: boolean }) {
  const { t, i18n } = useTranslation();
  const router = useRouter();
  const { user: session } = useCurrentUser();
  const dispatch = useDispatch<AppDispatch>();
  const [saved, setSaved] = useState<CareerProfile | null>(null);
  const [draft, setDraft] = useState<ProfileData | null>(null);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [importing, setImporting] = useState(false);
  const [importReady, setImportReady] = useState(false);
  const [imported, setImported] = useState(false);
  const [importReview, setImportReview] = useState<ProfileImportReview | null>(null);
  const [error, setError] = useState("");
  const [issues, setIssues] = useState<string[]>([]);
  const [message, setMessage] = useState("");
  const [step, setStep] = useState(0);
  const [confirmed, setConfirmed] = useState(false);
  const [activeTab, setActiveTab] = useState<ProfileTab>("overview");
  const stepHeading = useRef<HTMLHeadingElement>(null);
  const errorRef = useRef<HTMLDivElement>(null);
  const fileInput = useRef<HTMLInputElement>(null);
  const dirty = Boolean(saved && draft && JSON.stringify(draft) !== JSON.stringify(draftOf(saved)));
  const translateError = useCallback((code: string) => t("career.errors." + code, { defaultValue: t("career.errors.UNAVAILABLE") }), [t]);
  const load = useCallback(async () => {
    setLoading(true); setError("");
    try {
      const response = await fetch("/api/career-profile", { cache: "no-store" });
      if (response.status === 401) { router.replace("/login"); return; }
      const data = await response.json();
      if (!response.ok) throw new Error(data.error || "UNAVAILABLE");
      setSaved(data); setDraft(draftOf(data)); setImportReady(data.resumeSource === "UPLOAD");
    } catch (error) { setError(translateError(error instanceof Error ? error.message : "UNAVAILABLE")); }
    finally { setLoading(false); }
  }, [router, translateError]);
  // A language switch must not reload and discard an edited draft.
  const initialLoad = useRef(load);
  useEffect(() => { void initialLoad.current(); }, []);
  useEffect(() => {
    if (!dirty) return;
    const warn = (event: BeforeUnloadEvent) => { event.preventDefault(); };
    window.addEventListener("beforeunload", warn);
    return () => window.removeEventListener("beforeunload", warn);
  }, [dirty]);
  useEffect(() => { if (error) errorRef.current?.focus(); }, [error]);
  const update = (value: ProfileData) => { setDraft(value); setConfirmed(false); setMessage(""); };
  const set = <K extends keyof ProfileData>(key: K, value: ProfileData[K]) => { if (draft) update({ ...draft, [key]: value }); };
  const showIssues = (paths: string[]) => {
    setIssues(paths.map(path => path.replace(/^profile\./, "").split(".").map(part => /^\d+$/.test(part) ? String(Number(part) + 1) : t("career.fields." + part, { defaultValue: t("career.sections." + part, { defaultValue: part }) })).join(" / ")));
    setError(translateError("VALIDATION"));
  };
  const changeStep = (value: number) => { setError(""); setIssues([]); setStep(value); requestAnimationFrame(() => stepHeading.current?.focus()); };
  const next = () => {
    if (!draft) return;
    const required = step === 0 ? ["resumeSource"] : step === 1 ? ["targetMarket"] : step === 2 ? ["careerGoal"] : step === 3 ? ["experienceLevel"] : step === 4 ? ["targetJobTitle", "targetIndustry", "targetCountry", "preferredWorkMode"] : [];
    const missing = required.filter(key => !String(draft[key as keyof ProfileData] || "").trim());
    if (missing.length) { showIssues(missing); return; }
    if (step === 0 && draft.resumeSource === "UPLOAD" && !importReady) { setError(translateError("UPLOAD_REQUIRED")); return; }
    changeStep(step + 1);
  };
  const importResume = async (file?: File) => {
    if (!file || !draft) return;
    setError(""); setIssues([]); setImporting(true); setMessage("");
    try {
      if (file.size > 8 * 1024 * 1024) throw new Error("TOO_LARGE");
      if (!/\.(pdf|docx|txt)$/i.test(file.name)) throw new Error("INVALID_TYPE");
      const form = new FormData(); form.append("resume", file);
      const response = await fetch("/api/career-profile/import", { method: "POST", body: form });
      const data = await response.json();
      if (response.status === 401) { router.replace("/login"); return; }
      if (!response.ok) throw new Error(data.error || "AI_FAILED");
      // Preserve unsaved local edits. The server proposal is safe for a clean
      // draft; both paths use the same deterministic conflict-aware merge.
      const proposed = dirty ? mergeExtractedProfile(draft, data.extracted) : data.proposal;
      update({ ...proposed, resumeSource: "UPLOAD" });
      setImportReview(data.review);
      setImported(true); setImportReady(true); setMessage(t("career.imported"));
      if (onboarding) changeStep(1);
      else setActiveTab("overview");
    } catch (error) { setError(translateError(error instanceof Error ? error.message : "AI_FAILED")); }
    finally { setImporting(false); if (fileInput.current) fileInput.current.value = ""; }
  };
  const save = async () => {
    if (!draft || !saved) return;
    const body = { profile: draft, revision: saved.revision, completeOnboarding: onboarding, confirmed: true };
    const parsed = saveProfileSchema.safeParse(body);
    if (!parsed.success) { showIssues(parsed.error.issues.map(issue => issue.path.join("."))); return; }
    if ((onboarding || imported) && !confirmed) { setError(translateError("CONFIRM_REQUIRED")); return; }
    setBusy(true); setError(""); setIssues([]); setMessage("");
    try {
      const response = await fetch("/api/career-profile", { method: "PUT", headers: { "Content-Type": "application/json" }, body: JSON.stringify(parsed.data) });
      const data = await response.json();
      if (response.status === 401) { router.replace("/login"); return; }
      if (!response.ok) {
        if (data.issues) { showIssues(data.issues.map((issue: { path: string }) => issue.path)); return; }
        throw new Error(data.error || "UNAVAILABLE");
      }
      setSaved(data); setDraft(draftOf(data)); setImported(false); setImportReview(null); setConfirmed(false); setMessage(t("career.saved"));
      if (session?.id) void dispatch(fetchUser(session.id));
      if (onboarding) router.replace("/dashboard/profile");
    } catch (error) { setError(translateError(error instanceof Error ? error.message : "UNAVAILABLE")); }
    finally { setBusy(false); }
  };

  if (loading) return <div className="mx-auto max-w-5xl space-y-6" aria-busy="true" aria-label={t("career.loading")}><Skeleton className="h-12 w-64" /><Skeleton className="h-96 w-full" /></div>;
  if (!draft || !saved) return <div className="app-section space-y-4"><h1 className="type-h1">{t("career.title")}</h1><p role="alert">{error}</p><Button onClick={load}>{t("career.retry")}</Button></div>;
  const completeness = profileCompleteness(draft);
  const review = !onboarding || step === 5;

  // The dashboard uses compact tabs. Onboarding retains its own guided wizard.
  if (!onboarding) {
    const french = i18n.resolvedLanguage?.startsWith("fr") || false;

    return (
      <div className="mx-auto max-w-5xl space-y-5 pb-12">
        <header className="flex flex-wrap items-center justify-between gap-3">
          <div>
            <h1 className="text-2xl font-semibold tracking-tight">
              {t("career.title")}
            </h1>
            <p className="mt-1 text-sm text-muted-foreground">
              {draft.name || draft.headline || t("career.subtitle")}
            </p>
          </div>

          <input
            ref={fileInput}
            type="file"
            className="sr-only"
            accept=".pdf,.docx,.txt"
            aria-label={t("career.uploadLabel")}
            onChange={(event) => void importResume(event.target.files?.[0])}
            disabled={busy || importing}
          />
          <Button
            size="sm"
            variant="outline"
            disabled={busy || importing}
            onClick={() => fileInput.current?.click()}
          >
            <UploadCloud className="size-4" />
            {importing ? t("career.importing") : t("career.uploadLabel")}
          </Button>
        </header>

        {!saved.onboardingCompletedAt && (
          <div className="flex flex-wrap items-center justify-between gap-2 rounded-lg border p-3">
            <span className="text-sm">{t("career.onboardingPrompt")}</span>
            <Button asChild variant="outline" size="sm">
              <Link href="/onboarding">{t("career.startOnboarding")}</Link>
            </Button>
          </div>
        )}

        <div className="flex items-center gap-3 text-xs text-muted-foreground">
          <ProgressBar
            value={completeness.percentage}
            label={t("career.completeness")}
            className="flex-1"
          />
          <span className="shrink-0 font-medium">
            {completeness.percentage}%
          </span>
        </div>

        {error && (
          <div
            ref={errorRef}
            tabIndex={-1}
            role="alert"
            className="rounded-lg border border-destructive/30 p-3 text-sm text-destructive"
          >
            {error}
            {issues.length > 0 && (
              <ul className="mt-2 list-inside list-disc">
                {issues.map((issue, index) => <li key={index}>{issue}</li>)}
              </ul>
            )}
          </div>
        )}
        {message && (
          <p role="status" className="rounded-lg border p-3 text-sm">
            {message}
          </p>
        )}

        {importReview && (
          <div role="status" className="rounded-lg border bg-muted/20 p-3 text-xs leading-5">
            <p className="font-medium">{french ? "Import IA — vérifie avant d’enregistrer" : "AI import — review before saving"}</p>
            <p className="text-muted-foreground">
              {importReview.addedFields.length} {french ? "champs proposés" : "suggested fields"} ·
              {Object.values(importReview.addedRecords).reduce((sum, count) => sum + (count || 0), 0)} {french ? "éléments ajoutés" : "records added"} ·
              {importReview.conflicts.length} {french ? "conflits à vérifier" : "conflicts to review"}
            </p>
            {importReview.conflicts.length > 0 && (
              <p className="mt-1 text-muted-foreground">
                {french ? "Valeurs existantes conservées : " : "Existing values preserved: "}
                {[...new Set(importReview.conflicts.map(item => item.field))].join(", ")}
              </p>
            )}
            {importReview.evidenceMode === "native_pdf_review" && (
              <p className="mt-1 text-muted-foreground">{french ? "PDF scanné : vérifie soigneusement les informations extraites." : "Scanned PDF: carefully review extracted facts."}</p>
            )}
            {Boolean(importReview.unverifiedFields?.length) && (
              <p className="mt-1 text-muted-foreground">{french ? "Informations non vérifiées omises : " : "Unverified facts omitted: "}{importReview.unverifiedFields?.join(", ")}</p>
            )}
            {Object.values(importReview.incompleteRecords).some(Boolean) && (
              <p className="mt-1 text-muted-foreground">
                {french ? "Certains éléments incomplets ne sont pas ajoutés automatiquement." : "Incomplete records were not added automatically."}
              </p>
            )}
          </div>
        )}

        <div
          role="tablist"
          aria-label={t("career.sectionNavigation")}
          className="flex gap-1 overflow-x-auto border-b pb-px"
        >
          {profileTabs.map((tab) => (
            <button
              key={tab.id}
              id={`profile-tab-${tab.id}`}
              type="button"
              role="tab"
              aria-selected={activeTab === tab.id}
              aria-controls="profile-active-panel"
              tabIndex={activeTab === tab.id ? 0 : -1}
              onClick={() => setActiveTab(tab.id)}
              onKeyDown={(event) => {
                if (event.key !== "ArrowRight" && event.key !== "ArrowLeft") return;
                event.preventDefault();
                const index = profileTabs.findIndex((entry) => entry.id === activeTab);
                const direction = event.key === "ArrowRight" ? 1 : -1;
                const next = profileTabs[(index + direction + profileTabs.length) % profileTabs.length];
                setActiveTab(next.id);
                document.getElementById(`profile-tab-${next.id}`)?.focus();
              }}
              className={
                "shrink-0 border-b-2 px-3 py-2.5 text-sm font-medium transition " +
                (activeTab === tab.id
                  ? "border-primary text-foreground"
                  : "border-transparent text-muted-foreground hover:text-foreground")
              }
            >
              {french ? tab.fr : tab.en}
            </button>
          ))}
        </div>

        <fieldset disabled={busy || importing} className="min-w-0">
          <div
            id="profile-active-panel"
            role="tabpanel"
            aria-labelledby={`profile-tab-${activeTab}`}
            className="min-w-0 rounded-xl border bg-card p-4 sm:p-6"
          >
            <ProfileFields
              profile={draft}
              update={update}
              activeTab={activeTab}
            />
          </div>

          {imported && (
            <label className="mt-3 flex items-center gap-2 text-sm">
              <input
                type="checkbox"
                checked={confirmed}
                onChange={(event) => setConfirmed(event.target.checked)}
                className="size-4 accent-primary"
              />
              {t("career.confirm")}
            </label>
          )}
        </fieldset>

        <div className="sticky bottom-3 z-20 flex items-center justify-between gap-3 rounded-lg border bg-card p-3 shadow-sm">
          <span role="status" className="text-xs text-muted-foreground">
            {t(dirty ? "career.unsaved" : "career.upToDate")}
          </span>
          <div className="flex gap-2">
            {dirty && (
              <Button
                size="sm"
                variant="outline"
                disabled={busy || importing}
                onClick={() => {
                  setDraft(draftOf(saved));
                  setImported(false);
                  setImportReview(null);
                  setConfirmed(false);
                  setError("");
                  setIssues([]);
                  setMessage("");
                }}
              >
                {t("career.cancel")}
              </Button>
            )}
            <Button
              size="sm"
              disabled={busy || importing || !dirty || (imported && !confirmed)}
              onClick={save}
            >
              <Save className="size-4" />
              {t(busy ? "career.saving" : "career.save")}
            </Button>
          </div>
        </div>
      </div>
    );
  }
  const upload = <div className="space-y-4">
    <div className="relative overflow-hidden rounded-2xl border border-dashed border-primary/35 bg-gradient-to-br from-primary/[0.07] via-background to-background p-7 transition hover:border-primary/60 sm:p-9">
      <input ref={fileInput} id="resume-file" type="file" accept=".pdf,.docx,.txt,application/pdf,application/vnd.openxmlformats-officedocument.wordprocessingml.document,text/plain" disabled={busy || importing} onChange={e => void importResume(e.target.files?.[0])} className="absolute inset-0 h-full w-full cursor-pointer opacity-0" />
      <div className="pointer-events-none flex flex-col items-center text-center">
        <span className="mb-4 grid size-12 place-items-center rounded-xl border bg-background shadow-sm"><UploadCloud className="size-5 text-primary" /></span>
        <p className="text-base font-semibold">{importing ? t("career.importing") : t("career.uploadLabel")}</p>
        <p className="mt-2 max-w-xl text-sm leading-6 text-muted-foreground">PDF, DOCX or TXT · 8 MB max. CVcomet AI extracts your experience, education, skills, projects, certifications and professional links.</p>
        <span className="mt-4 rounded-full border bg-background px-3 py-1 text-xs font-medium text-muted-foreground">{importReady ? "Resume imported — choose another file to replace/merge" : "Drop a resume here or click to browse"}</span>
      </div>
    </div>
    <div className="grid gap-3 sm:grid-cols-3">
      <div className="rounded-xl border bg-card p-4"><Sparkles className="mb-2 size-4 text-primary"/><p className="text-sm font-medium">AI extraction</p><p className="mt-1 text-xs leading-5 text-muted-foreground">Structured parsing without inventing qualifications.</p></div>
      <div className="rounded-xl border bg-card p-4"><FileText className="mb-2 size-4 text-primary"/><p className="text-sm font-medium">Profile ready to edit</p><p className="mt-1 text-xs leading-5 text-muted-foreground">Your career profile is pre-filled, then you stay in control.</p></div>
      <div className="rounded-xl border bg-card p-4"><ShieldCheck className="mb-2 size-4 text-primary"/><p className="text-sm font-medium">Facts preserved</p><p className="mt-1 text-xs leading-5 text-muted-foreground">Unknown information remains empty instead of being fabricated.</p></div>
    </div>
  </div>;
  return <div className="mx-auto max-w-6xl space-y-6">
    <PageHeader title={t(onboarding ? "career.onboardingTitle" : "career.title")} description={t("career.subtitle")} />
    {onboarding && <ol className="grid grid-cols-3 gap-2 sm:grid-cols-6" aria-label={t("career.stepsLabel")}>{steps.map((key, index) => <li key={key} aria-current={step === index ? "step" : undefined} className={"min-w-0 rounded-lg border p-2 text-center text-xs sm:p-3 " + (step === index ? "border-primary bg-primary/5 font-semibold" : "text-muted-foreground")}><span className="mb-1 block">{index < step ? <Check className="mx-auto size-4" aria-label={t("career.done")} /> : index + 1}</span><span className="break-words">{t("career.steps." + key)}</span></li>)}</ol>}
    <div className="app-section space-y-3">
      <div className="flex flex-wrap justify-between gap-2 text-sm"><span>{t("career.completeness")}</span><strong>{completeness.percentage}%</strong></div>
      <ProgressBar value={completeness.percentage} label={t("career.completeness")} />
      <p className="text-xs text-muted-foreground">{t("career.completenessHint", { completed: completeness.completed, total: completeness.total })}{dirty && " " + t("career.draftScore")}</p>
      <ul className="flex flex-wrap gap-x-4 gap-y-1 text-xs">{Object.entries(completeness.sections).map(([key, complete]) => <li key={key}>{complete ? "\u2713 " : "\u25cb "}{t("career.sections." + key)}</li>)}</ul>
    </div>
    {error && <div ref={errorRef} tabIndex={-1} role="alert" className="rounded-lg border border-destructive/30 bg-destructive/5 p-4 text-sm text-destructive"><p>{error}</p>{issues.length > 0 && <ul className="mt-2 list-inside list-disc">{issues.map((issue, index) => <li key={index}>{issue}</li>)}</ul>}</div>}
    {message && <p role="status" className="rounded-lg bg-primary/5 p-4 text-sm">{message}</p>}
    {importReview && (
      <div role="status" className="rounded-lg border bg-muted/20 p-3 text-xs leading-5">
        <p className="font-medium">AI import — review the suggested facts before saving.</p>
        <p className="text-muted-foreground">{importReview.conflicts.length} conflicts ·
          {Object.values(importReview.addedRecords).reduce((sum, count) => sum + (count || 0), 0)} new records</p>
        {importReview.conflicts.length > 0 && <p className="text-muted-foreground">Existing values retained: {[...new Set(importReview.conflicts.map(item => item.field))].join(", ")}</p>}
        {importReview.unverifiedFields?.length ? <p className="text-muted-foreground">Unverified facts omitted: {importReview.unverifiedFields.join(", ")}</p> : null}
        {importReview.evidenceMode === "native_pdf_review" ? <p className="text-muted-foreground">Scanned PDF: please review extracted facts.</p> : null}
      </div>
    )}

    <fieldset disabled={busy || importing} className="min-w-0 space-y-6">
      {onboarding && !review && <section className="app-section space-y-6">
        <h2 ref={stepHeading} tabIndex={-1} className="type-h2">{t("career.steps." + steps[step])}</h2>
        {step > 1 && step < 5 && <TargetFields profile={draft} set={set} part={step === 2 ? "goal" : step === 3 ? "level" : "job"} />}
        {step === 1 && <div className="space-y-7">
          <div><p className="text-sm font-medium">Where are you applying?</p><p className="mt-1 text-sm text-muted-foreground">Choose the hiring market for this application. You can change it later for each resume.</p></div>
          <div className="grid gap-3 md:grid-cols-2">{resumeMarkets.map(id => { const market = marketProfiles[id]; const active = draft.targetMarket === id; return <button type="button" key={id} onClick={() => set("targetMarket", id)} className={"group rounded-2xl border p-5 text-left transition hover:-translate-y-0.5 hover:shadow-md " + (active ? "border-primary bg-primary/[0.06] ring-1 ring-primary/20" : "bg-card")}>
            <div className="flex items-start justify-between gap-4"><span className="grid size-10 place-items-center rounded-xl bg-primary/10 text-primary"><Globe2 className="size-5"/></span>{active && <span className="rounded-full bg-primary px-2.5 py-1 text-[10px] font-semibold text-primary-foreground">Selected</span>}</div>
            <h3 className="mt-4 text-base font-semibold">{market.label}</h3><p className="mt-1 text-sm leading-6 text-muted-foreground">{market.description}</p><div className="mt-4 flex items-center gap-2 text-xs font-medium text-primary">{market.documentName} + Cover Letter <ChevronRight className="size-3.5"/></div>
          </button>})}</div>
          <div className="rounded-2xl border bg-muted/30 p-5"><p className="text-sm font-medium">How did you hear about CVcomet? <span className="font-normal text-muted-foreground">Optional</span></p><div className="mt-3 flex flex-wrap gap-2">{referralSources.map(source => <button type="button" key={source} onClick={() => set("referralSource", source)} className={"rounded-full border px-3 py-2 text-xs font-medium transition " + (draft.referralSource === source ? "border-primary bg-primary text-primary-foreground" : "bg-background hover:border-primary/40")}>{source.replaceAll("_", " ").toLowerCase().replace(/^./, c => c.toUpperCase())}</button>)}</div></div>
        </div>}
        {step === 0 && <div className="space-y-6">
          <div className="grid gap-3 sm:grid-cols-2">{(["UPLOAD", "SCRATCH"] as const).map(source => <label key={source} className={"flex cursor-pointer items-center gap-3 rounded-lg border p-5 " + (draft.resumeSource === source ? "border-primary bg-primary/5" : "")}><input type="radio" name="resumeSource" value={source} checked={draft.resumeSource === source} onChange={() => set("resumeSource", source)} /><span>{t("career.options." + source)}</span></label>)}</div>
          {draft.resumeSource === "UPLOAD" && upload}
          {draft.resumeSource === "SCRATCH" && <p className="text-sm text-muted-foreground">{t("career.scratchHint")}</p>}
        </div>}
      </section>}
      {review && <>
        <div className="app-section space-y-4"><h2 ref={stepHeading} tabIndex={-1} className="type-h2">{t(onboarding || imported ? "career.reviewTitle" : "career.importTitle")}</h2><p className="text-sm text-muted-foreground">{t("career.reviewHint")}</p>{upload}</div>
        <ProfileFields profile={draft} update={update} />
        {(onboarding || imported) && <label className="flex items-start gap-3 rounded-lg border p-5 text-sm"><input type="checkbox" checked={confirmed} onChange={e => setConfirmed(e.target.checked)} className="mt-1" /><span>{t("career.confirm")}</span></label>}
      </>}
    </fieldset>
    <div className="sticky bottom-3 z-10 flex flex-wrap items-center justify-between gap-3 rounded-xl border bg-card p-4 shadow-lg">
      <span role="status" className="text-xs text-muted-foreground">{t(dirty ? "career.unsaved" : "career.upToDate")}</span>
      <div className="flex flex-wrap gap-2">
        {onboarding && step > 0 && <Button variant="outline" disabled={busy || importing} onClick={() => changeStep(step - 1)}><ChevronLeft className="size-4" />{t("career.back")}</Button>}
        {!onboarding && dirty && <Button variant="outline" disabled={busy || importing} onClick={() => { setDraft(draftOf(saved)); setImported(false); setError(""); setIssues([]); setMessage(""); }}>{t("career.cancel")}</Button>}
        {review ? <Button disabled={busy || importing || ((!dirty && !onboarding)) || ((onboarding || imported) && !confirmed)} onClick={save}><Save className="size-4" />{t(busy ? "career.saving" : onboarding ? "career.finish" : "career.save")}</Button> : <Button disabled={busy || importing} onClick={next}>{t("career.next")}<ChevronRight className="size-4" /></Button>}
      </div>
    </div>
  </div>;
}
