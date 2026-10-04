"use client";
import Image from "next/image";
import Link from "next/link";
import { useDispatch } from "react-redux";
import { useState } from "react";
import { Check, Loader2 } from "lucide-react";
import { toast } from "sonner";
import { useTranslation } from "react-i18next";
import type { AppDispatch } from "@/redux/store";
import { updateCurrentTemplate, type User } from "@/redux/user/userSlice";
import type { Template } from "@/redux/template/templateSlice";
import { Button } from "./button";
import { Badge } from "./badge";
import { UpdatePlanForm } from "./updatePlanForm";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from "./dialog";

export function PopupModal({
  open,
  imageUrl,
  onClose,
  isSelected,
  template,
  user,
}: {
  open: boolean;
  imageUrl: string;
  onClose: () => void;
  isSelected: boolean;
  template: Template;
  user?: User;
}) {
  const dispatch = useDispatch<AppDispatch>();
  const { t } = useTranslation();
  const [busy, setBusy] = useState(false);
  const accents = template.accentColors?.length ? template.accentColors : ["#173F35", "#1E4B8F", "#6B4F3A", "#111827"];
  const [accent, setAccent] = useState(template.type === "CV" ? (user?.templateAccent || accents[0]) : (user?.coverLetterAccent || accents[0]));
  const allowed = template.plan === "FREE" || user?.isSubscribed;
  async function select() {
    if (!user?.id || !allowed) return;
    setBusy(true);
    try {
      await dispatch(
        updateCurrentTemplate({
          id: user.id,
          type: template.type,
          currentTemplateId: template.id,
          accent,
        }),
      ).unwrap();
      toast.success(t("shell.templateSelected"));
      onClose();
    } catch {
      toast.error(t("shell.actionError"));
    } finally {
      setBusy(false);
    }
  }
  return (
    <Dialog
      open={open}
      onOpenChange={(value) => {
        if (!value) onClose();
      }}
    >
      <DialogContent className="sm:max-w-4xl">
        <DialogHeader>
          <DialogTitle>{template.name}</DialogTitle>
          <DialogDescription>{t("shell.previewDescription")}</DialogDescription>
        </DialogHeader>
        <div className="grid min-w-0 gap-6 md:grid-cols-[minmax(0,1.5fr)_minmax(0,1fr)]">
          <div className="flex justify-center rounded-lg border bg-muted p-4">
            <div className="document-paper relative aspect-[210/297] max-h-[62vh] w-full">
              <Image
                src={imageUrl}
                alt={t("shell.preview") + ": " + template.name}
                fill
                unoptimized
                sizes="(max-width: 767px) 80vw, 450px"
                className="object-contain"
              />
            </div>
          </div>
          <div className="flex flex-col gap-4 py-2">
            <Badge variant="secondary">
              {t(
                template.plan === "PAID" ? "shell.paidPlan" : "shell.freePlan",
              )}{" "}
              · A4
            </Badge>
            <h3 className="type-h2">{t("plan")}</h3>
            <p className="text-sm leading-relaxed text-muted-foreground">
              {t("planDescription")}
            </p>
            <p className="text-sm leading-relaxed text-muted-foreground">
              {t("freeDetail")}
              <br />
              {t("premiumDetail")}
            </p>
            {template.customizable !== false && <div className="rounded-xl border bg-muted/30 p-4">
              <p className="text-sm font-semibold">Personalize accent</p><p className="mt-1 text-xs text-muted-foreground">Keep the layout recruiter-friendly while making the document yours.</p>
              <div className="mt-3 flex flex-wrap gap-2">{accents.map(color => <button key={color} type="button" onClick={() => setAccent(color)} aria-label={`Use ${color}`} className={`size-8 rounded-full border-2 transition ${accent === color ? "ring-2 ring-primary ring-offset-2" : ""}`} style={{ backgroundColor: color }} />)}</div>
            </div>}
            {user?.role === "ADMIN" && (
              <UpdatePlanForm defaultPlan={template.plan} id={template.id} />
            )}
            {!user ? (
              <Button disabled>{t("shell.loading")}</Button>
            ) : allowed ? (
              <Button onClick={select} disabled={busy || isSelected}>
                {busy ? (
                  <Loader2 className="animate-spin" />
                ) : isSelected ? (
                  <Check />
                ) : null}
                {t(isSelected ? "shell.selected" : "shell.selectTemplate")}
              </Button>
            ) : (
              <Button asChild>
                <Link href="/upgrade">{t("cta")}</Link>
              </Button>
            )}
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
