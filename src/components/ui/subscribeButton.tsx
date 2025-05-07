import { loadStripe } from "@stripe/stripe-js";
import { Button } from "./button";
import { useCurrentUser } from "@/hooks/useCurrentUser";
import { useTranslation } from 'react-i18next';

const stripePromise = loadStripe(process.env.NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY!);

export const SubscribeButton = () => {
  const { t } = useTranslation();
    const user = useCurrentUser(); 
  const handleSubscribe = async () => {
    const res = await fetch("/api/stripe/checkout", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        priceId: process.env.NEXT_PUBLIC_PRICE_ID,
        userId: user?.id, 
      }),
    });

    if (!res.ok) {
      console.log("Erreur pendant la création de la session");
      return;
    }

    const session = await res.json(); // On attend un sessionId pur

    const stripe = await stripePromise;
    if (session.url) {
      window.location.href = session.url;
      return;
    }
    if (!stripe) {
      console.log("Stripe non chargé");
      return;
    }

    const { error } = await stripe.redirectToCheckout({ sessionId: session.sessionId });
    if (error) {
      console.log(error.message);
    }
  };

  return <Button onClick={handleSubscribe} className="w-full bg-yellow-500 text-white hover:bg-yellow-600 text-lg py-6">
    {t("upgradePlan")}
    </Button>
};
