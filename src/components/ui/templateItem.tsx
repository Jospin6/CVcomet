"use client";
import Image from "next/image";
import { useState } from "react";
import { Check, FileText, Maximize2 } from "lucide-react";
import { useTranslation } from "react-i18next";
import type { User } from "@/redux/user/userSlice";
import type { Template } from "@/redux/template/templateSlice";
import { Badge } from "./badge";
import { PopupModal } from "./popupModal";
import { cn } from "@/lib/utils";
import { marketProfiles, type ResumeMarket } from "@/lib/resume-market";

export function TemplateItem({
  template,
  user,
}: {
  template: Template;
  user?: User;
}) {
  const { t } = useTranslation();
  const [open, setOpen] = useState(false);
  const [failed, setFailed] = useState(false);
  const selected =
    template.id ===
    (template.type === "CV"
      ? user?.currentTemplateId
      : user?.currentCoverLetterId);
  const imageUrl = "/api/avatar?id=" + encodeURIComponent(template.id);
  return (
    <article
      className={cn(
        "min-w-0 overflow-hidden rounded-xl border bg-card transition-shadow hover:shadow-md",
        selected && "border-primary ring-1 ring-primary",
      )}
    >
      <button
        type="button"
        onClick={() => setOpen(true)}
        aria-label={t("shell.preview") + ": " + template.name}
        className="group block w-full text-left"
      >
        <div className="relative bg-muted px-6 pb-6 pt-8">
          <div className="document-paper relative mx-auto aspect-[210/297] w-full overflow-hidden rounded-sm shadow-sm">
            {failed ? (
              <div className="flex h-full flex-col items-center justify-center gap-3 p-4 text-center text-sm">
                <FileText />
                <span>{t("shell.previewMissing")}</span>
              </div>
            ) : (
              <Image
                src={imageUrl}
                alt=""
                fill
                unoptimized
                sizes="(max-width: 767px) 80vw, 280px"
                className="object-contain"
                onError={() => setFailed(true)}
              />
            )}
          </div>
          {selected && (
            <Badge variant="success" className="absolute left-3 top-3 bg-card">
              <Check className="size-3" />
              {t("shell.selected")}
            </Badge>
          )}
          <span className="absolute bottom-3 right-3 rounded-full border bg-card p-2 text-foreground transition-colors group-hover:bg-accent">
            <Maximize2 className="size-4" />
          </span>
        </div>
        <div className="flex items-start justify-between gap-3 p-4">
          <div className="min-w-0">
            <h2 className="type-h3 truncate">{template.name}</h2>
            <p className="mt-1 text-xs text-muted-foreground">
              {template.styleFamily || "Modern"} · A4 ·{" "}
              {t(
                template.type === "CV"
                  ? "shell.resumeShort"
                  : "shell.letterShort",
              )}
            </p>
          </div>
          <div className="flex shrink-0 flex-col items-end gap-2">
          <Badge variant={template.plan === "PAID" ? "secondary" : "outline"}>
            {t(template.plan === "PAID" ? "shell.paidPlan" : "shell.freePlan")}
          </Badge>
          {template.markets?.[0] && <span className="max-w-24 truncate text-[10px] font-medium text-muted-foreground">{marketProfiles[template.markets[0] as ResumeMarket]?.shortLabel || template.markets[0]}</span>}
          </div>
        </div>
      </button>
      <PopupModal
        open={open}
        imageUrl={imageUrl}
        onClose={() => setOpen(false)}
        isSelected={selected}
        template={template}
        user={user}
      />
    </article>
  );
}
