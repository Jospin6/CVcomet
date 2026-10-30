"use client";
import Link from "next/link";
import { navigationGroups } from "./navigation";
import { usePathname } from "next/navigation";
import { Search, Bell, Check, Sparkles } from "lucide-react";
import { useTranslation } from "react-i18next";
import { Button } from "@/components/ui/button";
import { SidebarTrigger } from "@/components/ui/sidebar";
import {
  DropdownMenu,
  DropdownMenuTrigger,
  DropdownMenuContent,
  DropdownMenuLabel,
} from "@/components/ui/dropdown-menu";
import { AccountNav } from "@/components/navbar/accountNav";
import { ThemeSwitcher } from "./theme-switcher";

export function AppHeader({ onSearch }: { onSearch: () => void }) {
  const pathname = usePathname();
  const { t } = useTranslation();
  const key = pathname.startsWith("/g/")
    ? "documents"
    : (
        {
          "/": "overview",
          "/profil": "careerProfile",
          "/dashboard/profile": "careerProfile",
          "/dashboard/application-agent": "applicationAgent",
          "/dashboard/resumes": "documents",
          "/dashboard/cover-letters": "coverLetters",
          "/onboarding": "careerProfile",
          "/templates": "templates",
          "/upgrade": "billing",
          "/settings": "settings",
          "/help": "help",
          "/admin": "admin",
          "/admin/ai": "aiSettings",
          "/unauthorized": "accessDenied",
        } as Record<string, string>
      )[pathname] || navigationGroups.flatMap(group => group.items).find(item => item.href && item.href !== "/" && (pathname === item.href || pathname.startsWith(item.href + "/")))?.key || "overview";
  return (
    <header className="app-header flex shrink-0 items-center justify-between gap-2 px-3 sm:px-6 lg:px-10">
      <div className="flex min-w-0 items-center gap-2 sm:gap-4">
        <SidebarTrigger
          className="size-10 shrink-0"
          aria-label={t("shell.toggleNavigation")}
        />
        <nav aria-label={t("shell.breadcrumb")} className="min-w-0">
          <ol className="flex items-center gap-3 text-xs">
            <li className="truncate" aria-current="page">
              {t("shell." + key)}
            </li>
          </ol>
        </nav>
      </div>
      <div className="flex shrink-0 items-center gap-0.5 sm:gap-2">
        <Button variant="outline" size="sm" asChild className="hidden gap-1.5 sm:inline-flex">
          <Link href="/dashboard/assistant"><Sparkles className="size-4" aria-hidden="true"/>{t("shell.assistant")}</Link>
        </Button>
        <Button
          variant="ghost"
          onClick={onSearch}
          aria-label={t("shell.commandTitle")}
          className="size-10 px-0 md:w-auto md:gap-3 md:px-3"
          data-testid="command-trigger"
        >
          <Search />
          <span className="hidden text-xs text-muted-foreground md:inline">
            {t("shell.quickAccess")}
          </span>
          <kbd className="hidden rounded border px-1.5 py-0.5 text-[10px] text-muted-foreground lg:inline">
            Ctrl / Cmd K
          </kbd>
        </Button>
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button
              variant="ghost"
              size="icon"
              aria-label={t("shell.notifications")}
            >
              <Bell />
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end" className="w-72">
            <DropdownMenuLabel>{t("shell.notifications")}</DropdownMenuLabel>
            <div className="px-4 py-5 text-center">
              <Check className="mx-auto mb-3 size-5 text-primary" />
              <p className="text-sm font-medium">
                {t("shell.noNotifications")}
              </p>
              <p className="mt-1 text-xs text-muted-foreground">
                {t("shell.notificationDescription")}
              </p>
            </div>
          </DropdownMenuContent>
        </DropdownMenu>
        <ThemeSwitcher />
        <AccountNav />
      </div>
    </header>
  );
}
