"use client";
import { loadStripe } from "@stripe/stripe-js";
import { Button } from "./button";
import { useCurrentUser } from "@/hooks/useCurrentUser";
import { useTranslation } from "react-i18next";
import { useState } from "react";
import { toast } from "sonner";

export function SubscribeButton() {
  const { t } = useTranslation();
  const { user: user } = useCurrentUser();
  const [loading, setLoading] = useState(false);
  async function subscribe() {
    if (!user?.id) return;
    setLoading(true);
    try {
      const response = await fetch("/api/stripe/checkout", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          priceId: process.env.NEXT_PUBLIC_PRICE_ID,
          userId: user.id,
        }),
      });
      if (!response.ok) throw new Error("Checkout unavailable");
      const session = await response.json();
      if (session.url) {
        window.location.assign(session.url);
        return;
      }
      const key = process.env.NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY;
      if (!key) throw new Error("Checkout configuration unavailable");
      const stripe = await loadStripe(key);
      if (!stripe) throw new Error("Checkout unavailable");
      const result = await stripe.redirectToCheckout({
        sessionId: session.sessionId,
      });
      if (result.error) throw result.error;
    } catch {
      toast.error(t("shell.actionError"));
    } finally {
      setLoading(false);
    }
  }
  return (
    <Button
      onClick={subscribe}
      disabled={loading || !user?.id}
      className="w-full"
    >
      {t(loading ? "shell.loading" : "upgradePlan")}
    </Button>
  );
}
