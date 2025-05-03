import { CvProps } from "@/helpers/schema"
import { User } from "@/redux/user/userSlice"

export const Cv = ({ cv, user }: { cv: CvProps, user?: User }) => {
    return (
        <div className="max-w-[794px] mx-auto p-8 bg-white shadow-lg" style={{ width: "210mm", minHeight: "297mm" }}>
            <header className="text-center mb-6">
                <h1 className="text-3xl font-bold uppercase">{user?.name ?? "No name"}</h1>
                <p className="text-sm">
                    {cv.title}
                </p>
                <p className="text-sm">
                    {user?.linkedin && `LinkedIn: linkedin.com/in/${user?.github}`}
                    {user?.email && `| Email: ${user?.email}`}
                    {user?.github && `| GitHub: github.com/${user?.github}`}
                </p>
            </header>

            <section className="mb-4">
                <h2 className="text-xl font-semibold border-b pb-1 mb-2">Professional Summary</h2>
                <p className="text-sm leading-relaxed">
                    {cv.summary}
                </p>
            </section>

            <section className="mb-4">
                <h2 className="text-xl font-semibold border-b pb-1 mb-2">Experience</h2>
                {cv.experiences && cv.experiences.map((exp, index) => (
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

            <section className="mb-4">
                <h2 className="text-xl font-semibold border-b pb-1 mb-2">Education</h2>
                {cv.educations && cv.educations.map((edu, index) => (
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

            <section>
                <h2 className="text-xl font-semibold border-b pb-1 mb-2">Skills</h2>
                <p className="text-sm">
                    {cv.skills && cv.skills.map((skill, index) => (
                        <div key={index} className="inline-block rounded-full px-3 py-1 text-sm text-gray-700 mr-2 mb-2">
                            <p> <span className="font-semibold">Technical: </span> {skill.hardskills}</p>
                            <p><span className="font-semibold">Soft: </span>  {skill.softskills}</p>
                            <p><span className="font-semibold">Tools: </span> {skill.tools}</p>
                        </div>
                    ))}
                </p>
            </section>

            <section className="mb-4">
                <h2 className="text-xl font-semibold border-b pb-1 mb-2">Languages</h2>
                {cv.languages && cv.languages.map((lang, index) => (
                    <div key={index} className={index > 0 ? "mt-2" : ""}>
                        <h3 className="font-semibold text-sm">{lang.language}</h3>
                        <p className="text-xs text-gray-600">Proficiency: {lang.level}</p>
                    </div>
                ))}
            </section>

            <section className="mb-4">
                <h2 className="text-xl font-semibold border-b pb-1 mb-2">Projects</h2>
                {cv.projects && cv.projects.map((project, index) => (
                    <div key={index} className={index > 0 ? "mt-2" : ""}>
                        <h3 className="font-semibold text-sm">{project.title}</h3>
                        <p className="text-xs text-gray-600">{project.description}</p>
                        <p className="text-xs text-gray-600">Technologies: {project.technologies}</p>
                        {project.link && (
                            <p className="text-xs text-blue-500">
                                <a href={project.link} target="_blank" rel="noopener noreferrer">View Project</a>
                            </p>
                        )}
                    </div>
                ))}
            </section>

            {(cv.certifications &&cv.certifications?.length > 0) && (
                <section className="mb-4">
                    <h2 className="text-xl font-semibold border-b pb-1 mb-2">Certifications</h2>
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
    )
}