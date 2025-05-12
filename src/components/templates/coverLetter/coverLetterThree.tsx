import { CoverLetterProps } from "@/helpers/schema"
import { User } from "@/redux/user/userSlice"
import { Download, RefreshCcw } from "lucide-react";
import html2canvas from "html2canvas-pro"
import jsPDF from "jspdf"
import { useRef } from "react"
import { useTranslation } from 'react-i18next'

export const CoverLetterThree = ({ coverLetter, user }: { coverLetter: CoverLetterProps, user?: User }) => {
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
                {/* Header Section */}
                <header className="flex flex-col space-y-1">
                    <div className="mb-3">
                        <p className="text-xl font-semibold">{user?.name}</p>
                        <p className="text-[16px] font-semibold">{coverLetter.sendertitle?.toUpperCase()}</p>
                    </div>
                    <p className="text-gray-700">{user?.phone}</p>
                    <p className="text-gray-700">{user?.email}</p>
                    <p className="text-gray-700">{user?.address}</p>
                </header>



                {/* Recipient Information */}
                <section className="space-y-1 flex mt-4">
                    <div className="w-2/4">
                        {coverLetter.companyName && <p className="font-semibold text-gray-800">{coverLetter.companyName}</p>}
                        {coverLetter.companyAddress && <p className="text-gray-700">{coverLetter.companyAddress}</p>}
                    </div>
                    <div className="w-2/4 flex justify-end">
                        {/* Date Section */}
                        <p className="text-gray-600">{`${day}/${month}/${year}`}</p>
                    </div>
                </section>

                <div className="text-sm">
                    {/* Salutation Section */}
                    {coverLetter.recipientName && (
                        <p className="my-4 text-gray-800">{`${coverLetter.recipientName},`}</p>
                    )}

                    {/* Body Section */}
                    <section className="space-y-4">
                        {coverLetter.introduction && (
                            <p className="text-gray-700">{coverLetter.introduction}</p>
                        )}

                        {coverLetter.body && (
                            <p className="text-gray-700">{coverLetter.body}</p>
                        )}

                        {coverLetter.conclusion && (
                            <p className="text-gray-700">{coverLetter.conclusion}</p>
                        )}
                    </section>

                    {/* Closing */}
                    <footer className="mt-6">
                        <p className="text-gray-800">{user?.name}</p>
                    </footer>
                </div>
            </div>
        </div>
    );
}