import { CoverLetterProps } from "@/helpers/schema"
import { User } from "@/redux/user/userSlice"
import { Download, RefreshCcw } from "lucide-react";
import html2canvas from "html2canvas-pro"
import jsPDF from "jspdf"
import { useRef } from "react"
import { useTranslation } from 'react-i18next'
import CoverOne from "./coverOne";
import { PDFDownloadLink } from "@react-pdf/renderer";

export const CoverLetterOne = ({ coverLetter, user }: { coverLetter: CoverLetterProps, user?: User }) => {
    const { t } = useTranslation();
    const date = new Date(Date.now());

    const day = String(date.getDate()).padStart(2, '0');
    const month = String(date.getMonth() + 1).padStart(2, '0');
    const year = date.getFullYear();
    return (
        <>
            <div className="flex items-center text-white justify-between mb-4">
                <h2 className="text-xl font-bold">{t("coverLetter")}</h2>
                <div className="flex gap-4">
                    {(user && coverLetter) && (
                        <PDFDownloadLink
                            document={<CoverOne user={user} coverLetter={coverLetter} />}
                            fileName={`${user.name}_cover_letter.pdf`}
                        >
                           <Download className="w-5 h-5" />
                        </PDFDownloadLink>
                    )}
                </div>
            </div>

            <div
                className="mx-auto bg-white flex flex-col justify-start shadow-lg"
                style={{
                    width: "210mm",
                    height: "297mm",
                    padding: "20mm",
                    boxSizing: "border-box",
                    fontFamily: "Arial, sans-serif",
                }}
            >
                <div className="text-sm leading-relaxed">
                    <div className="mb-3">
                        <p className="text-xl font-semibold">{user?.name}</p>
                        <p className="text-[16px] font-semibold">{coverLetter.sendertitle?.toUpperCase()}</p>
                    </div>
                    <p>{user?.phone}</p>
                    <p>{user?.email}</p>
                    <p>{user?.address}</p>

                    <div className="mt-8">
                        {coverLetter.companyName && <p className="font-semibold">{coverLetter.companyName}</p>}
                        {coverLetter.companyAddress && <p>{coverLetter.companyAddress}</p>}
                    </div>

                    <div className="text-sm">
                        <p className="mt-8">{`${day}/${month}/${year}`}</p>

                        {coverLetter.recipientName && (
                            <p className="mt-8">{coverLetter.recipientName},</p>
                        )}

                        {coverLetter.introduction && (
                            <p className="mt-4">{coverLetter.introduction}</p>
                        )}

                        {coverLetter.body && (
                            <p className="mt-4">{coverLetter.body}</p>
                        )}

                        {coverLetter.conclusion && (
                            <p className="mt-4">{coverLetter.conclusion}</p>
                        )}

                        <p className="mt-4">{user?.name}</p>
                    </div>
                </div>
            </div>
        </>
    )
}
