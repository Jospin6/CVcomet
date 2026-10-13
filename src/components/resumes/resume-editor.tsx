"use client";

import { useEffect, useState } from "react";
import { useParams } from "next/navigation";
import Link from "next/link";
import { useTranslation } from "react-i18next";
import { useDispatch, useSelector } from "react-redux";
import { ArrowLeft, Save } from "lucide-react";
import { PageHeader } from "@/components/ui/page-header";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Cv } from "@/components/ui/cv";
import type { CvProps } from "@/helpers/schema";
import { useCurrentUser } from "@/hooks/useCurrentUser";
import { fetchUser, selectUser } from "@/redux/user/userSlice";
import type { AppDispatch } from "@/redux/store";

type Resume = Omit<CvProps, "title" | "summary"> & { id: string; title: string; summary: string[] };

export function ResumeEditor() {
  const { id } = useParams<{ id: string }>();
  const { t } = useTranslation();
  const dispatch = useDispatch<AppDispatch>();
  const { user: session } = useCurrentUser();
  const user = useSelector(selectUser);
  const [resume, setResume] = useState<Resume | null>(null);
  const [error, setError] = useState("");
  const [message, setMessage] = useState("");
  const [saving, setSaving] = useState(false);
  useEffect(() => { if (session?.id) void dispatch(fetchUser(session.id)); }, [session?.id, dispatch]);
  useEffect(() => {
    let active = true;
    setResume(null); setError("");
    fetch(`/api/cvs/${id}`).then(async response => { if (!response.ok) throw new Error(); return response.json(); }).then(data => { if (active) setResume(data); }).catch(() => { if (active) setError(t("shell.loadError")); });
    return () => { active = false; };
  }, [id, t]);
  const save = async () => {
    if (!resume || saving) return;
    setSaving(true); setError(""); setMessage("");
    try {
      const response = await fetch(`/api/cvs/${id}`, { method: "PATCH", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ title: resume.title, summary: resume.summary }) });
      if (!response.ok) throw new Error(); setMessage(t("documents.saved"));
    } catch { setError(t("documents.saveError")); }
    finally { setSaving(false); }
  };
  return <div className="space-y-6">
    <Button variant="ghost" asChild><Link href="/dashboard/resumes"><ArrowLeft />{t("documents.title")}</Link></Button>
    {error && <p role="alert" className="text-sm text-destructive">{error}</p>}
    {resume ? <><PageHeader title={resume.title} description={t("documents.editorDescription")} action={<Button onClick={() => void save()} disabled={saving || !resume.title.trim()}><Save />{t(saving ? "documents.saving" : "documents.save")}</Button>} />
      {message && <p role="status" className="text-sm text-primary">{message}</p>}
      <div className="grid items-start gap-5 xl:grid-cols-[280px_minmax(0,1fr)]">
        <section className="app-section space-y-5"><label htmlFor="resume-title" className="block text-sm font-medium">{t("documents.titleLabel")}<Input id="resume-title" className="mt-2" maxLength={160} value={resume.title} disabled={saving} onChange={event => { setResume({ ...resume, title: event.target.value }); setMessage(""); }} /></label><label htmlFor="resume-summary" className="block text-sm font-medium">{t("documents.summaryLabel")}<Textarea id="resume-summary" className="mt-2" rows={8} maxLength={5000} value={resume.summary.join("\n\n")} disabled={saving} onChange={event => { setResume({ ...resume, summary: [event.target.value] }); setMessage(""); }} /></label><Button variant="outline" asChild className="w-full"><Link href="/dashboard/profile">{t("shell.careerProfile")}</Link></Button></section>
        <section className="min-w-0"><Cv cv={{ ...resume, summary: resume.summary.join("\n\n") }} user={user || undefined} /></section>
      </div></> : !error && <p className="text-sm text-muted-foreground">{t("shell.loading")}</p>}
  </div>;
}
