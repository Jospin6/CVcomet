"use client";
import { useEffect, useState } from "react";
import Link from "next/link";
import { useTheme } from "next-themes";
import { useTranslation } from "react-i18next";
import { Monitor, Moon, Sun, ArrowUpRight, Globe2, CreditCard } from "lucide-react";
import { PageHeader, SectionHeader } from "@/components/ui/page-header";
import { Button } from "@/components/ui/button";
import LanguageSwitcher from "@/components/ui/languageSwitcher";

export default function SettingsPage() {
  const { t } = useTranslation();
  const { theme, setTheme } = useTheme();
  const [mounted, setMounted] = useState(false);
  const [portfolio, setPortfolio] = useState({ slug: "", public: false });
  const [portfolioMessage, setPortfolioMessage] = useState("");
  useEffect(() => { setMounted(true); fetch("/api/portfolio").then(r => r.ok ? r.json() : null).then(v => v && setPortfolio({ slug: v.portfolioSlug || "", public: Boolean(v.portfolioPublic) })); }, []);
  const activeTheme = mounted ? theme : undefined;
  return (
    <div className="mx-auto max-w-4xl">
      <PageHeader
        eyebrow={t("shell.settings")}
        title={t("shell.settingsTitle")}
        description={t("shell.settingsDescription")}
      />
      <section className="app-section mb-6">
        <SectionHeader
          title={t("shell.appearance")}
          description={t("shell.themeDescription")}
        />
        <div
          className="grid gap-3 sm:grid-cols-3"
          role="group"
          aria-label={t("shell.appearance")}
        >
          {[
            { value: "light", icon: Sun },
            { value: "dark", icon: Moon },
            { value: "system", icon: Monitor },
          ].map(({ value, icon: Icon }) => (
            <Button
              key={value}
              variant={activeTheme === value ? "default" : "outline"}
              aria-pressed={activeTheme === value}
              onClick={() => setTheme(value)}
              className="h-16"
            >
              <Icon />
              {t("shell." + value)}
            </Button>
          ))}
        </div>
      </section>
      <section className="app-section mb-6">
        <SectionHeader
          title={t("shell.language")}
          description={t("shell.languageDescription")}
          action={<LanguageSwitcher />}
        />
      </section>

      <section className="app-section mb-6">
        <SectionHeader title="Public portfolio" description="Publish a clean profile from your confirmed Career Profile. It stays private until you explicitly enable it." />
        <div className="grid gap-3 sm:grid-cols-[1fr_auto]">
          <label className="text-sm font-medium">Public slug<input className="mt-2 h-10 w-full rounded-md border bg-background px-3" value={portfolio.slug} onChange={e=>setPortfolio({...portfolio,slug:e.target.value.toLowerCase().replace(/[^a-z0-9-]/g,"")})} placeholder="your-name" /></label>
          <label className="flex items-end gap-2 pb-2 text-sm"><input type="checkbox" checked={portfolio.public} onChange={e=>setPortfolio({...portfolio,public:e.target.checked})}/> Public</label>
        </div>
        <div className="mt-4 flex flex-wrap items-center gap-3"><Button onClick={async()=>{setPortfolioMessage("Saving…");const r=await fetch("/api/portfolio",{method:"PUT",headers:{"content-type":"application/json"},body:JSON.stringify(portfolio)});setPortfolioMessage(r.ok?"Saved":"Could not save")}}><Globe2/>Save portfolio</Button>{portfolio.public&&portfolio.slug&&<Button variant="outline" asChild><Link href={`/u/${portfolio.slug}`} target="_blank">Open portfolio<ArrowUpRight/></Link></Button>}<span className="text-xs text-muted-foreground">{portfolioMessage}</span></div>
      </section>
      <section className="app-section mb-6">
        <SectionHeader title="Billing" description="Manage your Stripe subscription securely in the hosted customer portal." />
        <Button variant="outline" onClick={async()=>{const r=await fetch("/api/billing/portal",{method:"POST"});const d=await r.json();if(r.ok&&d.url) location.href=d.url;}}><CreditCard/>Manage billing</Button>
      </section>
      <section className="app-section">
        <SectionHeader
          title={t("shell.account")}
          description={t("shell.accountDescription")}
        />
        <div className="flex flex-wrap gap-3">
          <Button asChild variant="outline">
            <Link href="/dashboard/profile">
              {t("shell.careerProfile")}
              <ArrowUpRight />
            </Link>
          </Button>
          <Button asChild variant="outline">
            <Link href="/upgrade">
              {t("shell.billing")}
              <ArrowUpRight />
            </Link>
          </Button>
        </div>
      </section>
    </div>
  );
}
