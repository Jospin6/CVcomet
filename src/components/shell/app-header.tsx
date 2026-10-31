"use client";
import { navigationGroups } from "./navigation";
import { usePathname } from "next/navigation";
import { useTranslation } from "react-i18next";
import { SidebarTrigger } from "@/components/ui/sidebar";
import { AccountNav } from "@/components/navbar/accountNav";

export function AppHeader() {
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
      <div className="flex shrink-0 items-center">
        <AccountNav />
      </div>
    </header>
  );
}
