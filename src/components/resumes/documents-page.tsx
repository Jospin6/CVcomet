"use client";

import { useEffect, useRef, useState } from "react";
import type { DragEvent, ReactNode } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useTranslation } from "react-i18next";
import {
  CheckCircle2,
  ContactRound,
  FilePenLine,
  FilePlus2,
  FileText,
  Linkedin,
  LoaderCircle,
  MoreHorizontal,
  Plus,
  Sparkles,
  Upload,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { ResumeCards, useResumeLibrary } from "./resume-library";
import { RESUME_ACCEPT, validateResumeSelection } from "@/lib/resume-documents";
import { LinkedInImportDialog } from "./linkedin-import-dialog";

type Tab = "resumes" | "letters" | "resignations";
type CoverLetterSummary = {
  id: string;
  senderName: string | null;
  companyName: string | null;
  positionTitle: string | null;
  introduction: string;
  body: string;
  conclusion: string | null;
  updatedAt: string;
};
type ResignationSummary = {
  id: string;
  title: string;
  recipient: string;
  company: string;
  subject: string;
  body: string;
  letterDate: string;
  updatedAt: string;
};

const tabs: { id: Tab; title: string }[] = [
  { id: "resumes", title: "Resumes" },
  { id: "letters", title: "Cover Letters" },
  { id: "resignations", title: "Resignation Letters" },
];

const gridClass = "grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5 sm:gap-4";

function CreateCard({ children, onDrop }: { children: ReactNode; onDrop?: (event: DragEvent<HTMLDivElement>) => void }) {
  return (
    <div
      className="flex min-h-[258px] min-w-0 flex-col justify-center gap-1 rounded-xl border border-dashed border-primary/50 bg-card p-3"
      onDragOver={onDrop ? (event) => event.preventDefault() : undefined}
      onDrop={onDrop}
    >
      {children}
    </div>
  );
}

function CreateAction({ children, onClick, href }: {
  children: ReactNode;
  onClick?: () => void;
  href?: string;
}) {
  const className = "flex min-h-12 w-full items-center justify-center gap-2 rounded-md px-1 py-2 text-center text-xs font-medium text-primary transition-colors hover:bg-primary/5 disabled:opacity-50";
  if (href) return <Link href={href} className={className}>{children}</Link>;
  return <button type="button" onClick={onClick} className={className}>{children}</button>;
}

function PreviewPaper({ title, content, name }: {
  title: string;
  content: string;
  name?: string | null;
}) {
  return (
    <div className="flex h-[210px] items-start justify-center overflow-hidden border-b bg-muted/40 p-3">
      <div className="h-full w-full max-w-[155px] overflow-hidden rounded-t-sm border border-slate-200 bg-white px-3 py-3 text-slate-900 shadow-sm">
        {name && <p className="mb-3 truncate text-center text-[9px] font-semibold">{name}</p>}
        <p className="mb-2 line-clamp-2 text-[8px] font-semibold">{title}</p>
        <div className="h-px bg-slate-200" />
        <p className="mt-3 whitespace-pre-wrap break-words text-[8px] leading-[1.6]">
          {content || " "}
        </p>
      </div>
    </div>
  );
}

function DocumentTile({ title, href, preview, onDelete }: {
  title: string;
  href: string;
  preview: ReactNode;
  onDelete?: () => void;
}) {
  return (
    <article className="min-w-0 overflow-hidden rounded-xl border bg-card transition-shadow hover:shadow-sm">
      <Link href={href} className="block" aria-label={`Open ${title}`}>{preview}</Link>
      <div className="flex min-h-12 items-center justify-between gap-2 px-3 py-2">
        <p title={title} className="min-w-0 truncate text-xs font-medium">{title}</p>
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button size="icon" variant="ghost" className="size-7 shrink-0" aria-label={`Actions: ${title}`}>
              <MoreHorizontal className="size-4" />
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end">
            <DropdownMenuItem asChild><Link href={href}>Open & edit</Link></DropdownMenuItem>
            {onDelete && (
              <DropdownMenuItem variant="destructive" onSelect={onDelete}>
                Delete
              </DropdownMenuItem>
            )}
          </DropdownMenuContent>
        </DropdownMenu>
      </div>
    </article>
  );
}

function ToolsTile() {
  return (
    <Link
      href="/templates"
      className="flex min-h-[258px] flex-col justify-between rounded-xl bg-primary p-4 text-primary-foreground transition-opacity hover:opacity-95"
    >
      <div>
        <Sparkles className="mb-3 size-5" />
        <h3 className="text-base font-semibold leading-tight">Make your next application stand out.</h3>
        <p className="mt-4 text-xs opacity-90">Explore CV and letter templates.</p>
      </div>
      <span className="rounded-md bg-primary-foreground px-3 py-2 text-center text-xs font-medium text-primary">
        Explore templates
      </span>
    </Link>
  );
}

export function DocumentsPage() {
  const { t } = useTranslation();
  const router = useRouter();
  const input = useRef<HTMLInputElement>(null);
  const uploadLock = useRef(false);
  const { documents, loading, error: resumeError, reload } = useResumeLibrary();

  const [tab, setTab] = useState<Tab>("resumes");
  const [letters, setLetters] = useState<CoverLetterSummary[]>([]);
  const [resignations, setResignations] = useState<ResignationSummary[]>([]);
  const [loaded, setLoaded] = useState<Record<Tab, boolean>>({ resumes: true, letters: false, resignations: false });
  const [tabBusy, setTabBusy] = useState(false);
  const [reloadKey, setReloadKey] = useState(0);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [message, setMessage] = useState("");
  const [linkedinOpen, setLinkedinOpen] = useState(false);
  const [applicationId, setApplicationId] = useState("");
  const [deleteLetter, setDeleteLetter] = useState<ResignationSummary | null>(null);

  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    setApplicationId(params.get("applicationId") || "");
    const requested = params.get("tab");
    if (requested === "letters" || requested === "resignations") setTab(requested);
  }, []);

  useEffect(() => {
    if (tab === "resumes" || loaded[tab]) return;
    const controller = new AbortController();
    const endpoint = tab === "letters" ? "/api/cover-letters" : "/api/resignation-letters";
    setTabBusy(true);
    setError("");
    void fetch(endpoint, { cache: "no-store", signal: controller.signal })
      .then(async (response) => {
        if (!response.ok) throw new Error("Unable to load your documents.");
        return response.json();
      })
      .then((result: CoverLetterSummary[] | ResignationSummary[]) => {
        if (controller.signal.aborted) return;
        if (tab === "letters") setLetters(result as CoverLetterSummary[]);
        else setResignations(result as ResignationSummary[]);
        setLoaded((current) => ({ ...current, [tab]: true }));
      })
      .catch(() => { if (!controller.signal.aborted) setError("Unable to load your documents."); })
      .finally(() => { if (!controller.signal.aborted) setTabBusy(false); });
    return () => controller.abort();
  }, [tab, loaded, reloadKey]);

  const contextual = (path: string) => applicationId
    ? `${path}${path.includes("?") ? "&" : "?"}applicationId=${encodeURIComponent(applicationId)}`
    : path;

  const attachResume = async (cvId: string) => {
    if (!applicationId) return;
    const response = await fetch(`/api/applications/${encodeURIComponent(applicationId)}`, {
      method: "PATCH",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ cvId, coverLetterId: null }),
    });
    if (!response.ok) throw new Error("Created, but could not attach to the application.");
  };

  const upload = async (files: File[]) => {
    if (uploadLock.current || busy) return;
    const invalid = validateResumeSelection(files);
    if (invalid) { setError(t(`documents.errors.${invalid}`)); return; }
    setBusy(true);
    setError("");
    setMessage("");
    uploadLock.current = true;
    try {
      const data = new FormData();
      files.forEach((file) => data.append("resumes", file));
      const response = await fetch("/api/resume-documents", { method: "POST", body: data });
      if (!response.ok) {
        const result = await response.json().catch(() => ({}));
        throw new Error(result.error || "UPLOAD_FAILED");
      }
      const uploaded = await response.json() as Array<{ id: string }>;
      await reload();
      setMessage(t("documents.uploadSuccess", { count: files.length }));
      if (files.length === 1 && uploaded[0]?.id) {
        router.push(contextual(`/dashboard/resumes/import/${uploaded[0].id}`));
      }
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "Upload failed");
    } finally {
      uploadLock.current = false;
      setBusy(false);
      if (input.current) input.current.value = "";
    }
  };

  const createResume = async (source: "PROFILE" | "SCRATCH") => {
    if (busy) return;
    setBusy(true);
    setError("");
    try {
      const response = await fetch("/api/cvs", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ source }),
      });
      if (!response.ok) throw new Error("Unable to create your resume.");
      const created = await response.json() as { id: string };
      await attachResume(created.id);
      router.push(contextual(`/dashboard/resumes/${created.id}`));
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "Unable to create resume");
      setBusy(false);
    }
  };

  const createBlankCoverLetter = async () => {
    if (busy) return;
    setBusy(true);
    setError("");
    try {
      const response = await fetch("/api/cover-letters", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify(applicationId ? { applicationId } : {}),
      });
      if (!response.ok) throw new Error("Unable to create your cover letter.");
      const created = await response.json() as { id: string };
      router.push(contextual(`/dashboard/cover-letters/${created.id}`));
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "Unable to create letter");
      setBusy(false);
    }
  };

  const createResignation = async () => {
    if (busy) return;
    setBusy(true);
    setError("");
    try {
      const response = await fetch("/api/resignation-letters", { method: "POST" });
      if (!response.ok) throw new Error("Unable to create your letter.");
      const result = await response.json() as { id: string };
      router.push(`/dashboard/resignation-letters/${result.id}`);
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "Unable to create letter");
      setBusy(false);
    }
  };

  const removeResignation = async () => {
    if (!deleteLetter || busy) return;
    setBusy(true);
    setError("");
    try {
      const response = await fetch(`/api/resignation-letters/${deleteLetter.id}`, {
        method: "DELETE",
      });
      if (!response.ok) throw new Error("Unable to delete this letter.");
      setResignations((current) => current.filter((item) => item.id !== deleteLetter.id));
      setDeleteLetter(null);
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "Delete failed");
    } finally {
      setBusy(false);
    }
  };

  return (
    <main className="mx-auto max-w-7xl space-y-5 pb-12">
      <div className="rounded-2xl bg-muted/35 p-4 sm:p-6 lg:p-8">
        <header className="mb-5 flex flex-wrap items-center justify-between gap-4">
          <h1 className="text-xl font-semibold tracking-tight sm:text-2xl">Documents</h1>
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button size="sm" disabled={busy}>
                {busy ? <LoaderCircle className="size-4 animate-spin" /> : <Plus className="size-4" />}
                Create New
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end">
              <DropdownMenuItem onSelect={() => input.current?.click()}>
                <Upload className="size-4" /> Upload resume
              </DropdownMenuItem>
              <DropdownMenuItem onSelect={() => void createResume("PROFILE")}>
                <ContactRound className="size-4" /> Resume from profile
              </DropdownMenuItem>
              <DropdownMenuItem onSelect={() => void createResume("SCRATCH")}>
                <FileText className="size-4" /> Blank resume
              </DropdownMenuItem>
              <DropdownMenuItem onSelect={() => void createBlankCoverLetter()}>
                <FilePenLine className="size-4" /> Blank cover letter
              </DropdownMenuItem>
              <DropdownMenuItem onSelect={() => void createResignation()}>
                <FilePlus2 className="size-4" /> Resignation letter
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
        </header>

        <nav role="tablist" className="mb-5 flex gap-1 overflow-x-auto border-b" aria-label="Document types">
          {tabs.map((item) => (
            <button
              type="button"
              key={item.id}
              onClick={() => { setTab(item.id); setError(""); }}
              role="tab"
              id={`documents-tab-${item.id}`}
              aria-controls={`documents-panel-${item.id}`}
              aria-selected={tab === item.id}
              onKeyDown={(event) => {
                if (!["ArrowRight", "ArrowLeft", "Home", "End"].includes(event.key)) return;
                event.preventDefault();
                const index = tabs.findIndex((candidate) => candidate.id === tab);
                const next = event.key === "Home" ? 0
                  : event.key === "End" ? tabs.length - 1
                    : (index + (event.key === "ArrowRight" ? 1 : -1) + tabs.length) % tabs.length;
                setTab(tabs[next].id);
                document.getElementById(`documents-tab-${tabs[next].id}`)?.focus();
              }}
              className={`shrink-0 border-b-2 px-3 py-2.5 text-xs font-medium transition-colors sm:text-sm ${
                tab === item.id
                  ? "border-primary text-primary"
                  : "border-transparent text-muted-foreground hover:text-foreground"
              }`}
            >
              {item.title}
            </button>
          ))}
        </nav>

        <input
          ref={input}
          className="sr-only"
          type="file"
          multiple
          accept={RESUME_ACCEPT}
          aria-label="Upload resume"
          onChange={(event) => {
            const files = Array.from(event.target.files || []);
            event.target.value = "";
            if (files.length) void upload(files);
          }}
        />

        {error && (
          <div role="alert" className="mb-4 flex flex-wrap items-center gap-3 rounded-lg border border-destructive/25 p-3 text-xs text-destructive">
            <span>{error}</span>
            {tab !== "resumes" && (
              <button className="font-semibold underline" type="button" onClick={() => setReloadKey((key) => key + 1)}>
                Retry
              </button>
            )}
          </div>
        )}
        {message && <p role="status" className="mb-4 flex items-center gap-2 text-xs text-primary"><CheckCircle2 className="size-4" />{message}</p>}

        {tab === "resumes" && (
          <div role="tabpanel" id="documents-panel-resumes" aria-labelledby="documents-tab-resumes" className={gridClass}>
            <CreateCard onDrop={(event) => {
              event.preventDefault();
              if (event.dataTransfer.files.length) void upload(Array.from(event.dataTransfer.files));
            }}>
              <CreateAction onClick={() => input.current?.click()}><Upload className="size-4" /> Upload Resume</CreateAction>
              <div className="mx-auto h-px w-12 bg-border" />
              <CreateAction onClick={() => setLinkedinOpen(true)}><Linkedin className="size-4" /> Import from LinkedIn</CreateAction>
              <div className="mx-auto h-px w-12 bg-border" />
              <CreateAction onClick={() => void createResume("PROFILE")}><Sparkles className="size-4" /> From my profile</CreateAction>
              <div className="mx-auto h-px w-12 bg-border" />
              <CreateAction onClick={() => void createResume("SCRATCH")}><FilePlus2 className="size-4" /> Start from Scratch</CreateAction>
              <div className="mx-auto h-px w-12 bg-border" />
              <CreateAction href="/templates"><FileText className="size-4" /> Use Resume Example</CreateAction>
            </CreateCard>
            {resumeError ? (
              <p role="alert" className="text-xs text-destructive">Unable to load resumes. <button type="button" className="underline" onClick={() => void reload()}>Retry</button></p>
            ) : <ResumeCards documents={documents} loading={loading} compact onDeleted={() => void reload()} />}
            <ToolsTile />
          </div>
        )}

        {tab === "letters" && (
          <div role="tabpanel" id="documents-panel-letters" aria-labelledby="documents-tab-letters" className={gridClass}>
            <CreateCard>
              <CreateAction href={contextual("/dashboard/cover-letters")}><Sparkles className="size-4" /> Create with AI tools</CreateAction>
              <div className="mx-auto h-px w-12 bg-border" />
              <CreateAction onClick={() => void createBlankCoverLetter()}><FilePlus2 className="size-4" /> Start from Scratch</CreateAction>
              <div className="mx-auto h-px w-12 bg-border" />
              <CreateAction href="/templates"><FileText className="size-4" /> Use Cover Letter Example</CreateAction>
            </CreateCard>
            {tabBusy ? <div role="status" className="text-xs text-muted-foreground">Loading letters…</div> : letters.map((letter) => (
              <DocumentTile
                key={letter.id}
                title={letter.positionTitle || letter.companyName || "Cover letter"}
                href={contextual(`/dashboard/cover-letters/${letter.id}`)}
                preview={
                  <PreviewPaper
                    title={[letter.positionTitle, letter.companyName].filter(Boolean).join(" · ") || "Cover letter"}
                    name={letter.senderName}
                    content={[letter.introduction, letter.body, letter.conclusion].filter(Boolean).join("\n\n")}
                  />
                }
              />
            ))}
            <ToolsTile />
          </div>
        )}

        {tab === "resignations" && (
          <div role="tabpanel" id="documents-panel-resignations" aria-labelledby="documents-tab-resignations" className={gridClass}>
            <CreateCard>
              <CreateAction onClick={() => void createResignation()}><FilePenLine className="size-4" /> Start from Scratch</CreateAction>
            </CreateCard>
            {tabBusy ? <div role="status" className="text-xs text-muted-foreground">Loading letters…</div> : resignations.map((letter) => (
              <DocumentTile
                key={letter.id}
                title={letter.title}
                href={`/dashboard/resignation-letters/${letter.id}`}
                preview={
                  <PreviewPaper
                    title={letter.subject}
                    name={letter.recipient}
                    content={[letter.company, letter.body].filter(Boolean).join("\n\n")}
                  />
                }
                onDelete={() => setDeleteLetter(letter)}
              />
            ))}
            <ToolsTile />
          </div>
        )}
      </div>

      <LinkedInImportDialog
        open={linkedinOpen}
        onOpenChange={setLinkedinOpen}
        onImported={(id) => {
          setLinkedinOpen(false);
          void attachResume(id)
            .then(() => router.push(contextual(`/dashboard/resumes/${id}`)))
            .catch((cause) => setError(cause instanceof Error ? cause.message : "Unable to link resume"));
        }}
      />
      <AlertDialog open={Boolean(deleteLetter)} onOpenChange={(open) => { if (!open && !busy) setDeleteLetter(null); }}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete this letter?</AlertDialogTitle>
            <AlertDialogDescription>
              {deleteLetter?.title} will be permanently deleted.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={busy}>Cancel</AlertDialogCancel>
            <AlertDialogAction
              className="bg-destructive text-destructive-foreground"
              disabled={busy}
              onClick={(event) => { event.preventDefault(); void removeResignation(); }}
            >
              Delete
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </main>
  );
}
