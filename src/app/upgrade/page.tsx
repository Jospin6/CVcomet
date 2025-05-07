"use client"
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Check, X } from "lucide-react";
import { SubscribeButton } from "@/components/ui/subscribeButton";
import { useTranslation } from 'react-i18next';

export default function UpgradePage() {
    const { t } = useTranslation();
    return (
        <div className="min-h-[90vh] flex items-center justify-center p-6">
            <div className="max-w-4xl w-full grid md:grid-cols-2 gap-8">
                {/* Freemium Plan */}
                <Card className="border-2 border-gray-300 rounded-2xl shadow-sm bg-[#191919]">
                    <CardContent className="p-8">
                        <h2 className="text-2xl font-bold text-white mb-4">Freemium</h2>
                        <p className="text-gray-200 mb-6">{`${t("freemiumDescription")}`}</p>
                        <ul className="space-y-3 mb-6 text-gray-200">
                            <li className="flex items-center gap-2"><Check className="text-green-500 w-5 h-5" />{`${t("freeItemOne")}`}</li>
                            <li className="flex items-center gap-2"><Check className="text-green-500 w-5 h-5" />{`${t("freeItemTwo")}`}</li>
                            <li className="flex items-center gap-2"><X className="text-red-500 w-5 h-5" />{`${t("freeItemTree")}`}</li>
                            <li className="flex items-center gap-2"><X className="text-red-500 w-5 h-5" />{`${t("freeItemFour")}`}</li>
                        </ul>
                        <Button variant="outline" className="w-full text-gray-600" disabled>{`${t("freeButton")}`}</Button>
                    </CardContent>
                </Card>

                {/* Premium Plan */}
                <Card className="border-2 border-yellow-500 rounded-2xl shadow-lg bg-[#191919]">
                    <CardContent className="p-8">
                        <h2 className="text-2xl font-bold mb-4 text-yellow-600">Premium</h2>
                        <p className="text-gray-200 mb-6">{`${t("premiumDescription")}`}<span className="font-semibold">$9.99/month</span>.</p>
                        <ul className="space-y-3 mb-6 text-gray-200">
                            <li className="flex items-center gap-2"><Check className="text-green-500 w-5 h-5" />{`${t("premiumItemOne")}`}</li>
                            <li className="flex items-center gap-2"><Check className="text-green-500 w-5 h-5" />{`${t("premiumItemTwo")}`}</li>
                            <li className="flex items-center gap-2"><Check className="text-green-500 w-5 h-5" />{`${t("premiumItemTree")}`}</li>
                            <li className="flex items-center gap-2"><Check className="text-green-500 w-5 h-5" />{`${t("premiumItemFour")}`}</li>
                        </ul>
                        <SubscribeButton/>
                    </CardContent>
                </Card>
            </div>
        </div>
    );
}
