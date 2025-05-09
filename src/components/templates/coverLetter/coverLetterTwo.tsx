import { CoverLetterProps } from "@/helpers/schema"
import { User } from "@/redux/user/userSlice"
import { Download, RefreshCcw } from "lucide-react";
import html2canvas from "html2canvas-pro"
import jsPDF from "jspdf"
import { useRef } from "react"
import { useTranslation } from 'react-i18next'

export const CoverLetterTwo = ({ coverLetter, user }: { coverLetter: CoverLetterProps, user?: User }) => {
    const { t } = useTranslation();
    const date = new Date(Date.now());
    const cvRef = useRef<HTMLDivElement>(null);

    const handleDownload = async () => {
        const element = cvRef.current;
        if (!element) return;

        const canvas = await html2canvas(element, { scale: 2 });
        const imgData = canvas.toDataURL("image/png");
        const pdf = new jsPDF("p", "mm", "a4");

        const imgProps = pdf.getImageProperties(imgData);
        const pdfWidth = pdf.internal.pageSize.getWidth();
        const pdfHeight = (imgProps.height * pdfWidth) / imgProps.width;

        pdf.addImage(imgData, "PNG", 0, 0, pdfWidth, pdfHeight);
        pdf.save("cover_letter.pdf");
    };

    const day = String(date.getDate()).padStart(2, '0');
    const month = String(date.getMonth() + 1).padStart(2, '0');
    const year = date.getFullYear();

    return (
        <div className="mx-auto bg-white p-6 shadow-lg max-w-xl">
            <div className="flex items-center justify-between mb-4">
                <h2 className="text-xl font-bold">{t("coverLetter")}</h2>
                <button
                    onClick={handleDownload}
                    className="p-1 rounded hover:border-[1px] cursor-pointer"
                    aria-label="Download Cover Letter"
                >
                    <Download className="w-5 h-5" />
                </button>
            </div>

            <div
                ref={cvRef}
                className="flex flex-col justify-start"
                style={{
                    width: "100%",
                    fontFamily: "Arial, sans-serif",
                    lineHeight: "1.5",
                    fontSize: "12pt",
                }}
            >
                {/* Header - User Information */}
                <div className="mb-6">
                    <p>{user?.name}</p>
                    <p>{user?.address}</p>
                    <p>{user?.email}</p>
                    <p>{user?.phone}</p>
                </div>

                {/* Recipient Information */}
                {coverLetter.recipientName && (
                    <div className="mb-4">
                        <p>{coverLetter.recipientName}</p>
                        <p>{coverLetter.recipientTitle}</p>
                        <p>{coverLetter.companyName}</p>
                        <p>{coverLetter.companyAddress}</p>
                    </div>
                )}

                {/* Date */}
                <p className="mb-4">{`${day}/${month}/${year}`}</p>

                {/* Salutation */}
                {coverLetter.recipientName && (
                    <p className="mb-4">{`${coverLetter.recipientName},`}</p>
                )}

                {/* Cover Letter Body */}
                <div className="mb-6">
                    {coverLetter.introduction && (
                        <p>{coverLetter.introduction}</p>
                    )}

                    {coverLetter.body && (
                        <p className="mt-4">{coverLetter.body}</p>
                    )}

                    {coverLetter.conclusion && (
                        <p className="mt-4">{coverLetter.conclusion}</p>
                    )}
                </div>

                {/* Closing */}
                <p>{user?.name}</p>
            </div>
        </div>
    );
}
