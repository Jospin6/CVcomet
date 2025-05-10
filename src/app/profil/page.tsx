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
import { Button } from "@/components/ui/button";
import { logout } from "@/redux/auth/authSlice";
import { redirect } from "next/navigation";
import { Accordion, AccordionContent, AccordionItem, AccordionTrigger } from "@/components/ui/accordion";
import CertificationForm from "@/components/forms/certificationForm";


export default function Profil() {
    const { t } = useTranslation();
    const dispatch = useDispatch<AppDispatch>()
    const currentUser = useCurrentUser()
    const user = useSelector((state: RootState) => state.user.user)
    const experiences = user?.Experience || []
    const educations = user?.Education || []
    const projects = user?.Project || []
    const certifications = user?.certifications || []

    const handleLogout = () => {
        dispatch(logout({ id: currentUser?.id || "" }))
        redirect("/login")
    }

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
                {experiences && experiences.map((exp) => (
                    <Accordion key={exp.id} type="single" collapsible>
                        <AccordionItem value="item-1">
                            <AccordionTrigger>{formatDateToMonthYear(exp.start)} {exp.end && ` - ${formatDateToMonthYear(exp.end)}`}, {exp.title} {exp.company}</AccordionTrigger>
                            <AccordionContent>
                                {exp.description}
                            </AccordionContent>
                        </AccordionItem>
                    </Accordion>
                ))}
            </div>
            <ExperienceForm user={user || undefined} />
        </div>
        <div className="mt-3">
            <div className="text-lg font-bold">{t("education")}</div>
            <div className="space-y-4 mb-4">
                {educations && educations.map((edu) => (
                    <Accordion key={edu.id} type="single" collapsible>
                        <AccordionItem value="item-1">
                            <AccordionTrigger>{formatDateToMonthYear(edu.start)} {edu.end && ` - ${formatDateToMonthYear(edu.end)}`}, {edu.school} {edu.degree}</AccordionTrigger>
                            <AccordionContent>
                                {edu.description}
                            </AccordionContent>
                        </AccordionItem>
                    </Accordion>

                ))}
            </div>
            <EducationForm user={user || undefined} />
        </div>
        <div className="mt-3">
            <div className="text-lg font-bold">{t("projects")}</div>
            <div className="space-y-4 mb-4">
                {projects && projects.map((proj) => (
                    <Accordion key={proj.id} type="single" collapsible>
                        <AccordionItem value="item-1">
                            <AccordionTrigger>{formatDateToMonthYear(proj.start)} {proj.end && ` - ${formatDateToMonthYear(proj.end)}`}, {proj.title} {proj.url}</AccordionTrigger>
                            <AccordionContent>
                                {proj.description}
                            </AccordionContent>
                        </AccordionItem>
                    </Accordion>
                ))}
            </div>
            <ProjectForm user={user || undefined} />
        </div>

        <div className="mt-3 mb-6">
            <div className="text-lg font-bold">{t("certificationss")}</div>
            <div className="space-y-4 mb-4">
                {certifications && certifications.map((cert) => (
                    <Accordion key={cert.id} type="single" collapsible>
                        <AccordionItem value="item-1">
                            <AccordionTrigger>{formatDateToMonthYear(cert.date)} {cert.name} {cert.organization}</AccordionTrigger>
                            <AccordionContent>
                                {cert.description}
                            </AccordionContent>
                        </AccordionItem>
                    </Accordion>
                ))}
            </div>
            <CertificationForm user={user || undefined} />
        </div>

        <div>
            <Button onClick={handleLogout} className="bg-red-700 text-gray-200">Logout</Button>
        </div>
    </div>
}