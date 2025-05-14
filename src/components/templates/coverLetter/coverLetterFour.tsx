import { CoverLetterProps } from "@/helpers/schema"
import { User } from "@/redux/user/userSlice"
import { Download } from "lucide-react";
import { useTranslation } from 'react-i18next'
import CoverFour from "./coverFour";
import { CurrentFormatDate } from "@/components/ui/currentFormatDate";
import { DownLoadPdf } from "@/lib/downloadPdf";

export const CoverLetterFour = ({ coverLetter, user }: { coverLetter: CoverLetterProps, user?: User }) => {
    const { t } = useTranslation();

    const onClickDownload = () => {
        DownLoadPdf({
            pdfElement: <CoverFour user={user!} coverLetter={coverLetter} />,
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
                    <div className="pb-4 text-center border-b-[2px]">
                        <p className="uppercase text-xl font-bold">{user?.name}</p>
                        <p className="text-[16px] font-semibold">{coverLetter.sendertitle?.toUpperCase()}</p>
                    </div>

                    <div className="mt-2 grid-cols-4 grid gap-4">
                        <div className="col-span-2">
                            {coverLetter.companyName && <p className="font-bold">{coverLetter.companyName}</p>}
                            {coverLetter.companyAddress && <p>{coverLetter.companyAddress}</p>}
                        </div>
                        <div className="col-span-2 flex justify-end">
                            <p className="mt-8"><CurrentFormatDate /></p>
                        </div>
                    </div>

                    <div className="text-sm">
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
                    <div className="grid-cols-4 text-sm pt-4 mt-5 border-t-[2px] grid gap-4">
                        <div className="col-span-2">
                            <p className="text-lg font-medium">{user?.name}</p>
                        </div>
                        <div className="col-span-2 flex justify-end">
                            <div>
                                <p>{user?.address}</p>
                                <p>{user?.email}</p>
                                <p>{user?.phone}</p>
                            </div>
                        </div>
                    </div>
                </div>
            </div>
        </>
    )
}