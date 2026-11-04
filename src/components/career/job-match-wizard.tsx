"use client";
import { translateCentral } from "@/lib/i18n/central-copy";

import { useLayoutEffect, useRef, useState } from "react";
import Link from "next/link";
import { useTranslation } from "react-i18next";
import {
  ArrowLeft,
  ArrowRight,
  Check,
  Eye,
  FileText,
  FileUp,
  Link2,
  LoaderCircle,
  Sparkles,
  UserRound,
} from "lucide-react";

import { AtsResumePreview, type AtsResumeRecord } from "@/components/resumes/ats-resume-preview";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import {
  jobRequest,
  type useJobAnalysisForm,
} from "@/components/career/job-analysis-form";
import { MAX_JOB_TEXT, MIN_JOB_TEXT, type JobSource } from "@/lib/career/job-schema";

type WizardForm = ReturnType<typeof useJobAnalysisForm>;

type Props = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  form: WizardForm;
  errorText: string;
};

export function JobMatchWizard({ open, onOpenChange, form, errorText }: Props) {
  const { i18n } = useTranslation();
  const fr = i18n.resolvedLanguage?.startsWith("fr") ?? false;
  const language = fr ? "fr" : "en";
  const [step, setStep] = useState<1 | 2>(1);
  const [preview, setPreview] = useState<AtsResumeRecord | null>(null);
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  const {
    c,
    resumes,
    mode,
    setMode,
    url,
    setUrl,
    text,
    setSource,
    confirmed,
    setConfirmed,
    cvId,
    setCvId,
    busy,
    setError,
    error,
    act,
    extract,
    ready,
    analyze,
    changeText,
  } = form;

  // Keep the field 50px high when empty, and grow it with the content.
  // A maximum height prevents the modal from overflowing the viewport.
  useLayoutEffect(() => {
    if (!open || step !== 1 || preview) return;
    const field = textareaRef.current;
    if (!field) return;
    field.style.height = "50px";
    field.style.height = `${Math.min(360, Math.max(50, field.scrollHeight))}px`;
  }, [text, open, step, preview]);

  const canContinue =
    text.trim().length >= MIN_JOB_TEXT &&
    text.length <= MAX_JOB_TEXT &&
    !busy;

  const close = (nextOpen: boolean) => {
    if (!nextOpen && busy) return;
    if (!nextOpen) {
      setStep(1);
      setPreview(null);
    }
    onOpenChange(nextOpen);
  };

  const selectMode = (next: JobSource["type"]) => {
    setMode(next);
    setError("");
    setConfirmed(false);
    if (next === "TEXT") setSource({ type: "TEXT" });
  };

  const createResume = () => {
    void act("create-cv", async () => {
      const cv = await jobRequest<{ id: string }>("/api/cvs", {
        source: "PROFILE",
      });
      await resumes.reload();
      setCvId(cv.id);
    });
  };

  return (
    <Dialog open={open} onOpenChange={close}>
      <DialogContent
        className="w-[calc(100%-1.5rem)] max-w-[800px] gap-0 overflow-hidden p-0 sm:max-w-[800px]"
        onEscapeKeyDown={(event) => {
          if (busy) event.preventDefault();
        }}
        onInteractOutside={(event) => {
          if (busy) event.preventDefault();
        }}
      >
        <DialogHeader className="px-5 pt-5 pb-2 pr-12">
          <DialogTitle>
            {preview
              ? translateCentral(fr ? "fr" : "en", "uiText.components_career_job_match_wizard.text001")
              : c.title}
          </DialogTitle>
          <DialogDescription className="sr-only">
            {preview
              ? translateCentral(fr ? "fr" : "en", "uiText.components_career_job_match_wizard.text002")
              : translateCentral(fr ? "fr" : "en", "uiText.components_career_job_match_wizard.text003")}
          </DialogDescription>
        </DialogHeader>

        {preview ? (
          <div className="min-w-0 space-y-3 p-4 sm:p-5">
            <AtsResumePreview
              key={preview.id}
              record={preview}
              large
              language={language}
            />
            <DialogFooter>
              <Button
                variant="outline"
                type="button"
                onClick={() => setPreview(null)}
              >
                <ArrowLeft className="size-4" />
                {translateCentral(fr ? "fr" : "en", "uiText.components_career_job_match_wizard.text004")}
              </Button>
              <Button
                type="button"
                onClick={() => {
                  setCvId(preview.id);
                  setPreview(null);
                }}
              >
                <Check className="size-4" />
                {translateCentral(fr ? "fr" : "en", "uiText.components_career_job_match_wizard.text005")}
              </Button>
            </DialogFooter>
          </div>
        ) : (
          <>
            <div className="max-h-[min(65dvh,650px)] min-w-0 overflow-y-auto px-5 py-4">
              {error && (
                <p role="alert" className="mb-4 rounded-lg border border-destructive/30 bg-destructive/5 p-3 text-sm text-destructive">
                  {errorText}
                </p>
              )}
              {busy && (
                <p role="status" aria-live="polite" className="mb-4 flex items-center gap-2 text-sm text-muted-foreground">
                  <LoaderCircle className="size-4 animate-spin" />
                  {busy === "extract" ? c.extracting : busy === "analyze" ? c.analyzing : c.working}
                </p>
              )}

              {step === 1 ? (
                <div className="space-y-4">
                  <div className="flex flex-wrap gap-1" role="group" aria-label={translateCentral(fr ? "fr" : "en", "uiText.components_career_job_match_wizard.text006")}>
                    {([
                      { key: "TEXT", label: "Text", icon: FileText },
                      { key: "URL", label: "URL", icon: Link2 },
                      { key: "PDF", label: "PDF", icon: FileUp },
                    ] as const).map(({ key, label, icon: Icon }) => (
                      <Button
                        key={key}
                        type="button"
                        size="sm"
                        className="gap-1.5 px-3 text-xs"
                        variant={mode === key ? "secondary" : "ghost"}
                        aria-label={label}
                        title={label}
                        aria-pressed={mode === key}
                        disabled={!!busy}
                        onClick={() => selectMode(key)}
                      >
                        <Icon className="size-4" />
                        <span>{label}</span>
                      </Button>
                    ))}
                  </div>

                  {mode === "URL" && (
                    <div className="space-y-2">
                      <label htmlFor="wizard-job-url" className="text-sm font-medium">
                        {c.urlLabel}
                      </label>
                      <div className="flex flex-col gap-2 sm:flex-row">
                        <Input
                          id="wizard-job-url"
                          type="url"
                          value={url}
                          disabled={!!busy}
                          placeholder="https://careers.company.com/jobs/role"
                          onChange={(event) => setUrl(event.target.value)}
                        />
                        <Button
                          type="button"
                          variant="outline"
                          disabled={!!busy || !/^https?:\/\//i.test(url)}
                          onClick={() => void extract()}
                        >
                          {c.extract}
                        </Button>
                      </div>
                    </div>
                  )}

                  {mode === "PDF" && (
                    <div
                      className="rounded-lg border border-dashed p-4"
                      onDragOver={(event) => event.preventDefault()}
                      onDrop={(event) => {
                        event.preventDefault();
                        const file = event.dataTransfer.files[0];
                        if (file && !busy) void extract(file);
                      }}
                    >
                      <label htmlFor="wizard-job-file" className="text-sm font-medium">
                        {c.file}
                      </label>
                      <input
                        id="wizard-job-file"
                        type="file"
                        accept="application/pdf,.pdf,application/vnd.openxmlformats-officedocument.wordprocessingml.document,.docx,text/plain,.txt"
                        disabled={!!busy}
                        className="max-w-full text-sm"
                        onChange={(event) => {
                          const file = event.target.files?.[0];
                          if (file) void extract(file);
                          event.target.value = "";
                        }}
                      />
                    </div>
                  )}

                  <div>
                    <label htmlFor="wizard-job-text" className="text-sm font-medium">
                      {c.review}
                    </label>
                    <textarea
                      id="wizard-job-text"
                      ref={textareaRef}
                      value={text}
                      disabled={!!busy}
                      maxLength={MAX_JOB_TEXT}
                      rows={2}
                      className="mt-2 block min-h-[50px] w-full resize-none overflow-y-auto rounded-md border border-input bg-card px-3 py-2.5 text-sm text-foreground outline-none transition-colors placeholder:text-muted-foreground focus-visible:border-ring focus-visible:ring-2 focus-visible:ring-ring/25 disabled:opacity-50"
                      style={{ height: 50 }}
                      onChange={(event) => changeText(event.target.value)}
                    />
                  </div>
                </div>
              ) : (
                <div className="space-y-4">
                  <h3 className="text-sm font-semibold">{c.resume}</h3>

                  <button
                    type="button"
                    disabled={!!busy}
                    aria-pressed={!cvId}
                    className={`flex w-full items-center gap-3 rounded-lg border p-3 text-left text-sm transition-colors hover:border-primary/50 ${!cvId ? "border-primary ring-1 ring-primary/25" : "border-border"}`}
                    onClick={() => setCvId("")}
                  >
                    <UserRound className="size-5 shrink-0 text-muted-foreground" />
                    <span className="flex-1">{c.profileOnly}</span>
                    {!cvId && <Check className="size-4 text-primary" />}
                  </button>

                  {resumes.loading && (
                    <p role="status" className="text-sm text-muted-foreground">
                      {c.loading}
                    </p>
                  )}
                  {resumes.error && (
                    <div role="alert" className="flex items-center gap-2 text-sm text-destructive">
                      {c.genericError}
                      <Button size="sm" variant="outline" onClick={() => void resumes.reload()}>
                        {c.retry}
                      </Button>
                    </div>
                  )}

                  <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 md:grid-cols-4">
                    {resumes.data?.map((cv) => {
                      // /api/cvs?mine=1 returns the complete structured resume.
                      const record = cv as AtsResumeRecord;
                      const selected = cvId === cv.id;
                      const title = cv.design?.documentName || cv.title || c.resume;
                      return (
                        <div
                          key={cv.id}
                          className={`min-w-0 overflow-hidden rounded-lg border bg-card transition-colors ${selected ? "border-primary ring-1 ring-primary/30" : "border-border"}`}
                        >
                          <button
                            type="button"
                            aria-pressed={selected}
                            aria-label={`${translateCentral(fr ? "fr" : "en", "uiText.components_career_job_match_wizard.text007")} ${title}`}
                            disabled={!!busy}
                            className="relative block w-full overflow-hidden bg-muted/40 p-2 text-left hover:bg-muted/70"
                            onClick={() => setCvId(cv.id)}
                          >
                            <div className="mx-auto max-w-[125px] overflow-hidden bg-white shadow-sm">
                              <AtsResumePreview record={record} language={language} />
                            </div>
                            {selected && (
                              <span className="absolute right-2 top-2 rounded-full bg-primary p-1 text-primary-foreground">
                                <Check className="size-3" />
                              </span>
                            )}
                          </button>
                          <div className="flex items-center gap-1 border-t px-2 py-1.5">
                            <span className="min-w-0 flex-1 truncate text-xs" title={title}>
                              {title}
                            </span>
                            <button
                              type="button"
                              disabled={!!busy}
                              className="rounded p-1 text-muted-foreground hover:bg-muted hover:text-foreground"
                              aria-label={`${translateCentral(fr ? "fr" : "en", "uiText.components_career_job_match_wizard.text008")} ${title}`}
                              onClick={() => setPreview(record)}
                            >
                              <Eye className="size-4" />
                            </button>
                          </div>
                        </div>
                      );
                    })}
                  </div>

                  <Button
                    type="button"
                    size="sm"
                    variant="outline"
                    disabled={!!busy}
                    onClick={createResume}
                  >
                    <FileText className="size-4" />
                    {c.createResume}
                  </Button>

                  <label className="flex items-start gap-2 text-sm">
                    <input
                      type="checkbox"
                      className="mt-1"
                      checked={confirmed}
                      disabled={!!busy}
                      onChange={(event) => setConfirmed(event.target.checked)}
                    />
                    {c.confirm}
                  </label>
                </div>
              )}
            </div>

            <DialogFooter className="px-5 pb-5 pt-2">
              {step === 1 ? (
                <Button type="button" disabled={!canContinue} onClick={() => setStep(2)}>
                  {translateCentral(fr ? "fr" : "en", "uiText.components_career_job_match_wizard.text009")}
                  <ArrowRight className="size-4" />
                </Button>
              ) : (
                <>
                  <Button
                    type="button"
                    variant="outline"
                    disabled={!!busy}
                    onClick={() => setStep(1)}
                  >
                    <ArrowLeft className="size-4" />
                    {translateCentral(fr ? "fr" : "en", "uiText.components_career_job_match_wizard.text010")}
                  </Button>
                  <Button type="button" disabled={!ready} onClick={() => void analyze()}>
                    {busy === "analyze" ? (
                      <LoaderCircle className="size-4 animate-spin" />
                    ) : (
                      <Sparkles className="size-4" />
                    )}
                    {c.analyze}
                  </Button>
                </>
              )}
            </DialogFooter>
          </>
        )}
      </DialogContent>
    </Dialog>
  );
}
