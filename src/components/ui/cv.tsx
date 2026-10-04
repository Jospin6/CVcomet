"use client"
import { CvProps } from "@/helpers/schema"
import { User } from "@/redux/user/userSlice"
import { Button } from "@/components/ui/button";
import { Download } from "lucide-react"
import { useTranslation } from 'react-i18next'
import DocZero from "../templates/cv/docZero"
import { DownLoadPdf } from "@/lib/downloadPdf"
import { formatDateToMonthYear } from "@/lib/utils"



export const Cv = ({ cv, user }: { cv: CvProps, user?: User }) => {
    const { t } = useTranslation();
    const onClickDownload = () => {
        DownLoadPdf({
            pdfElement: <DocZero user={user!} cv={cv} t={t} />,
            filename: `${user!.name}_resume.pdf`,
        });
    };

    return (
        <>
            <div className="flex items-center text-foreground justify-between gap-3 mb-4">
                <h2 className="text-xl font-bold">{t("resume")}</h2>
                <div className="flex gap-4">
                    {(user && cv) && (
                        <Button variant="outline" size="sm" aria-label={t("shell.download")} onClick={onClickDownload}><Download className="size-4"/><span className="hidden sm:inline">{t("shell.download")}</span></Button>
                    )}
                </div>
            </div>
            <div className="document-scroll" role="region" tabIndex={0} aria-label={t("shell.preview")}>
            <div className="w-[794px] min-h-[1123px] mx-auto p-8 document-paper bg-white shadow-lg">
                <header className="text-center mb-6">
                    <h1 className="text-3xl font-bold uppercase">{user?.name ?? "No name"}</h1>
                    <p className="text-sm uppercase font-medium">
                        {cv.title}
                    </p>
                    <p className="text-[12px]">
                        {user?.phone && `${user.phone} | `}
                        {user?.email && (<a href={`mailto:${user.email}`}> {user?.email}</a>)}
                        {user?.portfolio && (<span> | <a href={user.portfolio}>{t('portfolio')}</a></span>)}
                    </p>
                </header>

                {cv.summary && (
                    <section className="mb-2">
                        <h2 className="text-lg font-semibold border-b pb-1 mb-2 border-black">{t("summary")}</h2>
                        <p className="text-[12px] leading-relaxed">
                            {cv.summary}
                        </p>
                    </section>
                )}

                {cv.experiences && (
                    <section className="mb-2">
                        <h2 className="text-lg font-semibold border-b pb-1 mb-2 border-black">{t("experience")}</h2>
                        {cv.experiences.map((exp, index) => (
                            <div key={index} className={index > 0 ? "mt-2" : ""}>
                                <div className="flex justify-between font-semibold">
                                    <h3 className="text-sm">{exp.title}, {exp.company}</h3>
                                    <p className="text-xs">
                                        {exp.start} – {exp.end ?? 'Present'} | {exp.location}
                                    </p>
                                </div>
                                <ul className="list-disc list-inside text-[12px]">
                                    {exp.description && exp.description.map((desc, i) => (
                                        <li key={i}>{desc}</li>
                                    ))}
                                </ul>
                            </div>
                        ))}
                    </section>
                )}

                {cv.projects && (
                    <section className="mb-2">
                        <h2 className="text-lg font-semibold border-b pb-1 mb-2 border-black">{t("projects")}</h2>
                        {cv.projects.map((project, index) => (
                            <div key={index} className={index > 0 ? "mt-2" : ""}>
                                <h3 className="font-semibold text-sm">{project.title}</h3>
                                <p className="text-xs text-black">{project.description}</p>
                                <p className="text-xs text-black">Tech: {project.technologies}</p>
                            </div>
                        ))}
                    </section>
                )}

                {cv.skills && (
                    <section className="mb-2">
                        <h2 className="text-lg font-semibold border-b pb-1 mb-2 border-black">{t("skills")}</h2>
                        <div className="text-[12px]">
                            {cv.skills.map((skill, index) => (
                                <div key={index} className="inline-block rounded-full text-[12px] text-black">
                                    {skill.hardskills && (<p>{skill.hardskills}</p>)}
                                    {skill.softskills && (<p>{skill.softskills}</p>)}
                                    {skill.tools && (<p>{skill.tools}</p>)}
                                </div>
                            ))}
                        </div>
                    </section>
                )}

                {cv.educations && (
                    <section className="mb-2">
                        <h2 className="text-lg font-semibold border-b pb-1 mb-2 border-black">{t("education")}</h2>
                        {cv.educations.map((edu, index) => (
                            <div key={index} className={index > 0 ? "mt-2" : ""}>
                                <div className="flex justify-between text-black font-semibold">
                                    <h3 className="text-sm">{edu.degree}</h3>
                                    <p className="text-xs ">{formatDateToMonthYear(edu.start)} - {edu.end ? formatDateToMonthYear(edu.end) : 'Present'}</p>
                                </div>
                                <div className="text-xs">{edu.school}</div>
                                <ul className="list-disc list-inside text-[12px]">
                                    {edu.description && edu.description.map((desc, i) => (
                                        <li key={i}>{desc}</li>
                                    ))}
                                </ul>
                            </div>
                        ))}
                    </section>
                )}

                {((cv.languages && cv.languages?.length > 0) || (cv.certifications && cv.certifications.length > 0)) && (
                    <section className="mb-4">
                        <h2 className="text-lg font-semibold mb-2">{t("additional")}</h2>
                        <ul className="text-xs">
                            {(cv.languages && cv.languages?.length > 0) && (
                                <li>
                                    <span className="font-medium">{t("languages")}: </span>
                                    {cv.languages && cv.languages.map((lang, index) => (
                                        <span key={index} >
                                            {lang.language}{" "}
                                        </span>
                                    ))}
                                </li>
                            )}
                            {(cv.certifications && cv.certifications.length > 0) && (
                                <li>
                                    <span className="font-medium">{t("certifications")}: </span>
                                    {cv.certifications.map((cert, index) => (
                                        <span key={index} >
                                            {cert.title}, {cert.issuer}
                                        </span>
                                    ))}
                                </li>
                            )}
                        </ul>
                    </section>
                )}
            </div>
        </div>
        </>
    )
}