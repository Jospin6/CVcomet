"use client";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { useCurrentUser } from "@/hooks/useCurrentUser";
import { fetchConversations } from "@/redux/conversation/conversationSlice";
import type { AppDispatch, RootState } from "@/redux/store";
import { useEffect } from "react";
import { useDispatch, useSelector } from "react-redux";
import { useTranslation } from "react-i18next";
import { MessageSquare } from "lucide-react";
import {
  SidebarGroup,
  SidebarGroupLabel,
  SidebarMenu,
  SidebarMenuButton,
  SidebarMenuItem,
  useSidebar,
} from "./sidebar";
export function ConversationList() {
  const dispatch = useDispatch<AppDispatch>();
  const { user: user } = useCurrentUser();
  const { t } = useTranslation();
  const path = usePathname();
  const { setOpenMobile } = useSidebar();
  const conversations = useSelector(
    (state: RootState) => state.conversation.conversations,
  );
  useEffect(() => {
    if (user?.id) void dispatch(fetchConversations({ userId: user.id }));
  }, [user?.id, dispatch]);
  if (!user || !conversations.length) return null;
  return (
    <SidebarGroup>
      <SidebarGroupLabel className="text-[9px] uppercase tracking-wider">
        {t("shell.recent")}
      </SidebarGroupLabel>
      <SidebarMenu>
        {conversations.slice(0, 5).map((item) => (
          <SidebarMenuItem key={item.id}>
            <SidebarMenuButton asChild isActive={path === "/g/" + item.id}>
              <Link href={"/g/" + item.id} onClick={() => setOpenMobile(false)}>
                <MessageSquare aria-hidden="true" />
                <span>{item.title || t("shell.untitled")}</span>
              </Link>
            </SidebarMenuButton>
          </SidebarMenuItem>
        ))}
      </SidebarMenu>
    </SidebarGroup>
  );
}
