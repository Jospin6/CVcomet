"use client"
import EditUserForm from "@/components/forms/editUserForm";
import EducationForm from "@/components/forms/educationForm";
import ExperienceForm from "@/components/forms/experienceForm";
import ProjectForm from "@/components/forms/projectForm";
import { useCurrentUser } from "@/hooks/useCurrentUser";
import { formatDateToMonthYear } from "@/lib/utils";
import { AppDispatch, RootState } from "@/redux/store";
import { fetchUser } from "@/redux/user/userSlice";
import { useEffect } from "react";
import { useDispatch, useSelector } from "react-redux";
import { useTranslation } from 'react-i18next';


export default function Profil() {
    const { t } = useTranslation();
    const dispatch = useDispatch<AppDispatch>()
    const currentUser = useCurrentUser()
    const user = useSelector((state: RootState) => state.user.user)
    const experiences = user?.Experience || []
    const educations = user?.Education || []
    const projects = user?.Project || []

    useEffect(() => {
        if (currentUser?.id) {
            dispatch(fetchUser(currentUser.id))
        }
    }, [currentUser?.id, dispatch])

    return <div className="w-full text-gray-200">
        <div className="mt-3">
            <div className="text-lg font-bold mb-3">{t("userInfos")}</div>
            <EditUserForm user={user || undefined} />
        </div>
        <div className="mt-3">
            <div className="text-lg font-bold">{t("experience")}</div>
            <div className="space-y-4 mb-4">
                {experiences && experiences.map((exp) => (<div key={exp.id} className="p-2 border-b-[1px] border-gray-500">
                    {formatDateToMonthYear(exp.start)} {exp.end && ` - ${formatDateToMonthYear(exp.end)}`}, {exp.title} {exp.company} 
                </div>))}
            </div>
            <ExperienceForm user={user || undefined} />
        </div>
        <div className="mt-3">
            <div className="text-lg font-bold">{t("education")}</div>
            <div className="space-y-4 mb-4">
                {educations && educations.map((edu) => (<div key={edu.id} className="p-2 border-b-[1px] border-gray-500">
                    {formatDateToMonthYear(edu.start)} {edu.end && ` - ${formatDateToMonthYear(edu.end)}`}, {edu.school} {edu.degree}
                </div>))}
            </div>
            <EducationForm user={user || undefined} />
        </div>
        <div className="mt-3 mb-6">
            <div className="text-lg font-bold">{t("projects")}</div>
            <div className="space-y-4 mb-4">
                {projects && projects.map((proj) => (<div key={proj.id} className="p-2 border-b-[1px] border-gray-500">
                    {formatDateToMonthYear(proj.start)} {proj.end && ` - ${formatDateToMonthYear(proj.end)}`}, {proj.title} {proj.url}
                </div>))}
            </div>
            <ProjectForm user={user || undefined} />
        </div>
    </div>
}