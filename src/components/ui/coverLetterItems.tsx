import { CoverLetterProps } from "@/helpers/schema"
import { User } from "@/redux/user/userSlice"
import { CoverLetter } from "./coverLetter"
import { CoverLetterThree } from "@/components/templates/coverLetter/coverLetterThree";

const templateComponentMap: Record<string, React.ComponentType<any>> = {
    "cmahyhv9f0002uxh8j9wmqp7b": CoverLetterThree,
};

export const CoverLetterItems = ({coverLetters, user}: {coverLetters: CoverLetterProps[], user: User}) => {
    const SelectedCoverLetterComponent = user?.currentCoverLetterId && templateComponentMap[user.currentCoverLetterId];
    return <>
        {
            coverLetters.map((c, i) => (
                <div key={i}>
                    {SelectedCoverLetterComponent ? (
                        <SelectedCoverLetterComponent coverLetter={{ ...c}} user={user} />
                    ): (
                        <CoverLetter coverLetter={{ ...c }} user={user} />
                    )}
                </div>
            ))
        }
    </>
}