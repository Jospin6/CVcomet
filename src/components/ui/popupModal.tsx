import { AppDispatch } from "@/redux/store";
import Image from "next/image";
import { useDispatch } from "react-redux";
import { Button } from "./button";
import { updateCurrentTemplate, User } from "@/redux/user/userSlice";
import { useTranslation } from 'react-i18next';
import { Template, updateTemplatePlan } from "@/redux/template/templateSlice";
import { UpdatePlanForm } from "./updatePlanForm";
import Link from "next/link";
import { useState } from "react";

export const PopupModal = ({ imageUrl, onClose, isSelected, template, user }: { imageUrl: string; onClose: () => void, isSelected: boolean, template: Template, user: User }) => {
    const dispatch = useDispatch<AppDispatch>();
    const { t } = useTranslation();
    const [isLoading, setIsLoading] = useState(false);
    const userId = user.id!;
    const isAllowed = template.plan === "FREE" || user?.isSubscribed;
    const role = user.role;

    const handleTemplateChange = async () => {
        try {
            setIsLoading(true);
            await dispatch(updateCurrentTemplate({ id: userId, type: template.type, currentTemplateId: template.id }));
        } catch (error) {
            console.log("Erreur lors du changement de template", error);
        } finally {
            setIsLoading(false);
        }
    };

    return (
        <div className="fixed inset-0 z-50 bg-black/70 bg-opacity-60 flex items-center justify-center">
            <div className="bg-white dark:bg-gray-900 rounded-xl p-4 max-w-3xl w-full relative shadow-xl">
                <div
                    onClick={onClose}
                    className="absolute z-50 cursor-pointer top-2 right-4 font-medium"
                >
                    X
                </div>
                <div className="md:grid md:grid-cols-6 gap-4">
                    <div className="relative w-full md:h-[80vh] h-[40vh] col-span-4">
                        <Image
                            src={imageUrl}
                            alt="Template Preview"
                            fill
                            className="object-contain rounded-md pointer-events-none"
                        />
                    </div>
                    <div className="col-span-2 space-y-4">
                        <h1 className="text-xl font-bold text-primary">{t("plan")}</h1>
                        <p className="text-sm text-muted-foreground italic mb-2">
                            {t("planDescription")}
                        </p>
                        <p className="text-sm text-muted-foreground leading-relaxed">
                            <span className="font-semibold text-primary">{t("free")} :</span> {t("freeDetail")}
                            <br />
                            <span className="font-semibold text-yellow-600">{t("pro")} ({t("amountMonth")}) :</span> {t("premiumDetail")}
                        </p>

                        {role === "ADMIN" && (
                            <div>
                                <UpdatePlanForm defaultPlan={template.plan} id={template.id} />
                            </div>
                        )}
                        {isAllowed ? (
                            <div className="col-span-2 mt-4">
                                <Button
                                    onClick={handleTemplateChange}
                                    disabled={isLoading}
                                    variant={isSelected ? "default" : "secondary"}
                                    className={`w-full flex items-center gap-3 py-2 px-4 rounded-full border ${isSelected && "bg-green-600 text-black"}`}
                                >
                                    <div className="w-5 h-5 flex items-center justify-center rounded-full border-2 border-primary">
                                        {isSelected && (
                                            <div className="w-3 h-3 bg-primary rounded-full" />
                                        )}
                                    </div>
                                    <span className="text-sm font-medium">
                                        {isLoading ? t("loading") : (isSelected ? t("selectedTemp") : t("chooseTemp"))}
                                    </span>
                                </Button>
                            </div>
                        ) : (
                            <div className="col-span-2 mt-4">
                                <Link href={"/upgrade"}>
                                    <Button
                                        variant={"default"}
                                        className="w-full flex items-center gap-3 py-2 px-4 rounded-full border"
                                    >
                                        {t("cta")}
                                    </Button>
                                </Link>
                            </div>
                        )}
                    </div>
                </div>
            </div>
        </div>
    );
};
