import { CoverLetterProps } from "@/helpers/schema"
import { User } from "@/redux/user/userSlice"

export const CoverLetter = ({ coverLetter, user }: { coverLetter: CoverLetterProps, user?: User }) => {
    const date = new Date(Date.now());

    const day = String(date.getDate()).padStart(2, '0');
    const month = String(date.getMonth() + 1).padStart(2, '0');
    const year = date.getFullYear();
    return (
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
                    <p className="mt-8">Dear {coverLetter.recipientName},</p>
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
    )
}
