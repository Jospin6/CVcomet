"use client"

import { Skeleton } from "@/components/ui/skeleton"
import { Download } from "lucide-react"
import { useRef } from "react"
import { useTranslation } from "react-i18next"

export const CoverLetterSkeleton = () => {
    const { t } = useTranslation();
    const cvRef = useRef<HTMLDivElement>(null)

    return (
        <>
            <div className="flex items-center justify-between mb-4 text-white">
                <h2 className="text-xl font-bold">{t("coverLetter")}</h2>
                <div className="flex gap-4">
                    <button
                        className="p-1 rounded hover:border-[1px] cursor-pointer"
                        aria-label="Download Skeleton"
                    >
                        <Download className="w-5 h-5" />
                    </button>
                </div>
            </div>

            <div
                ref={cvRef}
                className="mx-auto shadow-lg flex flex-col justify-start"
                style={{
                    width: "210mm",
                    height: "297mm",
                    padding: "20mm",
                    boxSizing: "border-box",
                    backgroundColor: "#282828",
                    color: "white",
                }}
            >
                <div className="text-sm leading-relaxed">
                    <div className="mb-3">
                        <Skeleton className="h-6 w-48 mb-2 bg-[#3c3c3c]" />
                        <Skeleton className="h-4 w-64 bg-[#3c3c3c]" />
                    </div>

                    <Skeleton className="h-4 w-32 mb-1 bg-[#3c3c3c]" />
                    <Skeleton className="h-4 w-48 mb-1 bg-[#3c3c3c]" />
                    <Skeleton className="h-4 w-56 mb-4 bg-[#3c3c3c]" />

                    <div className="mt-8">
                        <Skeleton className="h-4 w-48 mb-1 bg-[#3c3c3c]" />
                        <Skeleton className="h-4 w-64 bg-[#3c3c3c]" />
                    </div>

                    <div className="mt-8 space-y-4">
                        <Skeleton className="h-4 w-24 bg-[#3c3c3c]" />
                        <Skeleton className="h-4 w-full bg-[#3c3c3c]" />
                        <Skeleton className="h-4 w-5/6 bg-[#3c3c3c]" />
                        <Skeleton className="h-4 w-3/4 bg-[#3c3c3c]" />
                        <Skeleton className="h-4 w-full bg-[#3c3c3c]" />
                        <Skeleton className="h-4 w-5/6 bg-[#3c3c3c]" />
                        <Skeleton className="h-4 w-1/2 bg-[#3c3c3c]" />
                    </div>

                    <div className="mt-6">
                        <Skeleton className="h-4 w-32 bg-[#3c3c3c]" />
                    </div>
                </div>
            </div>
        </>
    )
}
