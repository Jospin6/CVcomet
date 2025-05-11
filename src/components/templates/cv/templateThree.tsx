"use client"

import { CvProps } from "@/helpers/schema"
import { User } from "@/redux/user/userSlice"
import { Download } from "lucide-react"
import html2canvas from "html2canvas-pro"
import jsPDF from "jspdf"
import { useRef } from "react"
import { useTranslation } from 'react-i18next'

export const CvThree = ({ cv, user }: { cv: CvProps, user?: User }) => {
    const { t } = useTranslation()
    const cvRef = useRef<HTMLDivElement>(null)

    const handleDownload = async () => {
        const element = cvRef.current
        if (!element) return

        const canvas = await html2canvas(element, { scale: 2 })
        const imgData = canvas.toDataURL("image/png")
        const pdf = new jsPDF("p", "mm", "a4")
        const imgProps = pdf.getImageProperties(imgData)
        const pdfWidth = pdf.internal.pageSize.getWidth()
        const pdfHeight = (imgProps.height * pdfWidth) / imgProps.width
        pdf.addImage(imgData, "PNG", 0, 0, pdfWidth, pdfHeight)
        pdf.save("cv-template-three.pdf")
    }

    return (
        <>
            <div className="flex items-center justify-between mb-4 text-gray-800">
                <h2 className="text-xl font-bold">{t("resume")}</h2>
                <button
                    onClick={handleDownload}
                    className="p-1 rounded hover:border cursor-pointer"
                    aria-label="Download CV"
                >
                    <Download className="w-5 h-5" />
                </button>
            </div>
            <div
                ref={cvRef}
                className="max-w-[794px] mx-auto shadow-lg px-10 py-8 bg-white"
                style={{ width: "210mm", minHeight: "297mm" }}
            >
                <header className="text-center mb-6">
                    <h1 className="text-4xl font-extrabold uppercase tracking-widest">{user?.name ?? "No Name"}</h1>
                    <p className="text-lg text-gray-600">{cv.title}</p>
                    <div className="mt-2 text-sm text-gray-700 flex flex-col items-center gap-1">
                        {user?.email && <p>{user.email}</p>}
                        {user?.linkedin && <p>{user.linkedin}</p>}
                        {user?.github && <p>{user.github}</p>}
                    </div>
                </header>

                <hr className="border-t-2 border-gray-200 mb-6" />

                {cv.summary && (
                    <section className="mb-6">
                        <h2 className="uppercase text-gray-700 text-sm tracking-widest font-semibold mb-2">{t("summary")}</h2>
                        <p className="text-sm text-gray-800">{cv.summary}</p>
                    </section>
                )}

                {cv.experiences && (
                    <section className="mb-6">
                        <h2 className="uppercase text-gray-700 text-sm tracking-widest font-semibold mb-2">{t("experience")}</h2>
                        {cv.experiences.map((exp, i) => (
                            <div key={i} className="mb-4">
                                <h3 className="font-semibold text-base">{exp.title} – {exp.company}</h3>
                                <p className="text-xs text-gray-500">{exp.start} – {exp.end ?? 'Present'} | {exp.location}</p>
                                <ul className="list-disc list-inside text-sm text-gray-800">
                                    {exp.description?.map((desc, j) => <li key={j}>{desc}</li>)}
                                </ul>
                            </div>
                        ))}
                    </section>
                )}

                {cv.educations && (
                    <section className="mb-6">
                        <h2 className="uppercase text-gray-700 text-sm tracking-widest font-semibold mb-2">{t("education")}</h2>
                        {cv.educations.map((edu, i) => (
                            <div key={i} className="mb-4">
                                <h3 className="font-semibold text-base">{edu.degree} - {edu.school}</h3>
                                <p className="text-xs text-gray-500">{edu.start} - {edu.end ?? 'Present'}</p>
                                <ul className="list-disc list-inside text-sm text-gray-800">
                                    {edu.description?.map((desc, j) => <li key={j}>{desc}</li>)}
                                </ul>
                            </div>
                        ))}
                    </section>
                )}

                {cv.projects && (
                    <section className="mb-6">
                        <h2 className="uppercase text-gray-700 text-sm tracking-widest font-semibold mb-2">{t("projects")}</h2>
                        {cv.projects.map((project, i) => (
                            <div key={i} className="mb-4">
                                <h3 className="font-semibold text-base">{project.title}</h3>
                                <p className="text-sm text-gray-800">{project.description}</p>
                                <p className="text-xs text-gray-500">Technologies: {project.technologies}</p>
                            </div>
                        ))}
                    </section>
                )}

                {cv.certifications && (
                    <section className="mb-6">
                        <h2 className="uppercase text-gray-700 text-sm tracking-widest font-semibold mb-2">{t("certifications")}</h2>
                        {cv.certifications.map((cert, i) => (
                            <div key={i} className="mb-4">
                                <h3 className="font-semibold text-base">{cert.title} – {cert.issuer}</h3>
                                <p className="text-xs text-gray-500">{cert.date}</p>
                                {cert.description && <p className="text-sm text-gray-800">{cert.description}</p>}
                            </div>
                        ))}
                    </section>
                )}

                {cv.skills && (
                    <section className="mb-6">
                        <h2 className="uppercase text-gray-700 text-sm tracking-widest font-semibold mb-2">{t("skills")}</h2>
                        <ul className="text-sm text-gray-800 space-y-1">
                            {cv.skills.map((skill, i) => (
                                <li key={i}>
                                    {skill.hardskills && <p><strong>Tech:</strong> {skill.hardskills}</p>}
                                    {skill.softskills && <p><strong>Soft:</strong> {skill.softskills}</p>}
                                    {skill.tools && <p><strong>Tools:</strong> {skill.tools}</p>}
                                </li>
                            ))}
                        </ul>
                    </section>
                )}

                {cv.languages && (
                    <section>
                        <h2 className="uppercase text-gray-700 text-sm tracking-widest font-semibold mb-2">{t("languages")}</h2>
                        <ul className="text-sm text-gray-800 space-y-1">
                            {cv.languages.map((lang, i) => (
                                <li key={i}>{lang.language} - {lang.level}</li>
                            ))}
                        </ul>
                    </section>
                )}
            </div>
        </>
    )
}
