import { CoverLetterProps } from "@/helpers/schema"
import { User } from "@/redux/user/userSlice"
import { Download, RefreshCcw } from "lucide-react";
import html2canvas from "html2canvas-pro"
import jsPDF from "jspdf"
import { useRef } from "react"
import { useTranslation } from 'react-i18next'

export const CoverLetter = ({ coverLetter, user }: { coverLetter: CoverLetterProps, user?: User }) => {
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
        <>
            <div className="flex items-center justify-between mb-4">
                <h2 className="text-xl font-bold">{t("coverLetter")}</h2>
                <div className="flex gap-4">
                    <button
                        onClick={handleDownload}
                        className="p-2 rounded hover:bg-gray-100 cursor-pointer"
                        aria-label="Download Cover Letter"
                    >
                        <Download className="w-5 h-5" />
                    </button>
                </div>
            </div>
            <div
                ref={cvRef}
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
                    <p>{user?.name}</p>
                    <p>{user?.address}</p>
                    <p>{user?.email}</p>
                    <p>{user?.phone}</p>

                    <div className="mt-8">
                        {coverLetter.recipientName && <p>{coverLetter.recipientName}</p>}
                        {coverLetter.recipientTitle && <p>{coverLetter.recipientTitle}</p>}
                        {coverLetter.companyName && <p>{coverLetter.companyName}</p>}
                        {coverLetter.companyAddress && <p>{coverLetter.companyAddress}</p>}
                    </div>

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
        </>
    )
}
