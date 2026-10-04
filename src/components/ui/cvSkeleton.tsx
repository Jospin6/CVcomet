"use client"

import { Skeleton } from "@/components/ui/skeleton"

export const CvSkeleton = () => {
    return (
        <div
            className="max-w-[794px] mx-auto p-8 shadow-lg"
            style={{
                backgroundColor: "#282828", 
                color: "white",
                width: "210mm",
                minHeight: "297mm"
            }}
        >
            <div className="flex items-center justify-between mb-4">
                <Skeleton className="h-6 w-48 bg-muted" />
                <div className="flex gap-4">
                    <Skeleton className="h-8 w-8 rounded bg-muted" />
                </div>
            </div>

            <header className="text-center mb-6">
                <Skeleton className="h-8 w-64 mx-auto mb-2 bg-muted" />
                <Skeleton className="h-4 w-48 mx-auto mb-1 bg-muted" />
                <Skeleton className="h-4 w-72 mx-auto bg-muted" />
            </header>

            <section className="mb-4">
                <Skeleton className="h-6 w-48 mb-3 bg-muted" />
                <Skeleton className="h-4 w-full mb-2 bg-muted" />
                <Skeleton className="h-4 w-5/6 mb-2 bg-muted" />
                <Skeleton className="h-4 w-3/4 bg-muted" />
            </section>

            <section className="mb-4">
                <Skeleton className="h-6 w-40 mb-3 bg-muted" />
                {[...Array(2)].map((_, i) => (
                    <div key={i} className="mb-3">
                        <Skeleton className="h-4 w-1/2 mb-1 bg-muted" />
                        <Skeleton className="h-3 w-1/3 mb-2 bg-muted" />
                        <Skeleton className="h-4 w-full mb-1 bg-muted" />
                        <Skeleton className="h-4 w-5/6 mb-1 bg-muted" />
                    </div>
                ))}
            </section>

            <section className="mb-4">
                <Skeleton className="h-6 w-32 mb-3 bg-muted" />
                {[...Array(2)].map((_, i) => (
                    <div key={i} className="mb-3">
                        <Skeleton className="h-4 w-1/2 mb-1 bg-muted" />
                        <Skeleton className="h-3 w-1/3 mb-2 bg-muted" />
                        <Skeleton className="h-4 w-full mb-1 bg-muted" />
                        <Skeleton className="h-4 w-5/6 mb-1 bg-muted" />
                    </div>
                ))}
            </section>

            <section className="mb-4">
                <Skeleton className="h-6 w-24 mb-3 bg-muted" />
                {[...Array(2)].map((_, i) => (
                    <Skeleton key={i} className="h-4 w-2/3 mb-2 bg-muted" />
                ))}
            </section>

            <section className="mb-4">
                <Skeleton className="h-6 w-28 mb-3 bg-muted" />
                {[...Array(2)].map((_, i) => (
                    <div key={i} className="mb-2">
                        <Skeleton className="h-4 w-1/2 mb-1 bg-muted" />
                        <Skeleton className="h-4 w-3/4 bg-muted" />
                    </div>
                ))}
            </section>

            <section className="mb-4">
                <Skeleton className="h-6 w-32 mb-3 bg-muted" />
                {[...Array(2)].map((_, i) => (
                    <div key={i} className="mb-2">
                        <Skeleton className="h-4 w-1/2 mb-1 bg-muted" />
                        <Skeleton className="h-3 w-5/6 mb-1 bg-muted" />
                        <Skeleton className="h-3 w-3/4 bg-muted" />
                        <Skeleton className="h-3 w-2/3 bg-muted" />
                    </div>
                ))}
            </section>

            <section className="mb-4">
                <Skeleton className="h-6 w-36 mb-3 bg-muted" />
                {[...Array(2)].map((_, i) => (
                    <div key={i} className="mb-2">
                        <Skeleton className="h-4 w-1/2 mb-1 bg-muted" />
                        <Skeleton className="h-4 w-1/3 mb-1 bg-muted" />
                        <Skeleton className="h-4 w-3/4 bg-muted" />
                    </div>
                ))}
            </section>
        </div>
    )
}
