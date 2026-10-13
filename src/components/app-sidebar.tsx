"use client";
import Link from "next/link";
import { usePathname, useSearchParams } from "next/navigation";
import {
  Orbit,
  Sparkles,
  ArrowUpRight,
  Shield,
  Cpu,
  UserRound,
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
  footerNavigation,
  type NavigationItem,
} from "@/components/shell/navigation";
import { ConversationList } from "@/components/ui/conversationList";

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
    return pathname === item.href;
  };
  const renderItem = (item: NavigationItem) => (
    <SidebarMenuItem key={item.key}>
      <SidebarMenuButton
        asChild={Boolean(item.href)}
        disabled={!item.href}
        isActive={active(item)}
        tooltip={t("shell." + item.key)}
        className="h-10 gap-3 text-[13px]"
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
            className="flex items-center gap-2.5"
            aria-label="CVcomet"
            onClick={() => setOpenMobile(false)}
          >
            <span className="flex size-8 shrink-0 items-center justify-center rounded-[10px] bg-primary text-primary-foreground">
              <Orbit className="size-6" />
            </span>
            {!compact && (
              <span className="text-2xl font-bold tracking-[-1px]">
                cvcomet<span className="text-primary">.</span>
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
        {!compact && (
          <div className="border-y py-3">
            <p className="text-xs font-semibold">{t("shell.workspace")}</p>
            <p className="mt-0.5 text-[11px] text-muted-foreground">
              {t("shell.workspaceDescription")}
            </p>
          </div>
        )}
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
        {!compact && <ConversationList />}
      </SidebarContent>
      <SidebarFooter className="gap-2 border-t p-3 group-data-[collapsible=icon]:p-2">
        {!compact && (
          <div className="mb-2 rounded-lg border bg-muted/60 p-3">
            <Sparkles className="mb-2 size-4 text-primary" />
            <p className="text-xs font-semibold">{t("shell.storyTitle")}</p>
            <Link
              href="/dashboard/profile"
              onClick={() => setOpenMobile(false)}
              className="mt-2 flex items-center justify-between text-[11px] text-primary"
            >
              {t("shell.completeProfile")}
              <ArrowUpRight className="size-3.5" />
            </Link>
          </div>
        )}
        <SidebarMenu>
          {footerNavigation.map(renderItem)}
          {renderItem({
            key: "profile",
            icon: UserRound,
            href: user ? "/dashboard/profile" : "/login",
          })}
        </SidebarMenu>
      </SidebarFooter>
    </Sidebar>
  );
}
