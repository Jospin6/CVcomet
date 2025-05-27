import { CoverLetterProps } from "@/helpers/schema"
import { User } from "@/redux/user/userSlice"
import { Download } from "lucide-react";
import CoverZero from "../templates/coverLetter/coverZero";
import { CurrentFormatDate } from "@/components/ui/currentFormatDate";
import { DownLoadPdf } from "@/lib/downloadPdf";
import { useTranslation } from "react-i18next";

export const CoverLetter = ({ coverLetter, user }: { coverLetter: CoverLetterProps, user?: User }) => {
    const { t } = useTranslation();
     const onClickDownload = () => {
        DownLoadPdf({
            pdfElement: <CoverZero user={user!} coverLetter={coverLetter} />,
            filename: `${user!.name}_cover_letter.pdf`,
        });
    };
    return (
        <>
            <div className="flex items-center text-white justify-between mb-4">
                <h2 className="text-xl font-bold">{t("coverLetter")}</h2>
                <div className="flex gap-4">
                    {(user && coverLetter) && (
                        <Download className="w-5 h-5 cursor-pointer" onClick={onClickDownload} />
                    )}
                </div>
            </div>
            <div
                className="md:w-[794px] w-full mx-auto md:p-8 md:h-[1123px] h-[auto] p-2 bg-white shadow-lg"
                
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

                    <p className="mt-8"><CurrentFormatDate/></p>

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
