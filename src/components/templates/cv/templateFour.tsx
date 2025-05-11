"use client";

import { CvProps } from "@/helpers/schema";
import { User } from "@/redux/user/userSlice";
import { Download } from "lucide-react";
import html2canvas from "html2canvas-pro";
import jsPDF from "jspdf";
import { useRef } from "react";
import { useTranslation } from "react-i18next";

export const CvFour = ({ cv, user }: { cv: CvProps; user?: User }) => {
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
      <div className="flex items-center justify-between text-white mb-4">
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
        className="max-w-[794px] mx-auto p-8 bg-white text-black shadow"
        style={{ width: "210mm", minHeight: "297mm", fontSize: "12px" }}
      >
        <header className="text-center mb-4">
          <h1 className="text-2xl font-bold uppercase">{user?.name ?? "No Name"}</h1>
          <p>{cv.title}</p>
          <div className="text-sm">
            {user?.email && <a href={`mailto:${user.email}`}>{user.email}</a>}
            {user?.linkedin && <> | LinkedIn: {user.linkedin}</>}
            {user?.github && <> | GitHub: {user.github}</>}
          </div>
        </header>

        {cv.summary && (
          <section className="mb-4">
            <h2 className="text-lg font-semibold border-b border-gray-300 mb-1">{t("summary")}</h2>
            <p className="leading-relaxed">{cv.summary}</p>
          </section>
        )}

        {cv.experiences && (
          <section className="mb-4">
            <h2 className="text-lg font-semibold border-b border-gray-300 mb-1">{t("experience")}</h2>
            {cv.experiences.map((exp, index) => (
              <div key={index} className="mb-2">
                <h3 className="font-semibold">{exp.title} – {exp.company}</h3>
                <p className="text-xs text-gray-700">{exp.start} – {exp.end ?? "Present"} | {exp.location}</p>
                {exp.description && (
                  <ul className="list-disc list-inside text-sm">
                    {exp.description.map((desc, i) => <li key={i}>{desc}</li>)}
                  </ul>
                )}
              </div>
            ))}
          </section>
        )}

        {cv.educations && (
          <section className="mb-4">
            <h2 className="text-lg font-semibold border-b border-gray-300 mb-1">{t("education")}</h2>
            {cv.educations.map((edu, index) => (
              <div key={index} className="mb-2">
                <h3 className="font-semibold">{edu.degree} – {edu.school}</h3>
                <p className="text-xs text-gray-700">{edu.start} – {edu.end ?? "Present"}</p>
                {edu.description && (
                  <ul className="list-disc list-inside text-sm">
                    {edu.description.map((desc, i) => <li key={i}>{desc}</li>)}
                  </ul>
                )}
              </div>
            ))}
          </section>
        )}

        {cv.skills && (
          <section className="mb-4">
            <h2 className="text-lg font-semibold border-b border-gray-300 mb-1">{t("skills")}</h2>
            {cv.skills.map((skill, index) => (
              <div key={index} className="mb-1">
                {skill.hardskills && <p><span className="font-semibold">Technical:</span> {skill.hardskills}</p>}
                {skill.softskills && <p><span className="font-semibold">Soft:</span> {skill.softskills}</p>}
                {skill.tools && <p><span className="font-semibold">Tools:</span> {skill.tools}</p>}
              </div>
            ))}
          </section>
        )}

        {cv.projects && (
          <section className="mb-4">
            <h2 className="text-lg font-semibold border-b border-gray-300 mb-1">{t("projects")}</h2>
            {cv.projects.map((project, index) => (
              <div key={index} className="mb-2">
                <h3 className="font-semibold">{project.title}</h3>
                <p className="text-sm">{project.description}</p>
                <p className="text-xs text-gray-700">Technologies: {project.technologies}</p>
              </div>
            ))}
          </section>
        )}

        {cv.languages && (
          <section className="mb-4">
            <h2 className="text-lg font-semibold border-b border-gray-300 mb-1">{t("languages")}</h2>
            {cv.languages.map((lang, index) => (
              <div key={index} className="mb-1">
                <p className="font-semibold">{lang.language} - <span className="text-sm text-gray-700">Proficiency: {lang.level}</span></p>
              </div>
            ))}
          </section>
        )}

        {cv.certifications && (
          <section className="mb-4">
            <h2 className="text-lg font-semibold border-b border-gray-300 mb-1">{t("certifications")}</h2>
            {cv.certifications.map((cert, index) => (
              <div key={index} className="mb-1">
                <h3 className="font-semibold">{cert.title} – {cert.issuer}</h3>
                <p className="text-xs text-gray-700">{cert.date}</p>
                {cert.description && <p className="text-sm">{cert.description}</p>}
              </div>
            ))}
          </section>
        )}
      </div>
    </>
  );
};
