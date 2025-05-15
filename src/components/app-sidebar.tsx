"use client"
import { Home, User, ArrowUpCircle, LayoutDashboard } from "lucide-react"
import { useTranslation } from 'react-i18next';

import {
  Sidebar,
  SidebarContent,
  SidebarGroup,
  SidebarGroupContent,
  SidebarGroupLabel,
  SidebarMenu,
  SidebarMenuButton,
  SidebarMenuItem,
} from "@/components/ui/sidebar"
import { ConversationList } from "./ui/conversationList"
import Link from "next/link";

export function AppSidebar() {
  const { t } = useTranslation();
  // Menu items.
  const items = [
    {
      title: `${t("home")}`,
      url: "/",
      icon: Home,
    },
    {
      title: `${t("profil")}`,
      url: "/profil",
      icon: User,
    },
    {
      title: `${t("templates")}`,
      url: "/templates",
      icon: LayoutDashboard,
    },
    {
      title: `${t("upgrade")}`,
      url: "/upgrade",
      icon: ArrowUpCircle,
    }
  ]
  return (
    <Sidebar className="border-none">
      <SidebarContent className="bg-[#1a1a1a] text-white">
        <SidebarGroup>
          <div className="h-16 flex items-center ">
            <SidebarGroupLabel className="text-2xl text-white font-bold">SmartCV</SidebarGroupLabel>
          </div>
          <SidebarGroupContent>
            <SidebarMenu>
              {items.map((item) => (
                <SidebarMenuItem key={item.title}>
                  <SidebarMenuButton asChild>
                    <Link href={item.url}>
                      <item.icon />
                      <span>{item.title}</span>
                    </Link>
                  </SidebarMenuButton>
                </SidebarMenuItem>
              ))}
              <ConversationList />
            </SidebarMenu>
          </SidebarGroupContent>
        </SidebarGroup>
      </SidebarContent>
    </Sidebar>
  )
}