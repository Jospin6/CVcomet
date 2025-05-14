import { CoverLetterProps } from "@/helpers/schema"
import { User } from "@/redux/user/userSlice"
import { Download } from "lucide-react";
import { useTranslation } from 'react-i18next'
import CoverTwo from "./coverTwo";
import { DownLoadPdf } from "@/lib/downloadPdf";

export const CoverLetterTwo = ({ coverLetter, user }: { coverLetter: CoverLetterProps, user?: User }) => {
    const { t } = useTranslation();

    const onClickDownload = () => {
        DownLoadPdf({
            pdfElement: <CoverTwo user={user!} coverLetter={coverLetter} />,
            filename: `${user!.name}_cover_letter.pdf`,
        });
    };

    return (
        <div className=" mb-4">
            <div className="flex text-white items-center justify-between mb-4">
                <h2 className="text-xl font-bold">{t("coverLetter")}</h2>
                {(user && coverLetter) && (
                    <Download className="w-5 h-5 cursor-pointer" onClick={onClickDownload} />
                )}
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

                <div className="text-sm">
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
        </div>
    );
}