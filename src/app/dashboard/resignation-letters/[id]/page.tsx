"use client";

import { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import { useParams } from "next/navigation";
import { useTranslation } from "react-i18next";
import { ArrowLeft, Download, LoaderCircle, Save } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";

type Letter = {
  id: string;
  title: string;
  recipient: string;
  company: string;
  subject: string;
  body: string;
  signature: string;
  letterDate: string;
  revision: number;
};

type EditableField =
  | "title"
  | "recipient"
  | "company"
  | "subject"
  | "body"
  | "signature"
  | "letterDate";

const fields = [
  "title",
  "recipient",
  "company",
  "subject",
  "signature",
] as const;

function textOf(letter: Letter) {
  return [
    letter.letterDate.slice(0, 10),
    letter.recipient,
    letter.company,
    "",
    letter.subject,
    "",
    letter.body,
    "",
    letter.signature,
  ].filter((line, index) => line !== "" || index === 3).join("\n");
}

export default function ResignationLetterEditor() {
  const params = useParams<{ id: string }>();
  const { t } = useTranslation();
  const [letter, setLetter] = useState<Letter | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [dirty, setDirty] = useState(false);
  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");

  useEffect(() => {
    let alive = true;
    void fetch(`/api/resignation-letters/${encodeURIComponent(params.id)}`, {
      cache: "no-store",
    })
      .then(async (response) => {
        if (!response.ok) throw new Error("openFailed");
        return response.json() as Promise<Letter>;
      })
      .then((data) => { if (alive) setLetter(data); })
      .catch((cause) => {
        if (alive) setError(cause instanceof Error ? cause.message : "loadFailed");
      })
      .finally(() => { if (alive) setLoading(false); });
    return () => { alive = false; };
  }, [params.id]);

  const update = useCallback((field: EditableField, value: string) => {
    setLetter((previous) => previous ? { ...previous, [field]: value } : previous);
    setDirty(true);
    setSuccess("");
  }, []);

  const save = async () => {
    if (!letter || saving || !dirty) return;
    setSaving(true);
    setError("");
    try {
      const response = await fetch(
        `/api/resignation-letters/${encodeURIComponent(letter.id)}`,
        {
          method: "PATCH",
          headers: { "content-type": "application/json" },
          body: JSON.stringify({
            title: letter.title,
            recipient: letter.recipient,
            company: letter.company,
            subject: letter.subject,
            body: letter.body,
            signature: letter.signature,
            letterDate: letter.letterDate,
            revision: letter.revision,
          }),
        },
      );
      if (!response.ok) {
        const data = await response.json().catch(() => ({}));
        throw new Error(data.error === "CONFLICT_OR_NOT_FOUND"
          ? "conflict"
          : "saveFailed");
      }
      setLetter(await response.json() as Letter);
      setDirty(false);
      setSuccess("saved");
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "saveFailed");
    } finally {
      setSaving(false);
    }
  };

  const download = () => {
    if (!letter) return;
    const blob = new Blob([textOf(letter)], { type: "text/plain;charset=utf-8" });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url;
    link.download = `${letter.title.replace(/[^a-z0-9_-]+/gi, "-").slice(0, 80) || "resignation-letter"}.txt`;
    link.click();
    URL.revokeObjectURL(url);
  };

  return (
    <main className="mx-auto max-w-5xl space-y-5 pb-12">
      <Link
        href="/dashboard/resumes?tab=resignations"
        className="inline-flex items-center gap-2 text-sm text-muted-foreground hover:text-foreground"
      >
        <ArrowLeft className="size-4" /> {t("resignation.documents")}
      </Link>
      {loading ? (
        <div role="status" className="flex items-center gap-2 text-sm">
          <LoaderCircle className="size-4 animate-spin" /> {t("resignation.loading")}
        </div>
      ) : !letter ? (
        <p role="alert" className="text-sm text-destructive">{t(`resignation.${error || "notFound"}`)}</p>
      ) : (
        <>
          <header className="flex flex-wrap items-center justify-between gap-3">
            <div>
              <h1 className="text-xl font-semibold">{t("resignation.title")}</h1>
              <p className="text-xs text-muted-foreground">
                {t(dirty ? "resignation.unsaved" : "resignation.allSaved")}
              </p>
            </div>
            <div className="flex items-center gap-2">
              <Button variant="outline" size="sm" onClick={download}>
                <Download className="size-4" /> {t("resignation.download")}
              </Button>
              <Button size="sm" onClick={() => void save()} disabled={!dirty || saving}>
                {saving ? <LoaderCircle className="size-4 animate-spin" /> : <Save className="size-4" />}
                {t("resignation.save")}
              </Button>
            </div>
          </header>
          {error && <p role="alert" className="text-sm text-destructive">{t(`resignation.${error}`)}</p>}
          {success && <p role="status" className="text-xs text-primary">{t(`resignation.${success}`)}</p>}
          <div className="grid gap-5 lg:grid-cols-[minmax(0,1fr)_minmax(0,0.95fr)]">
            <section className="space-y-4 rounded-xl border bg-card p-5">
              {fields.map((field) => (
                <label key={field} className="block space-y-1.5 text-xs font-medium">
                  <span>{t(`resignation.fields.${field}`)}</span>
                  <Input
                    className="h-9"
                    disabled={saving}
                    value={letter[field]}
                    onChange={(event) => update(field, event.target.value)}
                    maxLength={field === "title" ? 160 : 250}
                  />
                </label>
              ))}
              <label className="block space-y-1.5 text-xs font-medium">
                <span>{t("resignation.date")}</span>
                <Input
                  type="date"
                  className="h-9"
                  disabled={saving}
                  value={letter.letterDate.slice(0, 10)}
                  onChange={(event) => update("letterDate", `${event.target.value}T12:00:00.000Z`)}
                />
              </label>
              <label className="block space-y-1.5 text-xs font-medium">
                <span>{t("resignation.content")}</span>
                <Textarea
                  value={letter.body}
                  className="min-h-32 resize-y"
                  disabled={saving}
                  rows={7}
                  maxLength={20000}
                  onChange={(event) => update("body", event.target.value)}
                  placeholder={t("resignation.placeholder")}
                />
              </label>
            </section>
            <section className="rounded-xl border bg-muted/30 p-4" aria-label={t("resignation.preview")}>
              <div className="mx-auto min-h-[480px] w-full max-w-[380px] rounded-sm bg-white p-8 text-xs leading-6 text-slate-900 shadow-sm">
                <p className="mb-6 text-right">{letter.letterDate.slice(0, 10)}</p>
                <p className="whitespace-pre-wrap">{[letter.recipient, letter.company].filter(Boolean).join("\n")}</p>
                <p className="my-6 font-semibold">{letter.subject}</p>
                <p className="whitespace-pre-wrap break-words">{letter.body}</p>
                <p className="mt-8 whitespace-pre-wrap">{letter.signature}</p>
              </div>
            </section>
          </div>
        </>
      )}
    </main>
  );
}
