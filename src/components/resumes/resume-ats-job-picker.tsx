"use client";

import { useCallback, useEffect, useId, useRef, useState } from "react";
import { BriefcaseBusiness, Loader2, Save } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { savedJobLabel, type SavedJobSummary } from "@/lib/career/job-opportunities";
import { resumeAtsCopy } from "@/lib/resume-ats-copy";

type Props = { active: boolean; language: "fr" | "en"; selected: SavedJobSummary | null; onSelect: (_job: SavedJobSummary | null) => void };
type JobPage = { items: SavedJobSummary[]; nextCursor: string | null };

export function ResumeAtsJobPicker({ active, language, selected, onSelect }: Props) {
  const c = resumeAtsCopy[language], id = useId();
  const [query, setQuery] = useState(""), [rows, setRows] = useState<SavedJobSummary[]>([]);
  const [nextCursor, setNextCursor] = useState<string | null>(null), [loading, setLoading] = useState(false), [loadError, setLoadError] = useState(false);
  const [creating, setCreating] = useState(false), [title, setTitle] = useState(""), [company, setCompany] = useState(""), [description, setDescription] = useState("");
  const [saving, setSaving] = useState(false), [saveError, setSaveError] = useState(false), [message, setMessage] = useState("");
  const listRequest = useRef<AbortController | null>(null), saveRequest = useRef<AbortController | null>(null);
  const selection = useRef(selected); selection.current = selected;
  const loadJobs = useCallback(async (cursor?: string) => {
    listRequest.current?.abort();
    const controller = new AbortController(); listRequest.current = controller;
    setLoading(true); setLoadError(false);
    try {
      const params = new URLSearchParams({ q: query.trim(), ...(cursor ? { cursor } : {}) });
      const response = await fetch(`/api/job-opportunities?${params}`, { cache: "no-store", signal: controller.signal });
      if (!response.ok) throw Error("FAILED");
      const page: JobPage = await response.json();
      if (controller.signal.aborted) return;
      setRows(previous => cursor ? [...new Map([...previous, ...page.items].map(job => [job.id, job])).values()] : page.items);
      setNextCursor(page.nextCursor);
      const fresh = page.items.find(job => job.id === selection.current?.id);
      if (fresh && (fresh.updatedAt !== selection.current?.updatedAt || fresh.title !== selection.current?.title || fresh.company !== selection.current?.company)) onSelect(fresh);
    } catch { if (!controller.signal.aborted) setLoadError(true); }
    finally { if (!controller.signal.aborted) setLoading(false); }
  }, [query, onSelect]);
  useEffect(() => {
    if (!active) return;
    setLoading(true);
    const timer = setTimeout(() => { void loadJobs(); }, 250);
    return () => { clearTimeout(timer); listRequest.current?.abort(); };
  }, [active, loadJobs]);
  useEffect(() => () => { saveRequest.current?.abort(); }, []);

  const save = async () => {
    if (saveRequest.current || !title.trim() || description.trim().length < 100) return;
    const controller = new AbortController(); saveRequest.current = controller;
    setSaving(true); setSaveError(false); setMessage("");
    try {
      const response = await fetch("/api/job-opportunities", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ title, company, description }), signal: controller.signal });
      if (!response.ok) throw Error("FAILED");
      const job: SavedJobSummary = await response.json();
      if (controller.signal.aborted) return;
      setRows(previous => [job, ...previous.filter(row => row.id !== job.id)]);
      onSelect(job); setQuery(""); setCreating(false); setTitle(""); setCompany(""); setDescription(""); setMessage(c.jobSaved);
    } catch { if (!controller.signal.aborted) setSaveError(true); }
    finally { saveRequest.current = null; if (!controller.signal.aborted) setSaving(false); }
  };
  const options = selected && !rows.some(row => row.id === selected.id) ? [selected, ...rows] : rows;

  return <section className="studio-ats-job-picker space-y-3 rounded-lg border p-3" aria-label={c.jobInput}>
    <h3 className="flex items-center gap-2 text-xs font-semibold"><BriefcaseBusiness className="size-4 shrink-0 text-primary" />{c.jobInput}</h3>
    <p className="text-[10px] leading-5 text-muted-foreground">{c.savedJobHint}</p>
    <label className="block text-[11px]" htmlFor={id + "-search"}>{c.searchJobs}<Input id={id + "-search"} type="search" maxLength={200} value={query} onChange={event => setQuery(event.target.value)} placeholder={c.searchJobsPlaceholder} className="mt-1 h-8 text-xs" /></label>
    <label className="block text-[11px]" htmlFor={id + "-job"}>{c.savedJobs}<select id={id + "-job"} value={selected?.id ?? ""} onChange={event => { onSelect(options.find(job => job.id === event.target.value) ?? null); setMessage(""); }} className="mt-1 h-9 w-full min-w-0 rounded-md border bg-background px-2 text-xs">
      <option value="">{c.generalCheck}</option>
      {options.map(job => <option key={job.id} value={job.id}>{savedJobLabel(job, language)}{job.location ? ` · ${job.location}` : ""}</option>)}
    </select></label>
    {selected && <p className="break-words text-[11px] font-medium text-primary">{savedJobLabel(selected, language)}</p>}
    {loading && <p role="status" className="flex items-center gap-2 text-[10px] text-muted-foreground"><Loader2 className="size-3 animate-spin" />{c.loadingJobs}</p>}
    {loadError && <div role="alert" className="text-[11px] text-destructive"><p>{c.jobsError}</p><Button type="button" variant="ghost" size="sm" className="mt-1 text-[11px]" onClick={() => void loadJobs()}>{c.retryJobs}</Button></div>}
    {!loading && !loadError && !rows.length && (query.trim() || !selected) && <p className="text-[10px] leading-5 text-muted-foreground">{query.trim() ? c.noMatchingJobs : c.noSavedJobs}</p>}
    {nextCursor && <Button type="button" size="sm" variant="ghost" disabled={loading} className="w-full text-[11px]" onClick={() => void loadJobs(nextCursor)}>{c.moreJobs}</Button>}
    <details open={creating} onToggle={event => setCreating(event.currentTarget.open)} className="studio-ats-new-job">
      <summary className="cursor-pointer text-[11px] font-medium">{c.newJob}</summary>
      <form className="mt-3 space-y-3" onSubmit={event => { event.preventDefault(); void save(); }}>
        <label className="block text-[11px]">{c.jobTitle}<Input required maxLength={180} value={title} disabled={saving} onChange={event => setTitle(event.target.value)} placeholder={c.jobTitlePlaceholder} className="mt-1 text-xs" /></label>
        <label className="block text-[11px]">{c.jobCompany}<Input maxLength={180} value={company} disabled={saving} onChange={event => setCompany(event.target.value)} placeholder="Meta" className="mt-1 text-xs" /></label>
        <label className="block text-[11px]">{c.jobLabel}<Textarea required rows={6} minLength={100} maxLength={50000} value={description} disabled={saving} onChange={event => setDescription(event.target.value)} placeholder={c.jobPlaceholder} className="mt-1 text-xs" /></label>
        <p className="text-[10px] leading-5 text-muted-foreground">{c.jobHint}</p>
        <Button type="submit" size="sm" className="w-full text-[11px]" disabled={saving || !title.trim() || description.trim().length < 100}>{saving ? <Loader2 className="size-3 animate-spin" /> : <Save className="size-3" />}{c.saveJob}</Button>
        {saveError && <p role="alert" className="text-[11px] text-destructive">{c.saveJobError}</p>}
      </form>
    </details>
    {message && <p role="status" className="text-[11px] text-primary">{message}</p>}
  </section>;
}
