"use client";
import Link from "next/link";
import { usePathname, useSearchParams } from "next/navigation";
import {
  Orbit,
  Shield,
  Cpu,
  Gem,
  X,
} from "lucide-react";
import { useTranslation } from "react-i18next";
import { useCurrentUser } from "@/hooks/useCurrentUser";
import {
  Sidebar,
  SidebarContent,
  SidebarHeader,
  SidebarFooter,
  SidebarGroup,
  SidebarGroupLabel,
  SidebarMenu,
  SidebarMenuButton,
  SidebarMenuItem,
  useSidebar,
} from "@/components/ui/sidebar";
import { Button } from "@/components/ui/button";
import {
  navigationGroups,
  type NavigationItem,
} from "@/components/shell/navigation";
import Image from "next/image";

export function AppSidebar() {
  const { t } = useTranslation();
  const pathname = usePathname();
  const search = useSearchParams();
  const { user } = useCurrentUser();
  const { setOpenMobile, isMobile, state } = useSidebar();
  const compact = state === "collapsed" && !isMobile;
  const active = (item: NavigationItem) => {
    if (!item.href) return false;
    if (item.key === "overview")
      return pathname === "/" && !search.get("document");
    return pathname === item.href || (item.href !== "/" && pathname.startsWith(item.href + "/"));
  };
  const renderItem = (item: NavigationItem) => (
    <SidebarMenuItem key={item.key}>
      <SidebarMenuButton
        asChild={Boolean(item.href)}
        disabled={!item.href}
        isActive={active(item)}
        tooltip={t("shell." + item.key)}
        className="h-10 gap-3 rounded-lg text-[13px] transition-colors data-[active=true]:font-semibold"
        aria-label={compact ? t("shell." + item.key) : undefined}
      >
        {item.href ? (
          <Link
            href={item.href}
            aria-current={active(item) ? "page" : undefined}
            onClick={() => setOpenMobile(false)}
          >
            <item.icon aria-hidden="true" />
            <span>{t("shell." + item.key)}</span>
          </Link>
        ) : (
          <>
            <item.icon aria-hidden="true" />
            <span className="flex-1">{t("shell." + item.key)}</span>
            {!compact && (
              <span className="rounded border px-1 text-[9px]">
                {t("shell.soon")}
              </span>
            )}
          </>
        )}
      </SidebarMenuButton>
    </SidebarMenuItem>
  );
  return (
    <Sidebar collapsible="icon" className="border-border">
      <SidebarHeader className="gap-5 px-4 pt-6 pb-3 group-data-[collapsible=icon]:px-2">
        <div className="flex items-center justify-between">

          <Link
            href="/"
            aria-label="CVComet — Accueil"
            onClick={() => setOpenMobile(false)}
            className="
              flex h-12 items-center
              gap-2.5 rounded-lg
              transition-opacity duration-200
              hover:opacity-90
            "
          >
            {/* Logo */}
            <span
              className="
                relative flex size-10
                shrink-0 items-center
                justify-center
              "
            >
              <Image
                src="/images/cvcomet.png"
                alt="CVComet"
                width={40}
                height={40}
                className="
                  size-full object-contain
                "
                priority
              />
            </span>

            {/* Nom de l'application */}
            {!compact && (
              <span
                className="
                  whitespace-nowrap
                  text-[22px] font-bold
                  leading-none tracking-tight
                "
              >
                CVcomet
                <span className="text-primary">.</span>
              </span>
            )}
          </Link>
          {isMobile && (
            <Button
              variant="ghost"
              size="icon"
              aria-label={t("shell.close")}
              onClick={() => setOpenMobile(false)}
            >
              <X />
            </Button>
          )}
        </div>
      </SidebarHeader>
      <SidebarContent className="gap-0 px-2">
        {navigationGroups.map((group) => (
          <SidebarGroup key={group.key} className="py-1">
            {group.key !== "workspace" && (
              <SidebarGroupLabel className="text-[9px] uppercase tracking-[.12em]">
                {t("shell." + group.key)}
              </SidebarGroupLabel>
            )}
            <SidebarMenu>{group.items.map(renderItem)}</SidebarMenu>
          </SidebarGroup>
        ))}
        {user?.role === "ADMIN" && (
          <SidebarGroup>
            <SidebarMenu>
              {renderItem({ key: "admin", icon: Shield, href: "/admin" })}
              {renderItem({ key: "aiSettings", icon: Cpu, href: "/admin/ai" })}
            </SidebarMenu>
          </SidebarGroup>
        )}
      </SidebarContent>
      <SidebarFooter className="px-3 pb-4 pt-2 group-data-[collapsible=icon]:px-2">
        <SidebarMenu>
          <SidebarMenuItem>
            <SidebarMenuButton
              asChild
              tooltip="Upgrade"
              className="h-11 justify-center gap-2 rounded-lg bg-primary font-semibold text-primary-foreground shadow-sm shadow-primary/20 hover:bg-primary/90 hover:text-primary-foreground"
            >
              <Link href="/upgrade" onClick={() => setOpenMobile(false)}>
                <Gem className="size-4 shrink-0" aria-hidden="true" />
                <span>Upgrade</span>
              </Link>
            </SidebarMenuButton>
          </SidebarMenuItem>
        </SidebarMenu>
      </SidebarFooter>
    </Sidebar>
  );
}
