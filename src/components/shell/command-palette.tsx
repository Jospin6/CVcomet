"use client";
import { useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { Search, ArrowUpRight } from "lucide-react";
import { useTranslation } from "react-i18next";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { commandActions } from "./navigation";

export function CommandPalette({
  open,
  onOpenChange,
}: {
  open: boolean;
  onOpenChange: (_open: boolean) => void;
}) {
  const { t } = useTranslation();
  const router = useRouter();
  const [query, setQuery] = useState("");
  const input = useRef<HTMLInputElement>(null);
  const list = useRef<HTMLDivElement>(null);
  useEffect(() => {
    if (open) setQuery("");
  }, [open]);
  const normalize = (value: string) => value.toLocaleLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "");
  const words = normalize(query.trim()).split(/\s+/).filter(Boolean);
  const actions = commandActions.filter((item) => words.every(word => normalize(t("shell." + item.key)).includes(word)));
  const move = (direction: number) => {
    const buttons = Array.from(
      list.current?.querySelectorAll<HTMLButtonElement>(
        "button:not(:disabled)",
      ) ?? [],
    );
    if (!buttons.length) return;
    const current = buttons.indexOf(
      document.activeElement as HTMLButtonElement,
    );
    if (current === -1) {
      buttons[direction === 1 ? 0 : buttons.length - 1]?.focus();
      return;
    }
    buttons[(current + direction + buttons.length) % buttons.length]?.focus();
  };
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent
        className="gap-0 overflow-hidden p-0 sm:max-w-xl"
        onOpenAutoFocus={(event) => {
          event.preventDefault();
          input.current?.focus();
        }}
      >
        <DialogHeader className="px-6 pt-6 pb-4">
          <DialogTitle>{t("shell.commandTitle")}</DialogTitle>
          <DialogDescription>{t("shell.commandDescription")}</DialogDescription>
        </DialogHeader>
        <div className="relative border-y px-5 py-3">
          <Search
            className="absolute left-8 top-6 size-4 text-muted-foreground"
            aria-hidden="true"
          />
          <Input
            ref={input}
            value={query}
            onChange={(event) => setQuery(event.target.value)}
            placeholder={t("shell.searchActions")}
            aria-label={t("shell.searchActions")}
            className="border-0 pl-10 shadow-none"
            onKeyDown={(event) => {
              if (event.key === "ArrowDown" || event.key === "ArrowUp") {
                event.preventDefault();
                move(event.key === "ArrowDown" ? 1 : -1);
              }
              if (event.key === "Enter") {
                event.preventDefault();
                const focused = document.activeElement;
                const buttons = list.current?.querySelectorAll<HTMLButtonElement>("button:not(:disabled)");
                const target = focused instanceof HTMLButtonElement && list.current?.contains(focused)
                  ? focused : buttons?.[0];
                target?.click();
              }
            }}
          />
        </div>
        <div
          ref={list}
          className="max-h-[50dvh] overflow-y-auto p-2"
          onKeyDown={(event) => {
            if (event.key === "ArrowDown" || event.key === "ArrowUp") {
              event.preventDefault();
              move(event.key === "ArrowDown" ? 1 : -1);
            }
          }}
        >
          {actions.map(({ key, icon: Icon, href }) => (
            <button
              key={key}
              type="button"
              disabled={!href}
              onClick={() => {
                if (href) {
                  onOpenChange(false);
                  router.push(href);
                }
              }}
              className="flex min-h-12 w-full items-center gap-3 rounded-lg px-4 py-3 text-left text-sm hover:bg-accent disabled:cursor-not-allowed disabled:text-muted-foreground disabled:opacity-65"
            >
              <Icon className="size-4 shrink-0" aria-hidden="true" />
              <span className="flex-1">{t("shell." + key)}</span>
              {href ? (
                <ArrowUpRight className="size-4" aria-hidden="true" />
              ) : (
                <Badge variant="outline">{t("shell.soon")}</Badge>
              )}
            </button>
          ))}
          {actions.length === 0 && (
            <p
              className="px-4 py-8 text-center text-sm text-muted-foreground"
              role="status"
            >
              {t("shell.noActions")}
            </p>
          )}
        </div>
        <div className="border-t px-6 py-3 text-xs text-muted-foreground">
          {t("shell.commandHint")}
        </div>
      </DialogContent>
    </Dialog>
  );
}
