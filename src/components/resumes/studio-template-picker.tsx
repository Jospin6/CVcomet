"use client";
import { translateCentral } from "@/lib/i18n/central-copy";

import { useMemo, useState } from "react";
import { Check, ChevronRight } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { TemplatePreview } from "@/components/templates/template-preview";
import {
  templateCatalog,
  type DocumentKind,
  type TemplateDefinition,
} from "@/lib/template-catalog";

type Props = {
  kind: DocumentKind;
  selectedId?: string;
  disabled?: boolean;
  fr: boolean;
  onSelect: (template: TemplateDefinition) => void;
};

// The same real catalogue and preview used on /templates, not made-up thumbnails.
export function StudioTemplatePicker({
  kind,
  selectedId,
  disabled = false,
  fr,
  onSelect,
}: Props) {
  const [expanded, setExpanded] = useState(false);
  const [limit, setLimit] = useState(12);
  const [inspected, setInspected] = useState<TemplateDefinition | null>(null);
  const templates = useMemo(
    () => templateCatalog.filter((template) => template.type === kind),
    [kind],
  );
  const ordered = useMemo(() => {
    const selected = templates.find((template) => template.id === selectedId);
    return selected
      ? [selected, ...templates.filter((template) => template.id !== selected.id)]
      : templates;
  }, [templates, selectedId]);
  const visible = expanded ? ordered.slice(0, limit) : ordered.slice(0, 3);

  return (
    <section aria-label={translateCentral(fr ? "fr" : "en", "uiText.components_resumes_studio_template_picker.text001")}>
      <div className="mb-3 flex items-center justify-between gap-2">
        <h3 className="text-xs font-semibold">Layout</h3>
        <button
          type="button"
          className="inline-flex items-center gap-1 text-[11px] text-primary hover:underline"
          aria-expanded={expanded}
          onClick={() => setExpanded((value) => !value)}
        >
          {expanded ? (translateCentral(fr ? "fr" : "en", "uiText.components_resumes_studio_template_picker.text002")) : (translateCentral(fr ? "fr" : "en", "uiText.components_resumes_studio_template_picker.text003"))}
          <ChevronRight className={`size-3 transition-transform ${expanded ? "rotate-90" : ""}`} />
        </button>
      </div>
      <div className="studio-gallery-grid">
        {visible.map((template) => (
          <button
            type="button"
            key={template.id}
            className="studio-gallery-item"
            aria-label={`${translateCentral(fr ? "fr" : "en", "uiText.components_resumes_studio_template_picker.text004")}: ${template.name}`}
            aria-current={selectedId === template.id ? "true" : undefined}
            onClick={() => setInspected(template)}
          >
            <div className="studio-gallery-thumb">
              <TemplatePreview template={template} />
              {selectedId === template.id && (
                <span className="studio-gallery-selected"><Check className="size-3" /></span>
              )}
            </div>
            <span className="studio-gallery-name">{template.name}</span>
          </button>
        ))}
      </div>
      {expanded && visible.length < ordered.length && (
        <Button
          type="button"
          variant="ghost"
          size="sm"
          className="mt-3 w-full text-xs"
          onClick={() => setLimit((count) => Math.min(count + 12, ordered.length))}
        >
          {translateCentral(fr ? "fr" : "en", "uiText.components_resumes_studio_template_picker.text005")}
        </Button>
      )}
      <Dialog open={Boolean(inspected)} onOpenChange={(open) => { if (!open) setInspected(null); }}>
        <DialogContent className="max-w-[min(92vw,760px)] gap-3 p-4 sm:max-w-[760px]">
          {inspected && (
            <>
              <DialogHeader>
                <DialogTitle className="text-base">{inspected.name}</DialogTitle>
              </DialogHeader>
              <div className="studio-gallery-large">
                <TemplatePreview template={inspected} large />
              </div>
              <div className="flex justify-end">
                <Button
                  type="button"
                  disabled={disabled}
                  onClick={() => {
                    onSelect(inspected);
                    setInspected(null);
                  }}
                >
                  {selectedId === inspected.id
                    ? (translateCentral(fr ? "fr" : "en", "uiText.components_resumes_studio_template_picker.text006"))
                    : (translateCentral(fr ? "fr" : "en", "uiText.components_resumes_studio_template_picker.text007"))}
                </Button>
              </div>
            </>
          )}
        </DialogContent>
      </Dialog>
    </section>
  );
}
