"use client";

import { useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useDispatch } from "react-redux";
import { useTranslation } from "react-i18next";
import { ArrowUpRight, Copy, FileText, Link2, LoaderCircle, Mail, Plus, Sparkles } from "lucide-react";
import { PageHeader } from "@/components/ui/page-header";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { useApi } from "@/components/career/data-state";
import { addConversation, clearConversationId, setTypeGeneration } from "@/redux/conversation/conversationSlice";
import type { AppDispatch } from "@/redux/store";

type Letter = { id: string; companyName: string | null; positionTitle: string | null; introduction: string; conversationId: string };

export function CoverLettersPage() {
  const { t } = useTranslation();
  const router = useRouter();
  const dispatch = useDispatch<AppDispatch>();
  const { data: letters, loading, error: loadError, reload } = useApi<Letter[]>("/api/coverLetter?mine=1");
  const [url, setUrl] = useState("");
  const [email, setEmail] = useState<{ subject: string; body: string } | null>(null);
  const [busy, setBusy] = useState(false);
  const [creating, setCreating] = useState(false);
  const [error, setError] = useState("");
  const [copied, setCopied] = useState(false);
  const validUrl = (() => { try { return ["http:", "https:"].includes(new URL(url).protocol); } catch { return false; } })();
  const create = async () => {
    setCreating(true); setError("");
    try {
      dispatch(clearConversationId()); dispatch(setTypeGeneration("coverLetter"));
      const conversation = await dispatch(addConversation({ content: "Create a cover letter from my confirmed career profile for my target role. Use only confirmed facts." })).unwrap();
      router.push("/g/" + conversation.id);
    } catch { setError(t("documents.letterError")); setCreating(false); }
  };
  const generate = async (event: React.FormEvent) => {
    event.preventDefault(); if (!validUrl || busy) return;
    setBusy(true); setError(""); setEmail(null); setCopied(false);
    try {
      const response = await fetch("/api/application-email", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ url, type: "APPLICATION" }) });
      if (!response.ok) throw new Error(); setEmail(await response.json());
    } catch { setError(t("documents.emailError")); }
    finally { setBusy(false); }
  };
  return <div className="space-y-6">
    <PageHeader title={t("documents.title")} description={t("documents.lettersDescription")} action={<Button disabled={creating} onClick={() => void create()}>{creating ? <LoaderCircle className="animate-spin" /> : <Plus />}{t("documents.createLetter")}</Button>} />
    <nav aria-label={t("documents.tabs")} className="flex gap-6 overflow-x-auto border-b text-sm"><Link href="/dashboard/resumes" className="flex shrink-0 items-center gap-2 pb-3 text-muted-foreground hover:text-foreground"><FileText className="size-4" />{t("shell.resumes")}</Link><span aria-current="page" className="flex shrink-0 items-center gap-2 border-b-2 border-primary pb-3 font-medium text-primary"><Mail className="size-4" />{t("shell.coverLetters")}</span></nav>
    {error && <p role="alert" className="rounded-lg border border-destructive/25 p-4 text-sm text-destructive">{error}</p>}
    <section className="grid gap-5 lg:grid-cols-2">
      <div className="app-section"><Mail className="size-6 text-primary" /><h2 className="mt-4 type-h2">{t("documents.createLetter")}</h2><p className="mt-2 text-sm leading-6 text-muted-foreground">{t("documents.letterHint")}</p><Button className="mt-5" variant="outline" disabled={creating} onClick={() => void create()}><Plus />{t("documents.createLetter")}</Button></div>
      <form className="app-section" onSubmit={generate}><h2 className="type-h2">{t("documents.emailTitle")}</h2><p className="mt-2 text-sm leading-6 text-muted-foreground">{t("documents.emailHint")}</p><label htmlFor="email-job-url" className="mt-4 block text-sm font-medium">{t("documents.jobUrl")}</label><div className="relative mt-2"><Link2 className="absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" /><Input id="email-job-url" type="url" required value={url} onChange={event => setUrl(event.target.value)} disabled={busy} className="pl-9" placeholder="https://careers.company.com/jobs/role" /></div><Button className="mt-4" type="submit" disabled={!validUrl || busy}>{busy ? <LoaderCircle className="animate-spin" /> : <Sparkles />}{t(busy ? "documents.writing" : "documents.writeEmail")}</Button></form>
    </section>
    {email && <section className="app-section"><div className="flex flex-wrap items-center justify-between gap-3"><h2 className="type-h2">{email.subject}</h2><Button variant="outline" onClick={async () => { try { await navigator.clipboard.writeText(`Subject: ${email.subject}\n\n${email.body}`); setCopied(true); } catch { setCopied(false); } }}><Copy />{t(copied ? "documents.copied" : "documents.copy")}</Button></div><p className="mt-4 whitespace-pre-wrap text-sm leading-7">{email.body}</p></section>}
    {loadError ? <div role="alert" className="app-section"><p>{t("shell.loadError")}</p><Button className="mt-3" variant="outline" onClick={() => void reload()}>{t("shell.retry")}</Button></div> : loading ? <p className="text-sm text-muted-foreground">{t("shell.loading")}</p> : letters?.length ? <section className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">{letters.map(letter => <Link key={letter.id} href={`/g/${letter.conversationId}`} className="min-w-0 rounded-xl border bg-card p-5 hover:border-primary"><Mail className="size-5 text-primary" /><h2 className="mt-5 truncate font-medium">{letter.positionTitle || t("shell.letterShort")}</h2><p className="mt-1 text-xs text-muted-foreground">{letter.companyName}</p><p className="mt-4 line-clamp-3 text-sm text-muted-foreground">{letter.introduction}</p><p className="mt-4 flex items-center justify-between border-t pt-3 text-xs text-primary">{t("shell.open")}<ArrowUpRight className="size-4" /></p></Link>)}</section> : null}
  </div>;
}
