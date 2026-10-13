"use client"
import { logout } from "@/redux/auth/authSlice";
import { useDispatch } from "react-redux";
import type { AppDispatch } from "@/redux/store";
import { Button } from "./ui/button"
import { useRouter } from "next/navigation";

export const Logout = () => {
    const route = useRouter();
    const dispatch = useDispatch<AppDispatch>();
    const handleLogout = async () => {
        try {
            await dispatch(logout()).unwrap();
            route.replace("/login");
            route.refresh();
        } catch (error) {
            console.error("Logout failed:", error);
        }
    }
    return <Button onClick={handleLogout} className="bg-red-700 text-gray-200">Logout</Button>
}
