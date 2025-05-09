"use client"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { motion } from "framer-motion";
import Image from "next/image";
import { useEffect, useState } from "react";

type Template = {
    id: string;
    name: string;
    type: "CV" | "COVER_LETTER";
    templateFile: string; // URL ou base64 image
    createdAt: string;
};

export const TemplateItem = ({ template }: { template: Template }) => {
    const [avatarUrl, setAvatarUrl] = useState<string | null>(null);

    useEffect(() => {
        if (template.id) {
            const imageUrl = `/api/avatar?id=${template.id}`;
            setAvatarUrl(imageUrl);
        }
    }, [template.id]);
    return <motion.div
        key={template.id}
        whileHover={{ scale: 1.05 }}
        transition={{ type: "spring", stiffness: 300 }}
    >
        <Card className="bg-muted/20 dark:bg-muted/30 border border-muted-foreground/10 shadow-lg backdrop-blur rounded-xl overflow-hidden">
            <div className="relative h-48 w-full">
                {avatarUrl && (<Image
                    src={avatarUrl}
                    alt={`Template ${template.name}`}
                    fill
                    className="object-cover"
                />)}
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
                <p className="text-sm text-muted-foreground">
                    Créé le {new Date(template.createdAt).toLocaleDateString()}
                </p>
            </CardContent>
        </Card>
    </motion.div>
}