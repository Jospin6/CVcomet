import { CoverLetterProps } from "@/helpers/schema"
import { User } from "@/redux/user/userSlice"
import { CoverLetter } from "./coverLetter"

export const CoverLetterItems = ({coverLetters, user}: {coverLetters: CoverLetterProps[], user: User}) => {
    return <>
        {
            coverLetters.map((c, i) => (<CoverLetter key={i} coverLetter={{ ...c }} user={user} />))
        }
    </>
}