import { signIn } from "@/lib/auth"
import { useTranslation } from "react-i18next";


export const GoogleAuthBtn = () => {
    const { t } = useTranslation();
    return <form
        action={async () => {
            "use server"
            await signIn("google")
        }}
    >
        <button type="submit" className="text-white mt-5">{t("signinwithgoogle")}</button>
    </form>
}