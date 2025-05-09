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

type Template = {
    id: string;
    name: string;
    type: "CV" | "COVER_LETTER";
    templateFile: string; // URL ou base64 image
    createdAt: string;
};

export const TemplateItem = ({ template, user }: { template: Template; user?: User }) => {
    const dispatch = useDispatch<AppDispatch>();
    const [avatarUrl, setAvatarUrl] = useState<string | null>(null);
    const isCurrentTemplate = template.id === user?.currentTemplateId;

    useEffect(() => {
        if (template.id) {
            const imageUrl = `/api/avatar?id=${template.id}`;
            setAvatarUrl(imageUrl);
        }
    }, [template.id]);

    const handleSelectTemplate = () => (user?.id) && dispatch(updateCurrentTemplate({ id: user.id, currentTemplateId: template.id }));

    return (
        <motion.div
            key={template.id}
            whileHover={{ scale: 1.03 }}
            transition={{ type: "spring", stiffness: 300 }}
        >
            <Card
                className={`relative overflow-hidden pt-0 rounded-xl shadow-lg backdrop-blur border ${isCurrentTemplate
                        ? "border-yellow-600 bg-transparent ring-2 ring-primary/50"
                        : "border-muted-foreground/10 bg-muted/20 dark:bg-muted/30"
                    }`}
            >
                <div className="relative h-48 w-full">
                    {avatarUrl && (
                        <Image
                            src={avatarUrl}
                            alt={`Template ${template.name}`}
                            fill
                            className="object-cover"
                        />
                    )}

                    {isCurrentTemplate && (
                        <div className="absolute top-2 right-2 z-10">
                            <Badge variant="default">Sélectionné</Badge>
                        </div>
                    )}
                </div>

                <CardHeader>
                    <CardTitle className="flex items-center justify-between text-white">
                        {template.name}
                        <Badge variant={template.type === "CV" ? "default" : "secondary"}>
                            {template.type}
                        </Badge>
                    </CardTitle>
                </CardHeader>

                <CardContent>
                    {/* <p className="text-sm text-muted-foreground">
                        Créé le {new Date(template.createdAt).toLocaleDateString()}
                    </p> */}

                    <Button
                        className="mt-4 w-full cursor-pointer"
                        variant={isCurrentTemplate ? "default" : "secondary"}
                        onClick={handleSelectTemplate}
                    >
                        {isCurrentTemplate ? "Utilisé actuellement" : "Choisir ce template"}
                    </Button>
                </CardContent>
            </Card>
        </motion.div>
    );
};
