"use client"
import { useCurrentUser } from "@/hooks/useCurrentUser";
import { fetchConversations } from "@/redux/conversation/conversationSlice";
import { AppDispatch, RootState } from "@/redux/store";
import { useEffect } from "react";
import { useDispatch, useSelector } from "react-redux";
import { SidebarMenuButton, SidebarMenuItem } from "./sidebar";
import { capitalize } from "@/lib/utils";

export const ConversationList = () => {
  const dispatch = useDispatch<AppDispatch>();
  const user = useCurrentUser();
  const conversations = useSelector((state: RootState) => state.conversation.conversations)


  useEffect(() => {
    if (!user?.id) {
      return
    }
    dispatch(fetchConversations({ userId: user.id }));
  }, [user?.id, dispatch]);
  return (
    <div className="flex flex-col gap-2 border-t border-gray-300 pt-2 mt-6">
      {conversations.map((item) => (
        <SidebarMenuItem key={item.id}>
          <SidebarMenuButton asChild>
            <a href={`/g/${item.id}`}>
              <span>{ item.title ? capitalize(item.title) : "New chat"}</span>
            </a>
          </SidebarMenuButton>
        </SidebarMenuItem>
      ))}
    </div>
  );
}