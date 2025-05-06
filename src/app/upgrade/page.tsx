"use client"
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Check, X } from "lucide-react";
import { SubscribeButton } from "@/components/ui/subscribeButton";

export default function UpgradePage() {
    return (
        <div className="min-h-[90vh] flex items-center justify-center p-6">
            <div className="max-w-4xl w-full grid md:grid-cols-2 gap-8">
                {/* Freemium Plan */}
                <Card className="border-2 border-gray-300 rounded-2xl shadow-sm">
                    <CardContent className="p-8">
                        <h2 className="text-2xl font-bold mb-4">Freemium</h2>
                        <p className="text-gray-600 mb-6">Generate up to 6 CVs & Cover Letters per day for free.</p>
                        <ul className="space-y-3 mb-6">
                            <li className="flex items-center gap-2"><Check className="text-green-500 w-5 h-5" /> Up to 6 CVs/day</li>
                            <li className="flex items-center gap-2"><Check className="text-green-500 w-5 h-5" /> Up to 6 Cover Letters/day</li>
                            <li className="flex items-center gap-2"><X className="text-red-500 w-5 h-5" /> Unlimited generation</li>
                            <li className="flex items-center gap-2"><X className="text-red-500 w-5 h-5" /> Priority support</li>
                        </ul>
                        <Button variant="outline" className="w-full" disabled>Current Plan</Button>
                    </CardContent>
                </Card>

                {/* Premium Plan */}
                <Card className="border-2 border-yellow-500 rounded-2xl shadow-lg bg-white">
                    <CardContent className="p-8">
                        <h2 className="text-2xl font-bold mb-4 text-yellow-600">Premium</h2>
                        <p className="text-gray-700 mb-6">Enjoy unlimited CV & Cover Letter generation for only <span className="font-semibold">$9.99/month</span>.</p>
                        <ul className="space-y-3 mb-6">
                            <li className="flex items-center gap-2"><Check className="text-green-500 w-5 h-5" /> Unlimited CVs/day</li>
                            <li className="flex items-center gap-2"><Check className="text-green-500 w-5 h-5" /> Unlimited Cover Letters/day</li>
                            <li className="flex items-center gap-2"><Check className="text-green-500 w-5 h-5" /> Priority support</li>
                            <li className="flex items-center gap-2"><Check className="text-green-500 w-5 h-5" /> Access to new features first</li>
                        </ul>
                        <SubscribeButton/>
                    </CardContent>
                </Card>
            </div>
        </div>
    );
}
