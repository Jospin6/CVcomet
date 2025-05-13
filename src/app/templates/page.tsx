"use client"

import TemplateCardList from "@/components/ui/templateCardList";
import { useCurrentUser } from "@/hooks/useCurrentUser";
import { AppDispatch, RootState } from "@/redux/store";
import { fetchTemplates } from "@/redux/template/templateSlice";
import { fetchUser, selectUser } from "@/redux/user/userSlice";
import { useEffect } from "react";
import { useDispatch, useSelector } from "react-redux";
import { useTranslation } from 'react-i18next';

export default function More() {
    const dispatch = useDispatch<AppDispatch>();
    const templates = useSelector((state: RootState) => state.template.templates);
    const currentUser = useCurrentUser()
    const user = useSelector(selectUser)
    const { t } = useTranslation();

    const cvs = templates.filter(cv => cv.type === "CV")
    const coverLetters = templates.filter(cv => cv.type === "COVER_LETTER")

    useEffect(() => {
        if (currentUser?.id) {
            dispatch(fetchUser(currentUser?.id))
        }
    }, [currentUser?.id, dispatch])

    useEffect(() => {
        dispatch(fetchTemplates())
    }, [dispatch])

    return <div>
        {cvs.length > 0 && (
            <div>
                <h1 className="text-xl text-gray-200">{t("resumeTemplate")}</h1>
                <div>
                    <div className="my-3">
                        <TemplateCardList templates={cvs} user={user || undefined} />
                    </div>
                </div>
            </div>
        )}

        {coverLetters.length > 0 && (
            <div>
                <h1 className="text-xl text-gray-200">{t("coverLetterTemplate")}</h1>
                <div>
                    <div className="my-3">
                        <TemplateCardList templates={coverLetters} user={user || undefined} />
                    </div>
                </div>
            </div>
        )}
    </div>
}