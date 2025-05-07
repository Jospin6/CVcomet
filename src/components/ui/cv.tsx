"use client"
import { CvProps } from "@/helpers/schema"
import { User } from "@/redux/user/userSlice"
import { Download, RefreshCcw } from "lucide-react"
import html2canvas from "html2canvas-pro"
import jsPDF from "jspdf"
import { useRef } from "react"
import { useTranslation } from 'react-i18next'



export const Cv = ({ cv, user }: { cv: CvProps, user?: User }) => {
    const { t } = useTranslation();
    const cvRef = useRef<HTMLDivElement>(null);

    const handleDownload = async () => {
        const element = cvRef.current;
        if (!element) return;

        const canvas = await html2canvas(element, { scale: 2 });
        const imgData = canvas.toDataURL("image/png");
        const pdf = new jsPDF("p", "mm", "a4");

        const imgProps = pdf.getImageProperties(imgData);
        const pdfWidth = pdf.internal.pageSize.getWidth();
        const pdfHeight = (imgProps.height * pdfWidth) / imgProps.width;

        pdf.addImage(imgData, "PNG", 0, 0, pdfWidth, pdfHeight);
        pdf.save("cv.pdf");
    };

    return (
        <>
            <div className="flex items-center text-white justify-between mb-4">
                <h2 className="text-xl font-bold">Cv</h2>
                <div className="flex gap-4">
                    <button
                        onClick={handleDownload}
                        className="p-1 rounded hover:border-[1px] cursor-pointer"
                        aria-label="Download CV"
                    >
                        <Download className="w-5 h-5" />
                    </button>
                </div>
            </div>
            <div ref={cvRef} className="max-w-[794px] mx-auto p-8 bg-white shadow-lg" style={{ width: "210mm", minHeight: "297mm" }}>
                <header className="text-center mb-6">
                    <h1 className="text-3xl font-bold uppercase">{user?.name ?? "No name"}</h1>
                    <p className="text-sm">
                        {cv.title}
                    </p>
                    <p className="text-sm">
                        {user?.linkedin && `LinkedIn | `}
                        {user?.email && (<a href={`mailto:${user.email}`}> {user?.email}</a>)}
                        {user?.github && ` | GitHub`}
                    </p>
                </header>

                {cv.summary && (
                    <section className="mb-4">
                        <h2 className="text-xl font-semibold border-b pb-1 mb-2">{t("summary")}</h2>
                        <p className="text-sm leading-relaxed">
                            {cv.summary}
                        </p>
                    </section>
                )}

                {cv.experiences && (
                    <section className="mb-4">
                        <h2 className="text-xl font-semibold border-b pb-1 mb-2">{t("experience")}</h2>
                        {cv.experiences.map((exp, index) => (
                            <div key={index} className={index > 0 ? "mt-2" : ""}>
                                <h3 className="font-semibold text-sm">{exp.title} – {exp.company}</h3>
                                <p className="text-xs text-gray-600">
                                    {exp.start} – {exp.end ?? 'Present'} | {exp.location}
                                </p>
                                <ul className="list-disc list-inside text-sm">
                                    {exp.description && exp.description.map((desc, i) => (
                                        <li key={i}>{desc}</li>
                                    ))}
                                </ul>
                            </div>
                        ))}
                    </section>
                )}

                {cv.educations && (
                    <section className="mb-4">
                        <h2 className="text-xl font-semibold border-b pb-1 mb-2">{t("education")}</h2>
                        {cv.educations.map((edu, index) => (
                            <div key={index} className={index > 0 ? "mt-2" : ""}>
                                <h3 className="font-semibold text-sm">{edu.degree} - {edu.school}</h3>
                                <p className="text-xs text-gray-600">{edu.start} - {edu.end ?? 'Present'}</p>
                                <ul className="list-disc list-inside text-sm">
                                    {edu.description && edu.description.map((desc, i) => (
                                        <li key={i}>{desc}</li>
                                    ))}
                                </ul>
                            </div>
                        ))}
                    </section>
                )}

                {cv.skills && (
                    <section>
                        <h2 className="text-xl font-semibold border-b pb-1 mb-2">{t("skills")}</h2>
                        <div className="text-sm">
                            {cv.skills.map((skill, index) => (
                                <div key={index} className="inline-block rounded-full py-1 text-sm text-gray-700 mr-2 mb-2">
                                    {skill.hardskills && (<p> <span className="font-semibold">Technical: </span> {skill.hardskills}</p>)}
                                    {skill.softskills && (<p><span className="font-semibold">Soft: </span>  {skill.softskills}</p>)}
                                    {skill.tools && (<p><span className="font-semibold">Tools: </span> {skill.tools}</p>)}
                                </div>
                            ))}
                        </div>
                    </section>
                )}

                {cv.languages && (
                    <section className="mb-4">
                        <h2 className="text-xl font-semibold border-b pb-1 mb-2">{t("languages")}</h2>
                        {cv.languages.map((lang, index) => (
                            <div key={index} className={index > 0 ? "mt-2" : ""}>
                                <h3 className="font-semibold text-sm">{lang.language}</h3>
                                <p className="text-xs text-gray-600">Proficiency: {lang.level}</p>
                            </div>
                        ))}
                    </section>
                )}

                {cv.projects && (
                    <section className="mb-4">
                        <h2 className="text-xl font-semibold border-b pb-1 mb-2">{t("projects")}</h2>
                        {cv.projects.map((project, index) => (
                            <div key={index} className={index > 0 ? "mt-2" : ""}>
                                <h3 className="font-semibold text-sm">{project.title}</h3>
                                <p className="text-xs text-gray-600">{project.description}</p>
                                <p className="text-xs text-gray-600">Technologies: {project.technologies}</p>
                                {/* {project.link && (
                                <p className="text-xs text-blue-500">
                                    <a href={project.link} target="_blank" rel="noopener noreferrer">View Project</a>
                                </p>
                            )} */}
                            </div>
                        ))}
                    </section>
                )}

                {(cv.certifications && cv.certifications?.length > 0) && (
                    <section className="mb-4">
                        <h2 className="text-xl font-semibold border-b pb-1 mb-2">{t("certifications")}</h2>
                        {cv.certifications.map((cert, index) => (
                            <div key={index} className={index > 0 ? "mt-2" : ""}>
                                <h3 className="font-semibold text-sm">{cert.title} – {cert.issuer}</h3>
                                <p className="text-xs text-gray-600">{cert.date}</p>
                                {cert.description && <p className="text-xs text-gray-600">{cert.description}</p>}
                            </div>
                        ))}
                    </section>
                )}
            </div>
        </>
    )
}