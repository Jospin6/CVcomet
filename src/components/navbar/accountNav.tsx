"use client"
import {
    AlertDialog,
    AlertDialogCancel,
    AlertDialogContent,
    AlertDialogFooter,
    AlertDialogHeader,
    AlertDialogTitle,
    AlertDialogTrigger,
} from "@/components/ui/alert-dialog"
import { useCurrentUser } from "@/hooks/useCurrentUser"
import { Avatar, AvatarFallback } from "@radix-ui/react-avatar"
import { User } from "lucide-react"
import LoginPage from "../forms/userForm"
import Link from "next/link"

export const AccountNav = () => {

    const currentUser = useCurrentUser()


    return currentUser ? (
        <Avatar asChild className="cursor-pointer size-[30px] rounded-full bg-black/50">
            <Link href="/profil">
                <AvatarFallback className="font-bold w-full h-full flex items-center justify-center text-white">
                    {currentUser.email.charAt(0).toUpperCase()}
                </AvatarFallback>
            </Link>
        </Avatar>)
        : (
            <AlertDialog>
                <AlertDialogTrigger>
                    <Avatar className="cursor-pointer size-[30px] rounded-full bg-black/50">
                        <AvatarFallback className="font-bold w-full h-full flex items-center justify-center text-white">
                            <User size={18} />
                        </AvatarFallback>
                    </Avatar>
                </AlertDialogTrigger>
                <AlertDialogContent>
                    <AlertDialogHeader>
                        <AlertDialogTitle>Connexion</AlertDialogTitle>
                    </AlertDialogHeader>
                    <LoginPage />
                    <AlertDialogFooter>
                        <AlertDialogCancel>Cancel</AlertDialogCancel>
                    </AlertDialogFooter>
                </AlertDialogContent>
            </AlertDialog>
        )
}