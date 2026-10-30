"use client";

import { useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { Heart, Loader2, Sparkles } from "lucide-react";

import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  templateCatalog,
  type DocumentKind,
  type TemplateDefinition,
} from "@/lib/template-catalog";
import { TemplatePreview } from "./template-preview";

const PAGE_SIZE = 24;

const tabs: { id: DocumentKind; label: string }[] = [
  { id: "CV", label: "Resumes" },
  { id: "COVER_LETTER", label: "Cover Letters" },
];

function initialFavorites(): string[] {
  if (typeof window === "undefined") return [];

  try {
    const saved = JSON.parse(
      localStorage.getItem("cvcomet-template-favorites") || "[]",
    );

    return Array.isArray(saved)
      ? saved.filter((id): id is string => typeof id === "string")
      : [];
  } catch {
    return [];
  }
}

export function TemplateGallery() {
  const router = useRouter();

  const [kind, setKind] = useState<DocumentKind>("CV");
  const [selected, setSelected] = useState<TemplateDefinition | null>(null);
  const [creating, setCreating] = useState(false);
  const [favorites, setFavorites] = useState<string[]>(initialFavorites);
  const [visibleCount, setVisibleCount] = useState(PAGE_SIZE);

  useEffect(() => {
    setVisibleCount(PAGE_SIZE);
  }, [kind]);

  const templates = useMemo(
    () => templateCatalog.filter((template) => template.type === kind),
    [kind],
  );

  function changeTab(nextKind: DocumentKind) {
    setKind(nextKind);
    setSelected(null);
  }

  function toggleFavorite(id: string) {
    const next = favorites.includes(id)
      ? favorites.filter((value) => value !== id)
      : [...favorites, id];

    setFavorites(next);
    localStorage.setItem(
      "cvcomet-template-favorites",
      JSON.stringify(next),
    );
  }

  async function useTemplate() {
    if (!selected || creating) return;

    if (selected.type === "COVER_LETTER") {
      router.push(
        `/dashboard/cover-letters?template=${encodeURIComponent(selected.id)}`,
      );
      return;
    }

    setCreating(true);

    try {
      const response = await fetch("/api/cvs", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          source: "PROFILE",
          templateId: selected.id,
        }),
      });

      if (!response.ok) throw new Error("Resume creation failed");

      const resume = (await response.json()) as { id: string };
      router.push(`/dashboard/resumes/${resume.id}`);
    } finally {
      setCreating(false);
    }
  }

  return (
    <div className="space-y-5">
      {/* Uniquement les deux catégories de modèles. */}
      <div
        role="tablist"
        aria-label="Document templates"
        className="flex gap-6 border-b"
      >
        {tabs.map((tab) => (
          <button
            key={tab.id}
            id={`template-tab-${tab.id}`}
            type="button"
            role="tab"
            aria-selected={kind === tab.id}
            aria-controls="template-gallery-panel"
            onClick={() => changeTab(tab.id)}
            className={
              "-mb-px border-b-2 px-1 pb-3 pt-1 " +
              "text-sm font-medium transition-colors " +
              (kind === tab.id
                ? "border-primary text-foreground"
                : "border-transparent text-muted-foreground " +
                  "hover:text-foreground")
            }
          >
            {tab.label}
          </button>
        ))}
      </div>

      {/* Modèles éditables déjà présents dans le catalogue. */}
      <div
        id="template-gallery-panel"
        role="tabpanel"
        aria-labelledby={`template-tab-${kind}`}
        className={
          "grid grid-cols-1 gap-3 min-[420px]:grid-cols-2 " +
          "md:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5 " +
          "2xl:grid-cols-6"
        }
      >
        {templates.slice(0, visibleCount).map((template) => (
          <article
            key={template.id}
            className={
              "group min-w-0 overflow-hidden rounded-lg border bg-card " +
              "transition hover:-translate-y-0.5 hover:shadow-lg"
            }
          >
            <button
              type="button"
              onClick={() => setSelected(template)}
              className="block w-full text-left"
              aria-label={`Preview ${template.name}`}
            >
              <div className="bg-muted p-3">
                <TemplatePreview template={template} />
              </div>

              <div className="px-3 py-3">
                <h2 className="truncate text-sm font-semibold">
                  {template.name}
                </h2>
              </div>
            </button>

            <div className="flex justify-end border-t px-3 py-2">
              <button
                type="button"
                onClick={() => toggleFavorite(template.id)}
                className={
                  "shrink-0 rounded-md p-1 " +
                  (favorites.includes(template.id)
                    ? "text-rose-500"
                    : "text-muted-foreground")
                }
                aria-label={
                  favorites.includes(template.id)
                    ? `Remove ${template.name} from favorites`
                    : `Add ${template.name} to favorites`
                }
                aria-pressed={favorites.includes(template.id)}
              >
                <Heart
                  className="size-4"
                  fill={
                    favorites.includes(template.id)
                      ? "currentColor"
                      : "none"
                  }
                />
              </button>
            </div>
          </article>
        ))}
      </div>

      {templates.length > visibleCount && (
        <div className="text-center">
          <Button
            variant="outline"
            onClick={() => setVisibleCount((count) => count + PAGE_SIZE)}
          >
            Show more
          </Button>
        </div>
      )}

      {/* Aperçu et création : comportement conservé. */}
      <Dialog
        open={Boolean(selected)}
        onOpenChange={(open) => {
          if (!open) setSelected(null);
        }}
      >
        <DialogContent className="w-[calc(100%-1rem)] max-w-[1280px] gap-0 p-0 sm:max-w-[1280px]">
          <DialogHeader className="border-b px-5 py-5 pr-12">
            <DialogTitle>{selected?.name}</DialogTitle>
            <DialogDescription className="sr-only">
              Preview and create the selected template.
            </DialogDescription>
          </DialogHeader>

          {selected && (
            <div className="grid min-w-0 lg:grid-cols-[minmax(0,1fr)_260px]">
              <div className="min-w-0 bg-muted p-3 sm:p-6">
                <TemplatePreview
                  key={selected.id}
                  template={selected}
                  large
                />
              </div>

              <aside className="border-t p-5 lg:border-l lg:border-t-0">
                <Button
                  className="w-full"
                  onClick={() => void useTemplate()}
                  disabled={creating}
                >
                  {creating ? (
                    <Loader2 className="animate-spin" />
                  ) : (
                    <Sparkles />
                  )}
                  {selected.type === "CV"
                    ? "Use this template"
                    : "Create cover letter"}
                </Button>
              </aside>
            </div>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
}
