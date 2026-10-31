"use client";
import { useEffect, useState } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { Orbit } from "lucide-react";
import { useTranslation } from "react-i18next";
import { AppSidebar } from "@/components/app-sidebar";
import { SidebarProvider } from "@/components/ui/sidebar";
import { Toaster } from "@/components/ui/sonner";
import LanguageSwitcher from "@/components/ui/languageSwitcher";
import { AppHeader } from "./app-header";
import { CommandPalette } from "./command-palette";

export function AppShell({ children }: { children: React.ReactNode }) {
  const { t, i18n } = useTranslation();
  const pathname = usePathname();
  const [commandsOpen, setCommandsOpen] = useState(false);
  const authPage = pathname === "/login" || pathname === "/signup";
  useEffect(() => {
    document.documentElement.lang = i18n.resolvedLanguage?.startsWith("fr")
      ? "fr"
      : "en";
  }, [i18n.resolvedLanguage]);
  useEffect(() => {
    const listener = (event: KeyboardEvent) => {
      if ((event.ctrlKey || event.metaKey) && event.key.toLowerCase() === "k") {
        event.preventDefault();
        setCommandsOpen((value) => !value);
      }
    };
    window.addEventListener("keydown", listener);
    return () => window.removeEventListener("keydown", listener);
  }, []);
  return (
    <>
      <a className="skip-link" href="#main-content">
        {t("shell.skipContent")}
      </a>
      {authPage ? (
        <div className="min-h-svh">
          <header className="app-header flex items-center justify-between px-5 sm:px-10">
            <Link
              href="/"
              className="flex items-center gap-2 text-xl font-bold tracking-tight"
            >
              <Orbit className="text-primary" />
              cvcomet.
            </Link>
            <div className="flex items-center gap-2">
              <LanguageSwitcher />
            </div>
          </header>
          <main
            id="main-content"
            tabIndex={-1}
            className="mx-auto flex min-h-[calc(100svh-70px)] max-w-6xl items-center justify-center px-4 py-10"
          >
            {children}
          </main>
        </div>
      ) : (
        <SidebarProvider
          style={
            {
              "--sidebar-width": "15rem",
              "--sidebar-width-icon": "3.5rem",
            } as React.CSSProperties
          }
        >
          <AppSidebar />
          <div className="flex min-w-0 flex-1 flex-col">
            <AppHeader />
            <main
              id="main-content"
              tabIndex={-1}
              className="app-content flex-1"
            >
              {children}
            </main>
            <footer className="mx-4 flex flex-wrap items-center justify-between gap-2 border-t py-5 text-[11px] text-muted-foreground sm:mx-7 lg:mx-10">
              <span>
                CVcomet <span className="px-2">/</span>
                {t("shell.footer")}
              </span>
              <Link href="/help" className="hover:text-primary">
                {t("shell.help")}
              </Link>
            </footer>
          </div>
        </SidebarProvider>
      )}
      <CommandPalette open={commandsOpen} onOpenChange={setCommandsOpen} />
      <Toaster richColors position="bottom-right" />
    </>
  );
}
