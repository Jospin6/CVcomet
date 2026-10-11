"use client";
import Link from "next/link";
import { useTranslation } from "react-i18next";
import {
  ContactRound,
  Sparkles,
  PanelsTopLeft,
  Download,
  ArrowUpRight,
} from "lucide-react";
import { PageHeader, SectionHeader } from "@/components/ui/page-header";
import { Button } from "@/components/ui/button";
export default function HelpPage() {
  const { t } = useTranslation();
  return (
    <div className="mx-auto max-w-4xl">
      <PageHeader
        eyebrow={t("shell.help")}
        title={t("shell.helpTitle")}
        description={t("shell.helpDescription")}
      />
      <div className="grid gap-5 sm:grid-cols-2">
        {[
          { key: "Profile", icon: ContactRound, href: "/dashboard/profile" },
          { key: "Create", icon: Sparkles, href: "/dashboard/resumes" },
          { key: "Templates", icon: PanelsTopLeft, href: "/templates" },
          { key: "Export", icon: Download },
        ].map(({ key, icon: Icon, href }) => (
          <section className="app-section" key={key}>
            <Icon className="mb-5 size-5 text-primary" />
            <h2 className="type-h3">{t("shell.help" + key + "Title")}</h2>
            <p className="mt-3 text-sm leading-relaxed text-muted-foreground">
              {t("shell.help" + key + "Body")}
            </p>
            {href && (
              <Button variant="link" className="mt-3 px-0" asChild>
                <Link href={href}>
                  {t("shell.open")}
                  <ArrowUpRight />
                </Link>
              </Button>
            )}
          </section>
        ))}
      </div>
      <section className="app-section mt-6">
        <SectionHeader title={t("shell.shortcuts")} />
        <dl className="space-y-4 text-sm">
          <div className="flex justify-between gap-4">
            <dt>{t("shell.paletteShortcut")}</dt>
            <dd>
              <kbd className="rounded border bg-muted px-2 py-1 text-xs">
                Ctrl / ? K
              </kbd>
            </dd>
          </div>
          <div className="flex justify-between gap-4">
            <dt>{t("shell.sidebarShortcut")}</dt>
            <dd>
              <kbd className="rounded border bg-muted px-2 py-1 text-xs">
                Ctrl / ? B
              </kbd>
            </dd>
          </div>
        </dl>
      </section>
    </div>
  );
}
