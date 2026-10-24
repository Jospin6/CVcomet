import Link from "next/link";
import { ArrowUpRight } from "lucide-react";
import { Button } from "@/components/ui/button";
/** Pricing never hardcodes monetary amounts; billing/upgrade reads live configured Stripe prices. */
export default function Pricing() {
  return <div className="mx-auto max-w-3xl space-y-6 py-16 text-center">
    <p className="eyebrow">Pricing</p>
    <h1 className="type-display">Career support that scales with you.</h1>
    <p className="text-muted-foreground">Start free, then compare Pro and Career Pro with their actual recurring Stripe prices, allowances and billing periods.</p>
    <Button asChild><Link href="/upgrade">View plans and prices <ArrowUpRight/></Link></Button>
    <p className="text-xs text-muted-foreground">All subscription payments are completed through Stripe Checkout. Final prices, taxes and discounts are shown before payment.</p>
  </div>;
}
