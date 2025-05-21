"use client"
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Check, X } from "lucide-react";
import { SubscribeButton } from "@/components/ui/subscribeButton";
import { useTranslation } from 'react-i18next';
import { useCurrentUser } from "@/hooks/useCurrentUser";
import { useDispatch, useSelector } from "react-redux";
import { deleteSubscription, fetchUser, selectUser } from "@/redux/user/userSlice";
import { AppDispatch } from "@/redux/store";
import { useEffect } from "react";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { toast } from "sonner";

export default function UpgradePage() {
    const { t } = useTranslation();
    const dispatch = useDispatch<AppDispatch>();
    const user = useCurrentUser();
    const currentUser = useSelector(selectUser)

    const handleSubscriptionDeletion = async () => {
        if (!currentUser?.id) return;

        try {
            await dispatch(deleteSubscription(currentUser.id)).unwrap();
            toast(`${t("unSubscribeSuccessTitle")}`,{
                description: `${t("unSubscribeSuccess")}`,
            });
        } catch (error) {
            toast(`${t("error")}`, {
                description: `${t("errorMessage")}`,
            });
        }
    };

    useEffect(() => {
        if (user?.id) {
            dispatch(fetchUser(user.id));
        }
    }, [user?.id, dispatch]);

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
                        {!currentUser?.isSubscribed ? (
                            <SubscribeButton />
                        ) : (<>
                            <Dialog>
                                <DialogTrigger asChild>
                                    <Button className="w-full text-white bg-red-600">{`${t("unSubscribe")}`}</Button>
                                </DialogTrigger>
                                <DialogContent className="sm:max-w-[425px]">
                                    <DialogHeader>
                                        <DialogTitle>{t("unSubscribeTitle")}</DialogTitle>
                                        <DialogDescription className="text-gray-600">
                                            {t("unSubscribeMessage")}
                                        </DialogDescription>
                                    </DialogHeader>
                                    <div className="md:flex md:justify-between md:items-center">
                                        <DialogTrigger asChild className="block md:inline mb-2 md:mb-0 w-full md:w-auto">
                                            <Button>{`${t("discard")}`}</Button>
                                        </DialogTrigger>
                                        <Button
                                            className="text-white bg-red-600 w-full md:w-auto"
                                            onClick={handleSubscriptionDeletion}>
                                            {`${t("unSubscribe")}`}
                                        </Button>
                                    </div>
                                </DialogContent>
                            </Dialog>
                        </>
                        )}
                    </CardContent>
                </Card>
            </div>
        </div>
    );
}
