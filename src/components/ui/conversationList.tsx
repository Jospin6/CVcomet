"use client"
import { useCurrentUser } from "@/hooks/useCurrentUser";
import { fetchConversations } from "@/redux/conversation/conversationSlice";
import { AppDispatch, RootState } from "@/redux/store";
import { useEffect } from "react";
import { useDispatch, useSelector } from "react-redux";
import { SidebarMenuButton, SidebarMenuItem } from "./sidebar";

export const ConversationList = () => {
  const dispatch = useDispatch<AppDispatch>();
  const user = useCurrentUser();
  const conversations = useSelector((state: RootState) => state.conversation.conversations)


  useEffect(() => {
    if (!user?.id) {
      return
    }
    dispatch(fetchConversations({ userId: user.id }));
  }, [user?.id])
  return (
    <div className="flex flex-col gap-2">
      <div className="flex items-center justify-between">
        <h2 className="text-lg font-semibold">Conversations</h2>
      </div>
      {conversations.map((item) => (
        <SidebarMenuItem key={item.id}>
          <SidebarMenuButton asChild>
            <a href={`/g/${item.id}`}>
              <span>{`${item.content.slice(0, 30)}...`}</span>
            </a>
          </SidebarMenuButton>
        </SidebarMenuItem>
      ))}
    </div>
  );
}