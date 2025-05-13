"use client";

import { Card } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";

export const TemplateItemSkeleton = () => {
    return (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
            {Array.from({ length: 6 }).map((_, index) => (
                <Card
                    key={index}
                    className="relative overflow-hidden p-0 h-[350px] rounded-xl shadow-lg backdrop-blur border border-muted-foreground/10 bg-muted/20 dark:bg-muted/30"
                >
                    <div className="relative h-full w-full">
                        <Skeleton className="h-full w-full rounded-xl" />
                    </div>
                    <div className="absolute bottom-2 right-2 z-10">
                        <Skeleton className="h-6 w-16 rounded-full" />
                    </div>
                </Card>
            ))}
        </div>
    );
};
