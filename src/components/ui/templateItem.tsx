"use client"

import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { motion } from "framer-motion";
import Image from "next/image";
import { useEffect, useState } from "react";
import { Button } from "./button";
import { useDispatch } from "react-redux";
import { AppDispatch } from "@/redux/store";
import { updateCurrentTemplate, User } from "@/redux/user/userSlice";
import Link from "next/link";

type Template = {
    id: string;
    name: string;
    type: "CV" | "COVER_LETTER";
    templateFile: string;
    createdAt: string;
};

export const TemplateItem = ({ template, user }: { template: Template; user?: User }) => {
    const dispatch = useDispatch<AppDispatch>();
    const [avatarUrl, setAvatarUrl] = useState<string | null>(null);

    const isCurrentTemplate = template.id === user?.currentTemplateId;
    const isCurrentCoverLetter = template.id === user?.currentCoverLetterId;
    const isCurrent = template.type === "CV" ? isCurrentTemplate : isCurrentCoverLetter;

    useEffect(() => {
        if (template.id) {
            const imageUrl = `/api/avatar?id=${template.id}`;
            setAvatarUrl(imageUrl);
        }
    }, [template.id]);

    const handleSelectTemplate = () => {
        if (user?.id) {
            dispatch(updateCurrentTemplate({ id: user.id, type: template.type, currentTemplateId: template.id }));
        }
    };

    const handleParallelRoute = () => {

    }

    return (
        <motion.div
            key={template.id}
            whileHover={{ scale: 1.03 }}
            transition={{ type: "spring", stiffness: 300 }}
        >
            <Link href={`/more/${template.id}`}>
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
                                <Badge variant="default" className="bg-green-600 text-white">Sélectionné</Badge>
                            </div>
                        )}
                    </div>
                    <div className="absolute bottom-2 right-2 z-10">
                        <Badge variant={template.type === "CV" ? "default" : "secondary"}>
                            {template.type}
                        </Badge>
                    </div>

                    {/* <CardContent>
                    <Button
                        className="mt-4 w-full cursor-pointer"
                        variant={isCurrent ? "default" : "secondary"}
                        onClick={handleSelectTemplate}
                    >
                        {isCurrent ? "Utilisé actuellement" : "Choisir ce template"}
                    </Button>
                </CardContent> */}
                </Card>
            </Link>
        </motion.div>
    );
};
