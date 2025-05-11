import { CoverLetterProps } from "@/helpers/schema"
import { User } from "@/redux/user/userSlice"
import { CoverLetter } from "./coverLetter"
import { CoverLetterOne } from "@/components/templates/coverLetter/coverLetterOne";
import { CoverLetterTwo } from "@/components/templates/coverLetter/coverLetterTwo";
import { CoverLetterThree } from "@/components/templates/coverLetter/coverLetterThree";
import { CoverLetterFour } from "@/components/templates/coverLetter/coverLetterFour";
import { CoverLetterFive } from "@/components/templates/coverLetter/coverLetterFive";
import { cover1, cover2, cover3, cover4, cover5 } from "@/helpers/constants";


const templateComponentMap: Record<string, React.ComponentType<any>> = {
    [cover1]: CoverLetterOne,
    [cover2]: CoverLetterTwo,
    [cover3]: CoverLetterThree,
    [cover4]: CoverLetterFour,
    [cover5]: CoverLetterFive,
};

export const CoverLetterItems = ({ coverLetters, user }: { coverLetters: CoverLetterProps[], user: User }) => {
    const SelectedCoverLetterComponent = user?.currentCoverLetterId && templateComponentMap[user.currentCoverLetterId];
    return <>
        {
            coverLetters.map((c, i) => (
                <div key={i}>
                    {SelectedCoverLetterComponent ? (
                        <SelectedCoverLetterComponent coverLetter={{ ...c }} user={user} />
                    ) : (
                        <CoverLetter coverLetter={{ ...c }} user={user} />
                    )}
                </div>
            ))
        }
    </>
}