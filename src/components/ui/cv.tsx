
export const Cv = () => {
    return (
        <div className="max-w-[794px] mx-auto p-8 bg-white shadow-lg" style={{ width: "210mm", minHeight: "297mm" }}>
            <header className="text-center mb-6">
                <h1 className="text-3xl font-bold uppercase">John Doe</h1>
                <p className="text-sm">Software Engineer | johndoe@email.com | +1 234 567 890</p>
                <p className="text-sm">LinkedIn: linkedin.com/in/johndoe | GitHub: github.com/johndoe</p>
            </header>

            <section className="mb-4">
                <h2 className="text-xl font-semibold border-b pb-1 mb-2">Professional Summary</h2>
                <p className="text-sm leading-relaxed">
                    Passionate software engineer with 5+ years of experience developing scalable web applications and working
                    across the full stack...
                </p>
            </section>

            <section className="mb-4">
                <h2 className="text-xl font-semibold border-b pb-1 mb-2">Experience</h2>
                <div>
                    <h3 className="font-semibold text-sm">Senior Developer – XYZ Company</h3>
                    <p className="text-xs text-gray-600">Jan 2020 – Present | New York, NY</p>
                    <ul className="list-disc list-inside text-sm">
                        <li>Developed and maintained React applications serving 1M+ users</li>
                        <li>Improved CI/CD pipelines, reducing deployment time by 30%</li>
                    </ul>
                </div>
                <div className="mt-2">
                    <h3 className="font-semibold text-sm">Software Engineer – ABC Inc.</h3>
                    <p className="text-xs text-gray-600">Jun 2017 – Dec 2019 | Boston, MA</p>
                    <ul className="list-disc list-inside text-sm">
                        <li>Built RESTful APIs in Node.js and integrated with frontend apps</li>
                        <li>Collaborated with designers and PMs to deliver features on time</li>
                    </ul>
                </div>
            </section>

            <section className="mb-4">
                <h2 className="text-xl font-semibold border-b pb-1 mb-2">Education</h2>
                <div>
                    <h3 className="font-semibold text-sm">B.Sc. in Computer Science – University of Somewhere</h3>
                    <p className="text-xs text-gray-600">2013 – 2017</p>
                </div>
            </section>

            <section>
                <h2 className="text-xl font-semibold border-b pb-1 mb-2">Skills</h2>
                <p className="text-sm">JavaScript, TypeScript, React, Node.js, SQL, Git, REST APIs</p>
            </section>
        </div>
    )
}