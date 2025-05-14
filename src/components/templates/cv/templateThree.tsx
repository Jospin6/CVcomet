"use client"
import { CvProps } from "@/helpers/schema"
import { User } from "@/redux/user/userSlice"
import { Download } from "lucide-react"
import { useTranslation } from 'react-i18next'
import { formatDateToMonthYear } from "@/lib/utils"
import DocThree from "./docThree"
import { DownLoadPdf } from "@/lib/downloadPdf"



export const CvThree = ({ cv, user }: { cv: CvProps, user?: User }) => {
    const { t } = useTranslation();

    const onClickDownload = () => {
        DownLoadPdf({
            pdfElement: <DocThree user={user!} cv={cv} t={t} />,
            filename: `${user!.name}_resume.pdf`,
        });
    };

    return (
        <>
            <div className="flex items-center text-white justify-between mb-4">
                <h2 className="text-xl font-bold">{t("resume")}</h2>
                <div className="flex gap-4">
                    {(user && cv) && (
                        <Download className="w-5 h-5 cursor-pointer" onClick={onClickDownload} />
                    )}
                </div>
            </div>

            <div className="max-w-[794px] mx-auto p-8 bg-white shadow-lg" style={{ width: "210mm", minHeight: "297mm" }}>
                <header className="text-center mb-4">
                    <h1 className="text-2xl font-bold uppercase">{user?.name ?? "No name"}</h1>
                    <p className="text-[12px] uppercase font-medium">
                        {cv.title}
                    </p>
                    <p className="text-[12px] border-y-[1px] py-1 mt-2 border-black">
                        {user?.phone && `${user.phone} | `}
                        {user?.email && (<a href={`mailto:${user.email}`}> {user?.email}</a>)}
                    </p>
                </header>

                {cv.summary && (
                    <section className="mb-2 pb-4 border-b border-black">
                        <h2 className="text-lg font-semibold mb-2">{t("summary")}</h2>
                        <p className="text-[12px] leading-relaxed">
                            {cv.summary}
                        </p>
                    </section>
                )}

                {cv.skills && (
                    <section className="mb-2 pb-4 border-b border-black">
                        <h2 className="text-lg font-semibold mb-2">{t("skills")}</h2>
                        <div className="text-[12px]">
                            {cv.skills.map((skill, index) => (
                                <div key={index} className="inline-block rounded-full text-[12px] text-black">
                                    {skill.hardskills && (<p> <span className="font-semibold">Technical: </span> {skill.hardskills}</p>)}
                                    {skill.softskills && (<p><span className="font-semibold">Soft: </span>  {skill.softskills}</p>)}
                                    {skill.tools && (<p><span className="font-semibold">Tools: </span> {skill.tools}</p>)}
                                </div>
                            ))}
                        </div>
                    </section>
                )}

                {cv.experiences && (
                    <section className="mb-2 pb-4 border-b border-black">
                        <h2 className="text-lg font-semibold mb-2">{t("experience")}</h2>
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

                {cv.educations && (
                    <section className="mb-2 pb-4 border-b border-black">
                        <h2 className="text-lg font-semibold mb-2">{t("education")}</h2>
                        {cv.educations.map((edu, index) => (
                            <div key={index} className={index > 0 ? "mt-2" : ""}>
                                <div className="flex justify-between text-black font-semibold">
                                    <h3 className="text-sm">{edu.degree}</h3>
                                    <p className="text-xs ">{formatDateToMonthYear(edu.start)} - {edu.end ? formatDateToMonthYear(edu.end) : 'Present'}</p>
                                </div>
                                <div className="text-xs ">{edu.school}</div>
                                <ul className="list-disc list-inside text-[12px]">
                                    {edu.description && edu.description.map((desc, i) => (
                                        <li key={i}>{desc}</li>
                                    ))}
                                </ul>
                            </div>
                        ))}
                    </section>
                )}



                {cv.projects && (
                    <section className="mb-2 pb-4 border-b border-black">
                        <h2 className="text-lg font-semibold mb-2">{t("projects")}</h2>
                        {cv.projects.map((project, index) => (
                            <div key={index} className={index > 0 ? "mt-2" : ""}>
                                <h3 className="font-semibold text-sm">{project.title}</h3>
                                <p className="text-xs text-black">{project.description}</p>
                                <p className="text-xs text-black">Tech: {project.technologies}</p>
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
                                    <span className="font-medium">Languages: </span>
                                    {cv.languages && cv.languages.map((lang, index) => (
                                        <span key={index} >
                                            {lang.language}
                                        </span>
                                    ))}
                                </li>
                            )}
                            {(cv.certifications && cv.certifications.length > 0) && (
                                <li>
                                    <span className="font-medium">Certifications: </span>
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
        </>
    )
}