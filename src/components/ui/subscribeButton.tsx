"use client";
import { Button } from "./button";
import { useCurrentUser } from "@/hooks/useCurrentUser";
import { useTranslation } from "react-i18next";
import { useState } from "react";
import { toast } from "sonner";

export function SubscribeButton() {
  const { t } = useTranslation();
  const { user } = useCurrentUser();
  const [loading, setLoading] = useState(false);
  async function subscribe() {
    if (!user?.id) return;
    setLoading(true);
    try {
      const response = await fetch("/api/stripe/checkout", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ plan: "PRO" }),
      });
      const data: { url?: string } = await response.json().catch(() => ({}));
      if (!response.ok || !data.url || !/^https:\/\//.test(data.url)) throw new Error("Checkout unavailable");
      window.location.assign(data.url);
    } catch {
      toast.error(t("shell.actionError"));
      setLoading(false);
    }
  }
  return <Button onClick={subscribe} disabled={loading || !user?.id} className="w-full">{t(loading ? "shell.loading" : "upgradePlan")}</Button>;
}
