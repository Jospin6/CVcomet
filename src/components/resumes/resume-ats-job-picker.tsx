"use client";

import { useEffect, useId, useRef, useState } from "react";
import { Loader2 } from "lucide-react";
import { Input } from "@/components/ui/input";
import { savedJobLabel, type SavedJobSummary } from "@/lib/career/job-opportunities";
import { resumeAtsCopy } from "@/lib/resume-ats-copy";

type Props = {
  active: boolean;
  language: "fr" | "en";
  value: string;
  selected: SavedJobSummary | null;
  onChange: (_value: string) => void;
  onSelect: (_job: SavedJobSummary | null) => void;
};
type JobPage = { items: SavedJobSummary[]; nextCursor: string | null };

/** Only show matching saved postings while the user is typing.
 * A free-text role is NOT treated as a verified job description. */
export function ResumeAtsJobPicker({ active, language, value, selected, onChange, onSelect }: Props) {
  const c = resumeAtsCopy[language];
  const id = useId();
  const [focused, setFocused] = useState(false);
  const [results, setResults] = useState<SavedJobSummary[]>([]);
  const [loading, setLoading] = useState(false);
  const [highlight, setHighlight] = useState(-1);
  const abort = useRef<AbortController | null>(null);
  const query = value.trim();
  const showSuggestions = active && focused && query.length >= 2 && !selected;

  useEffect(() => {
    abort.current?.abort();
    if (!showSuggestions) {
      setLoading(false);
      setResults([]);
      setHighlight(-1);
      return;
    }
    const controller = new AbortController();
    abort.current = controller;
    setLoading(true);
    const timer = setTimeout(async () => {
      try {
        const params = new URLSearchParams({ q: query });
        const response = await fetch(`/api/job-opportunities?${params}`, { cache: "no-store", signal: controller.signal });
        if (!response.ok) throw new Error("JOBS_UNAVAILABLE");
        const page: JobPage = await response.json();
        if (controller.signal.aborted) return;
        setResults(page.items.slice(0, 6));
      } catch {
        if (!controller.signal.aborted) setResults([]);
      } finally {
        if (!controller.signal.aborted) setLoading(false);
      }
    }, 250);
    return () => { clearTimeout(timer); controller.abort(); };
  }, [query, showSuggestions]);

  const choose = (job: SavedJobSummary) => {
    onSelect(job);
    setFocused(false);
    setHighlight(-1);
  };

  return (
    <div className="relative">
      <label htmlFor={id} className="sr-only">{c.searchJobsPlaceholder}</label>
      <Input
        id={id}
        name="ats-job-title"
        autoComplete="off"
        value={value}
        maxLength={200}
        placeholder={language === "fr" ? "Ex. : Ingénieur IA" : "e.g. AI Engineer"}
        className="h-9 w-full rounded-md border-border/70 bg-background px-3 text-sm shadow-none"
        role="combobox"
        aria-autocomplete="list"
        aria-haspopup="listbox"
        aria-expanded={showSuggestions && results.length > 0}
        aria-controls={id + "-options"}
        aria-activedescendant={highlight >= 0 && showSuggestions && results[highlight] ? id + "-option-" + highlight : undefined}
        onFocus={() => setFocused(true)}
        onBlur={() => setFocused(false)}
        onChange={event => {
          const nextValue = event.target.value;
          onChange(nextValue);
          if (!nextValue.trim() && selected) onSelect(null);
          setHighlight(-1);
          setFocused(true);
        }}
        onKeyDown={event => {
          if (event.key === "Escape") { setFocused(false); return; }
          if (!showSuggestions || !results.length) return;
          if (event.key === "ArrowDown") { event.preventDefault(); setHighlight(i => (i + 1) % results.length); }
          if (event.key === "ArrowUp") { event.preventDefault(); setHighlight(i => i <= 0 ? results.length - 1 : i - 1); }
          if (event.key === "Enter" && highlight >= 0) { event.preventDefault(); choose(results[highlight]); }
        }}
      />
      {showSuggestions && (loading || results.length > 0) && (
        <div id={id + "-options"} role="listbox" aria-label={c.savedJobs} className="absolute inset-x-0 top-full z-30 mt-1 max-h-52 overflow-y-auto rounded-lg border border-border bg-popover p-1 shadow-lg">
          {loading ? (
            <p role="status" className="flex items-center gap-2 px-3 py-2 text-xs text-muted-foreground"><Loader2 className="size-3 animate-spin" />{c.loadingJobs}</p>
          ) : results.map((job, index) => (
            <div
              id={id + "-option-" + index}
              key={job.id}
              role="option"
              aria-selected={highlight === index}
              className={`cursor-pointer rounded-md px-3 py-2 text-xs leading-5 ${highlight === index ? "bg-accent" : "hover:bg-accent"}`}
              onPointerDown={event => { event.preventDefault(); choose(job); }}
            >
              <span className="block truncate font-medium">{savedJobLabel(job, language)}</span>
              {job.location && <span className="block truncate text-[11px] text-muted-foreground">{job.location}</span>}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
