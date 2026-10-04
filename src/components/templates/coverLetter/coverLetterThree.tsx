import { CoverLetterProps } from "@/helpers/schema"
import { User } from "@/redux/user/userSlice"
import { Button } from "@/components/ui/button";
import { Download } from "lucide-react";
import { useTranslation } from 'react-i18next'
import CoverThree from "./coverThree";
import { CurrentFormatDate } from "@/components/ui/currentFormatDate";
import { DownLoadPdf } from "@/lib/downloadPdf";

export const CoverLetterThree = ({ coverLetter, user }: { coverLetter: CoverLetterProps, user?: User }) => {
    const { t } = useTranslation();

    const onClickDownload = () => {
        DownLoadPdf({
            pdfElement: <CoverThree user={user!} coverLetter={coverLetter} />,
            filename: `${user!.name}_cover_letter.pdf`,
        });
    };

    return (
        <div className=" mb-4">
            <div className="flex text-foreground items-center justify-between mb-4">
                <h2 className="text-xl font-bold">{t("coverLetter")}</h2>
                {(user && coverLetter) && (
                    <Button variant="outline" size="sm" aria-label={t("shell.download")} onClick={onClickDownload}><Download className="size-4"/><span className="hidden sm:inline">{t("shell.download")}</span></Button>
                )}
            </div>

            <div className="document-scroll" role="region" tabIndex={0} aria-label={t("shell.preview")}>
            <div
                className="mx-auto document-paper bg-white flex flex-col justify-start shadow-lg"
                style={{
                    width: "210mm",
                    height: "297mm",
                    padding: "20mm",
                    boxSizing: "border-box",
                    fontFamily: "Arial, sans-serif",
                }}
            >
                {/* Header Section */}
                <header className="flex flex-col space-y-1 pb-4 border-b border-black">
                    <div className="mb-3">
                        <p className="text-xl font-semibold">{user?.name}</p>
                        <p className="text-[16px] font-semibold">{coverLetter.sendertitle?.toUpperCase()}</p>
                    </div>
                    <p className="text-gray-900">{user?.phone}</p>
                    <p className="text-gray-900">{user?.email}</p>
                    <p className="text-gray-900">{user?.address}</p>
                </header>



                {/* Recipient Information */}
                <section className="space-y-1 flex mt-4">
                    <div className="w-2/4">
                        {coverLetter.companyName && <p className="font-semibold text-gray-800">{coverLetter.companyName}</p>}
                        {coverLetter.companyAddress && <p className="text-gray-900">{coverLetter.companyAddress}</p>}
                    </div>
                    <div className="w-2/4 flex justify-end">
                        {/* Date Section */}
                        <p className="text-gray-600"><CurrentFormatDate /></p>
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
                            <p className="text-gray-900">{coverLetter.introduction}</p>
                        )}

                        {coverLetter.body && (
                            <p className="text-gray-900">{coverLetter.body}</p>
                        )}

                        {coverLetter.conclusion && (
                            <p className="text-gray-900">{coverLetter.conclusion}</p>
                        )}
                    </section>

                    {/* Closing */}
                    <footer className="mt-6">
                        <p className="text-gray-800">{user?.name}</p>
                    </footer>
                </div>
            </div>
        </div>
        </div>
    );
}