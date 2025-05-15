"use client";

import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { motion } from "framer-motion";
import Image from "next/image";
import { useEffect, useState } from "react";
import { useDispatch } from "react-redux";
import { AppDispatch } from "@/redux/store";
import { updateCurrentTemplate, User } from "@/redux/user/userSlice";
import { PopupModal } from "./popupModal";
import { useTranslation } from 'react-i18next';
import { Template } from "@/redux/template/templateSlice";

export const TemplateItem = ({ template, user }: { template: Template; user?: User }) => {
    const dispatch = useDispatch<AppDispatch>();
    const [avatarUrl, setAvatarUrl] = useState<string | null>(null);
    const [isOpen, setIsOpen] = useState(false);
    const { t } = useTranslation();

    const isCurrentTemplate = template.id === user?.currentTemplateId;
    const isCurrentCoverLetter = template.id === user?.currentCoverLetterId;
    const isCurrent = template.type === "CV" ? isCurrentTemplate : isCurrentCoverLetter;

    useEffect(() => {
        if (template.id) {
            const imageUrl = `${process.env.NEXT_PUBLIC_BASE_URL}/api/avatar?id=${template.id}`;
            setAvatarUrl(imageUrl);
        }
    }, [template.id]);

    const handleCardClick = () => {
        setIsOpen(!isOpen);
    };

    return (
        <>
            <motion.div
                key={template.id}
                whileHover={{ scale: 1.03 }}
                transition={{ type: "spring", stiffness: 300 }}
                onClick={handleCardClick}
                className="cursor-pointer"
            >
                <Card
                    className={`relative overflow-hidden p-0 h-[350px] rounded-xl shadow-lg backdrop-blur border ${isCurrent
                        ? "border-yellow-600 bg-transparent ring-2 ring-primary/50"
                        : "border-muted-foreground/10 bg-muted/20 dark:bg-muted/30"
                        }`}
                >
                    <div className="relative h-full w-full">
                        {avatarUrl && (
                            <Image
                                src={avatarUrl}
                                alt={`Template ${template.name}`}
                                fill
                                className="object-fill"
                            />
                        )}

                        {isCurrent && (
                            <div className="absolute top-2 right-2 z-10">
                                <Badge variant="default" className="bg-green-600 text-white">{t("selected")}</Badge>
                            </div>
                        )}
                    </div>
                    <div className="absolute bottom-2 right-2 z-10">
                        <Badge variant={template.type === "CV" ? "default" : "secondary"}>
                            {template.type}
                        </Badge>
                    </div>
                </Card>
            </motion.div>

            {isOpen && avatarUrl && (
                <PopupModal imageUrl={avatarUrl} onClose={handleCardClick} isSelected={isCurrent} template={template} user={user!} />
            )}
        </>
    );
};
