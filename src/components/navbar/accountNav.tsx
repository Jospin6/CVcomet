"use client"

import { useCurrentUser } from "@/hooks/useCurrentUser"
import { Avatar, AvatarFallback } from "@radix-ui/react-avatar"
import { User } from "lucide-react"
import Link from "next/link"
import LanguageSwitcher from "../ui/languageSwitcher"

export const AccountNav = () => {

    const currentUser = useCurrentUser()


    return <div className="flex items-center gap-4">
        <LanguageSwitcher />
        {
            currentUser ? (
                <Avatar asChild className="cursor-pointer size-[30px] bg-yellow-800 rounded-full">
                    <Link href="/profil">
                        <AvatarFallback className="font-bold w-full h-full flex items-center justify-center text-white">
                            {currentUser.email.charAt(0).toUpperCase()}
                        </AvatarFallback>
                    </Link>
                </Avatar>)
                : (
                    <Link href={"/login"}>
                        <Avatar className="cursor-pointer size-[30px] rounded-full bg-red-800">
                            <AvatarFallback className="font-bold w-full h-full flex items-center justify-center text-white">
                                <User size={18} />
                            </AvatarFallback>
                        </Avatar>
                    </Link>
                )
        }

    </div>
}