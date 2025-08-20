"use client"
import { authClient } from "@/lib/auth-client";
import { Button } from "./ui/button"
import { useRouter } from "next/navigation";

export const Logout = () => {
    const route = useRouter();
    const handleLogout = async () => {
        try {
            await authClient.signOut();
            route.push("/login");
        } catch (error) {
            console.error("Logout failed:", error);
        }
    }
    return <Button onClick={handleLogout} className="bg-red-700 text-gray-200">Logout</Button>
}