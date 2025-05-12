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
        <div className=" mb-4">
            <div className="flex text-white items-center justify-between mb-4">
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
                className="mx-auto bg-white flex flex-col justify-start shadow-lg"
                style={{
                    width: "210mm",
                    height: "297mm",
                    padding: "20mm",
                    boxSizing: "border-box",
                    fontFamily: "Arial, sans-serif",
                }}
            >
                {/* Header - User Information */}
                <div className="mb-4 pb-4 border-b border-black">
                    <div className="mb-3">
                        <p className="text-xl font-semibold">{user?.name}</p>
                        <p className="text-[16px] font-semibold">{coverLetter.sendertitle?.toUpperCase()}</p>
                    </div>
                    <p>{user?.phone}</p>
                    <p>{user?.email}</p>
                    <p>{user?.address}</p>
                </div>

                {/* Recipient Information */}
                {coverLetter.recipientName && (
                    <div className="mb-4">
                        <p className="text-lg font-semibold">{coverLetter.companyName}</p>
                        <p>{coverLetter.companyAddress}</p>
                    </div>
                )}

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