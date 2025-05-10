"use client"

import { CvProps } from "@/helpers/schema"
import { User } from "@/redux/user/userSlice"
import { Download } from "lucide-react"
import html2canvas from "html2canvas-pro"
import jsPDF from "jspdf"
import { useRef } from "react"
import { useTranslation } from 'react-i18next'

export const CvTwo = ({ cv, user }: { cv: CvProps, user?: User }) => {
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
        pdf.save("cv-template-two.pdf")
    }

    return (
        <>
            <div className="flex items-center text-white justify-between mb-4">
                <h2 className="text-xl font-bold">Resume</h2>
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
                className="max-w-[794px] mx-auto shadow-lg flex"
                style={{ width: "210mm", minHeight: "297mm" }}
            >
                {/* Sidebar */}

                <aside className="w-1/3 bg-blue-900 text-white p-6 flex flex-col justify-between">
                    <div>
                        <h1 className="text-2xl font-bold uppercase">{user?.name ?? "No name"}</h1>
                        <p className="text-sm">{cv.title}</p>
                        <hr className="my-4 border-white/30" />
                        {cv.skills && (
                            <section className="mb-4">
                                <h2 className="text-lg font-semibold mb-2">{t("skills")}</h2>
                                <ul className="text-sm space-y-1">
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
                                <h2 className="text-lg font-semibold mb-2">{t("languages")}</h2>
                                <ul className="text-sm space-y-1">
                                    {cv.languages.map((lang, i) => (
                                        <li key={i}>{lang.language} - {lang.level}</li>
                                    ))}
                                </ul>
                            </section>
                        )}
                    </div>

                    <div className="text-sm mt-4">
                        {user?.email && <p className="mt-2">📧 {user.email}</p>}
                        {user?.linkedin && <p>🔗 LinkedIn: {user.linkedin}</p>}
                        {user?.github && <p>💻 GitHub: {user.github}</p>}
                    </div>
                </aside>

                {/* Main Content */}
                <main className="w-2/3 bg-white p-6">
                    {cv.summary && (
                        <section className="mb-4">
                            <h2 className="text-xl font-semibold mb-2">{t("summary")}</h2>
                            <p className="text-sm">{cv.summary}</p>
                        </section>
                    )}

                    {cv.experiences && (
                        <section className="mb-4">
                            <h2 className="text-xl font-semibold mb-2">{t("experience")}</h2>
                            {cv.experiences.map((exp, i) => (
                                <div key={i} className="mb-2">
                                    <h3 className="font-semibold text-base">{exp.title} – {exp.company}</h3>
                                    <p className="text-xs text-gray-600">{exp.start} – {exp.end ?? 'Present'} | {exp.location}</p>
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
                                    <p className="text-xs text-gray-600">{edu.start} - {edu.end ?? 'Present'}</p>
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
                                <div key={i} className="mb-2">
                                    <h3 className="font-semibold text-base">{project.title}</h3>
                                    <p className="text-sm">{project.description}</p>
                                    <p className="text-xs text-gray-600">Technologies: {project.technologies}</p>
                                </div>
                            ))}
                        </section>
                    )}

                    {cv.certifications && (
                        <section>
                            <h2 className="text-xl font-semibold mb-2">{t("certifications")}</h2>
                            {cv.certifications.map((cert, i) => (
                                <div key={i} className="mb-2">
                                    <h3 className="font-semibold text-base">{cert.title} – {cert.issuer}</h3>
                                    <p className="text-xs text-gray-600">{cert.date}</p>
                                    {cert.description && <p className="text-sm">{cert.description}</p>}
                                </div>
                            ))}
                        </section>
                    )}
                </main>
            </div>
        </>
    )
}
