"use client";

import { useCurrentUser } from "@/hooks/useCurrentUser";
import { Avatar, AvatarFallback } from "../ui/avatar";
import { User } from "lucide-react";
import Link from "next/link";
import LanguageSwitcher from "../ui/languageSwitcher";

export const AccountNav = () => {
  const { user, loading } = useCurrentUser();
  return <div className="flex items-center gap-4">
    <LanguageSwitcher />
    <Link href={user ? "/profil" : "/login"} aria-label={user ? "Profile" : "Login"}>
      <Avatar className={`cursor-pointer size-[30px] rounded-full ${user ? "bg-yellow-800" : "bg-red-800"}`}>
        <AvatarFallback className="font-bold w-full h-full flex items-center justify-center text-white">
          {loading ? "?" : user ? user.email.charAt(0).toUpperCase() : <User size={18} />}
        </AvatarFallback>
      </Avatar>
    </Link>
  </div>;
};
