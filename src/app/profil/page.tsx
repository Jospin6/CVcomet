"use client"

import { useEffect, useRef, useState } from "react";
import { useDispatch, useSelector } from "react-redux";
import { useTranslation } from 'react-i18next';
import { useCurrentUser } from "@/hooks/useCurrentUser";
import { AppDispatch, RootState } from "@/redux/store";
import { fetchUser } from "@/redux/user/userSlice";
import { formatDateToMonthYear } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { Accordion, AccordionContent, AccordionItem, AccordionTrigger } from "@/components/ui/accordion";
import EditUserForm from "@/components/forms/editUserForm";
import EducationForm from "@/components/forms/educationForm";
import ExperienceForm from "@/components/forms/experienceForm";
import ProjectForm from "@/components/forms/projectForm";
import CertificationForm from "@/components/forms/certificationForm";
import { logout } from "@/redux/auth/authSlice";
import { redirect } from "next/navigation";
import { deleteExperience, fetchExperiences, selectExperiences } from "@/redux/experience/experienceSlice";
import { deleteEducation, fetchEducation, selectEducation } from "@/redux/education/educationSlice";
import { deleteProject, fetchProjects, selectProjects } from "@/redux/project/projectSlice";
import { deleteCertification, fetchCertifications, selectCertifications } from "@/redux/certification/certificationSlice";

export default function Profil() {
    const { t } = useTranslation();
    const dispatch = useDispatch<AppDispatch>();
    const currentUser = useCurrentUser();
    const user = useSelector((state: RootState) => state.user.user);
    const experiences = useSelector(selectExperiences);
    const educations = useSelector(selectEducation);
    const projects = useSelector(selectProjects);
    const certifications = useSelector(selectCertifications);

    const [loadingDeleteId, setLoadingDeleteId] = useState<string | null>(null);

    const handleLogout = () => {
        dispatch(logout({ id: currentUser?.id || "" }));
        redirect("/login");
    };

    const hasFetched = useRef(false);

    useEffect(() => {
        if (currentUser?.id && !hasFetched.current) {
            dispatch(fetchUser(currentUser.id));
            dispatch(fetchExperiences(currentUser.id));
            dispatch(fetchEducation(currentUser.id));
            dispatch(fetchProjects(currentUser.id));
            dispatch(fetchCertifications(currentUser.id));
            hasFetched.current = true;
        }
    }, [currentUser?.id]);

    const handleDelete = async (type: "exp" | "edu" | "proj" | "cert", id: string) => {
        setLoadingDeleteId(id);
        try {
            if (type === "exp") await dispatch(deleteExperience(id));
            if (type === "edu") await dispatch(deleteEducation(id));
            if (type === "proj") await dispatch(deleteProject(id));
            if (type === "cert") await dispatch(deleteCertification(id));
        } finally {
            setLoadingDeleteId(null);
        }
    };

    return (
        <div className="w-full text-gray-200">
            <div className="mt-3">
                <div className="text-lg font-bold mb-3">{t("userInfos")}</div>
                <EditUserForm user={user || undefined} />
            </div>

            {/* EXPERIENCE */}
            <div className="mt-3">
                <div className="text-lg font-bold">{t("experience")}</div>
                <div className="space-y-4 mb-4">
                    {experiences.map((exp) => (
                        <Accordion key={exp.id} type="single" collapsible>
                            <AccordionItem value="item-1">
                                <AccordionTrigger>
                                    {formatDateToMonthYear(exp.start)} {exp.end && ` - ${formatDateToMonthYear(exp.end)}`}, {exp.title} {exp.company}
                                </AccordionTrigger>
                                <AccordionContent>
                                    {exp.description}
                                    <div className="mt-3">
                                        <Button
                                            disabled={loadingDeleteId === exp.id}
                                            onClick={() => handleDelete("exp", exp.id)}
                                            className="text-white bg-red-600 py-1 cursor-pointer"
                                        >
                                            {loadingDeleteId === exp.id ? "Deleting..." : "Delete"}
                                        </Button>
                                    </div>
                                </AccordionContent>
                            </AccordionItem>
                        </Accordion>
                    ))}
                </div>
                <ExperienceForm user={user || undefined} />
            </div>

            {/* EDUCATION */}
            <div className="mt-3">
                <div className="text-lg font-bold">{t("education")}</div>
                <div className="space-y-4 mb-4">
                    {educations.map((edu) => (
                        <Accordion key={edu.id} type="single" collapsible>
                            <AccordionItem value="item-1">
                                <AccordionTrigger>
                                    {formatDateToMonthYear(edu.start)} {edu.end && ` - ${formatDateToMonthYear(edu.end)}`}, {edu.school} {edu.degree}
                                </AccordionTrigger>
                                <AccordionContent>
                                    {edu.description}
                                    <div className="mt-3">
                                        <Button
                                            disabled={loadingDeleteId === edu.id}
                                            onClick={() => handleDelete("edu", edu.id)}
                                            className="text-white bg-red-600 py-1 cursor-pointer"
                                        >
                                            {loadingDeleteId === edu.id ? "Deleting..." : "Delete"}
                                        </Button>
                                    </div>
                                </AccordionContent>
                            </AccordionItem>
                        </Accordion>
                    ))}
                </div>
                <EducationForm user={user || undefined} />
            </div>

            {/* PROJECTS */}
            <div className="mt-3">
                <div className="text-lg font-bold">{t("projects")}</div>
                <div className="space-y-4 mb-4">
                    {projects.map((proj) => (
                        <Accordion key={proj.id} type="single" collapsible>
                            <AccordionItem value="item-1">
                                <AccordionTrigger>
                                    {formatDateToMonthYear(proj.start)} {proj.end && ` - ${formatDateToMonthYear(proj.end)}`}, {proj.title} {proj.url}
                                </AccordionTrigger>
                                <AccordionContent>
                                    {proj.description}
                                    <div className="mt-3">
                                        <Button
                                            disabled={loadingDeleteId === proj.id}
                                            onClick={() => handleDelete("proj", proj.id)}
                                            className="text-white bg-red-600 py-1 cursor-pointer"
                                        >
                                            {loadingDeleteId === proj.id ? "Deleting..." : "Delete"}
                                        </Button>
                                    </div>
                                </AccordionContent>
                            </AccordionItem>
                        </Accordion>
                    ))}
                </div>
                <ProjectForm user={user || undefined} />
            </div>

            {/* CERTIFICATIONS */}
            <div className="mt-3 mb-6">
                <div className="text-lg font-bold">{t("certificationss")}</div>
                <div className="space-y-4 mb-4">
                    {certifications.map((cert) => (
                        <Accordion key={cert.id} type="single" collapsible>
                            <AccordionItem value="item-1">
                                <AccordionTrigger>
                                    {formatDateToMonthYear(cert.date)} {cert.name} {cert.organization}
                                </AccordionTrigger>
                                <AccordionContent>
                                    {cert.description}
                                    <div className="mt-3">
                                        <Button
                                            disabled={loadingDeleteId === cert.id}
                                            onClick={() => handleDelete("cert", cert.id!)}
                                            className="text-white bg-red-600 py-1 cursor-pointer"
                                        >
                                            {loadingDeleteId === cert.id ? "Deleting..." : "Delete"}
                                        </Button>
                                    </div>
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
    );
}
