"use client"

import { useCurrentUser } from "@/hooks/useCurrentUser"
import { Avatar, AvatarFallback } from "@radix-ui/react-avatar"
import { User } from "lucide-react"
import Link from "next/link"
import LanguageSwitcher from "../ui/languageSwitcher"
import { useState } from "react"
import { LoadingIcon } from "../ui/loadingIcon"

export const AccountNav = () => {

    const currentUser = useCurrentUser()

    const [loading, setLoading] = useState<boolean>(false)
    const handleLoading = () => {
        setLoading(true);
        setTimeout(() => {
            setLoading(false);
        }, 3000);
    };


    return <div className="flex items-center gap-4">
        <LanguageSwitcher />
        {
            currentUser ? (
                <Avatar asChild className="cursor-pointer size-[30px] bg-yellow-800 rounded-full" onClick={handleLoading}>
                    {!loading ? (
                        <Link href="/profil">
                            <AvatarFallback className="font-bold w-full h-full flex items-center justify-center text-white">
                                {currentUser.email.charAt(0).toUpperCase()}
                            </AvatarFallback>
                        </Link>
                    ) : (
                        <LoadingIcon />
                    )}
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