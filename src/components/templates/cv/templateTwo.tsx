"use client"

import { CvProps } from "@/helpers/schema"
import { User } from "@/redux/user/userSlice"
import { Download } from "lucide-react"
import { useTranslation } from 'react-i18next'
import { formatDateToMonthYear } from "@/lib/utils"
import DocTwo from "./docTwo"
import { DownLoadPdf } from "@/lib/downloadPdf"

export const CvTwo = ({ cv, user }: { cv: CvProps, user?: User }) => {
    const { t } = useTranslation()

    const onClickDownload = () => {
        DownLoadPdf({
            pdfElement: <DocTwo user={user!} cv={cv} t={t} />,
            filename: `${user!.name}_resume.pdf`,
        });
    };

    return (
        <>
            <div className="flex items-center text-white justify-between mb-4">
                <h2 className="text-xl font-bold">{t("resume")}</h2>
                {(user && cv) && (
                    <Download className="w-5 h-5 cursor-pointer" onClick={onClickDownload} />
                )}
            </div>
            <div
                className="max-w-[794px] mx-auto shadow-lg flex"
                style={{ width: "210mm", minHeight: "297mm" }}
            >

                {/* Main Content */}
                <main className="w-2/3 bg-white p-6">
                    <div className="mb-2">
                        <h1 className="text-2xl font-bold uppercase">{user?.name ?? "No name"}</h1>
                        <p className="text-[sm] uppercase font-semibold">{cv.title}</p>
                    </div>
                    {cv.summary && (
                        <section className="mb-4">
                            <p className="text-sm">{cv.summary}</p>
                        </section>
                    )}

                    {cv.experiences && (
                        <section className="mb-4">
                            <h2 className="text-xl font-semibold mb-2">{t("experience")}</h2>
                            {cv.experiences.map((exp, i) => (
                                <div key={i} className="mb-2">
                                    <h3 className="font-semibold text-base">{exp.title} – {exp.company}</h3>
                                    <p className="text-xs">{exp.start} – {exp.end ?? 'Present'} | {exp.location}</p>
                                    <ul className="list-disc list-inside text-sm">
                                        {exp.description?.map((desc, j) => <li key={j}>{desc}</li>)}
                                    </ul>
                                </div>
                            ))}
                        </section>
                    )}

                    {cv.educations && (
                        <section className="mb-4">
                            <h2 className="text-xl font-semibold mb-2">{t("education")}</h2>
                            {cv.educations.map((edu, i) => (
                                <div key={i} className="mb-2">
                                    <h3 className="font-semibold text-base">{edu.degree} - {edu.school}</h3>
                                    <p className="text-xs">{formatDateToMonthYear(edu.start)} - {edu.end ? formatDateToMonthYear(edu.end) : 'Present'}</p>
                                    <ul className="list-disc list-inside text-sm">
                                        {edu.description?.map((desc, j) => <li key={j}>{desc}</li>)}
                                    </ul>
                                </div>
                            ))}
                        </section>
                    )}

                    {cv.projects && (
                        <section className="mb-4">
                            <h2 className="text-xl font-semibold mb-2">{t("projects")}</h2>
                            {cv.projects.map((project, i) => (
                                <div key={i}>
                                    <h3 className="font-semibold text-sm">{project.title}</h3>
                                    <p className="text-xs text-black">{project.description}</p>
                                    <p className="text-xs text-black">Tech: {project.technologies}</p>
                                </div>
                            ))}
                        </section>
                    )}
                </main>

                {/* Sidebar */}
                <aside className="w-1/3 text-black bg-white p-6 flex flex-col justify-between">
                    <div>

                        <section className="">
                            <h2 className="text-lg font-semibold mb-2">{t("contact")}</h2>
                            <div className="text-sm space-y-1">
                                {user?.phone && `${user.phone} | `}
                                {user?.email && (<p>
                                    <a href={`mailto:${user.email}`}> {user?.email}</a>
                                </p>)}
                                {user?.email && <p className="mt-2">{user.email}</p>}
                                {user?.portfolio && (<p> | <a href={user.portfolio}>{t('portfolio')}</a></p>)}
                            </div>
                        </section>

                        <hr className="my-4 border-white/30" />
                        {cv.skills && (
                            <section className="mb-4">
                                <h2 className="text-lg font-semibold mb-2">{t("skills")}</h2>
                                <ul className="text-sm space-y-1">
                                    {cv.skills.map((skill, i) => (
                                        <li key={i}>
                                            {skill.hardskills && (<div className="mb-2">
                                                <div className="font-medium">Technical</div>
                                                <p className="text-xs">{skill.hardskills}</p>
                                            </div>)}
                                            {skill.softskills && (
                                                <div className="mb-2">
                                                    <div className="font-medium">Soft</div>
                                                    <p className="text-xs">{skill.softskills}</p>
                                                </div>
                                            )}
                                            {skill.tools && (
                                                <div className="mb-2">
                                                    <div className="font-medium">Tools</div>
                                                    <p className="text-xs">{skill.tools}</p>
                                                </div>
                                            )}
                                        </li>
                                    ))}
                                </ul>
                            </section>
                        )}
                        {cv.languages && (
                            <section>
                                <h2 className="text-lg font-semibold mb-2">{t("languages")}</h2>
                                <ul className="text-sm space-y-1">
                                    {cv.languages.map((lang, i) => (
                                        <li key={i}>{lang.language} - {lang.level}</li>
                                    ))}
                                </ul>
                            </section>
                        )}
                        {(cv.certifications && cv.certifications?.length > 0) && (
                            <section className="mb-4">
                                <h2 className="text-lg font-semibold border-b pb-1 mb-2">{t("certifications")}</h2>
                                {cv.certifications.map((cert, index) => (
                                    <div key={index} className={index > 0 ? "mt-2 leading-none" : "leading-none"}>
                                        <h3 className="font-semibold text-sm">{cert.title} – {cert.issuer}</h3>
                                        <p className="text-[12px] leading-none text-gray-600">{cert.date}</p>
                                    </div>
                                ))}
                            </section>
                        )}
                    </div>
                </aside>
            </div>
        </>
    )
}
