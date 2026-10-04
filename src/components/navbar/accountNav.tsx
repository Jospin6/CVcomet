"use client";
import Link from "next/link";
import { useDispatch } from "react-redux";
import { useRouter } from "next/navigation";
import { UserRound, LogOut, Settings, CreditCard, LogIn } from "lucide-react";
import { useTranslation } from "react-i18next";
import { toast } from "sonner";
import { useCurrentUser } from "@/hooks/useCurrentUser";
import { logout } from "@/redux/auth/authSlice";
import type { AppDispatch } from "@/redux/store";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuTrigger,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
} from "@/components/ui/dropdown-menu";

export function AccountNav() {
  const { user: user } = useCurrentUser();
  const { t } = useTranslation();
  const dispatch = useDispatch<AppDispatch>();
  const router = useRouter();
  const signOut = async () => {
    try {
      await dispatch(logout()).unwrap();
      router.replace("/login");
      router.refresh();
    } catch {
      toast.error(t("shell.actionError"));
    }
  };
  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button
          variant="outline"
          size="icon"
          className="rounded-full bg-secondary"
          aria-label={t("shell.profileMenu")}
          data-testid="profile-menu"
        >
          {user ? (
            <span className="text-xs font-semibold">
              {(user.name || user.email).slice(0, 2).toUpperCase()}
            </span>
          ) : (
            <UserRound />
          )}
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" className="w-60">
        <DropdownMenuLabel className="break-all">
          {user?.email || t("shell.guest")}
        </DropdownMenuLabel>
        <DropdownMenuSeparator />
        {user ? (
          <>
            <DropdownMenuItem asChild>
              <Link href="/dashboard/profile">
                <UserRound />
                {t("shell.careerProfile")}
              </Link>
            </DropdownMenuItem>
            <DropdownMenuItem asChild>
              <Link href="/settings">
                <Settings />
                {t("shell.settings")}
              </Link>
            </DropdownMenuItem>
            <DropdownMenuItem asChild>
              <Link href="/upgrade">
                <CreditCard />
                {t("shell.billing")}
              </Link>
            </DropdownMenuItem>
            <DropdownMenuSeparator />
            <DropdownMenuItem onSelect={signOut}>
              <LogOut />
              {t("shell.logout")}
            </DropdownMenuItem>
          </>
        ) : (
          <DropdownMenuItem asChild>
            <Link href="/login">
              <LogIn />
              {t("login")}
            </Link>
          </DropdownMenuItem>
        )}
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
