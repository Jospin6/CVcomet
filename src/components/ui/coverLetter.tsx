
export const CoverLetter = () => {
    return (
        <div
            className="mx-auto bg-white flex flex-col justify-start shadow-lg"
            style={{
                width: "210mm",
                height: "297mm",
                padding: "20mm",
                boxSizing: "border-box",
                fontFamily: "Arial, sans-serif",
            }}
        >
            <div className="text-sm leading-relaxed">
                <p>John Doe</p>
                <p>123 Main Street</p>
                <p>New York, NY 10001</p>
                <p>johndoe@email.com</p>
                <p>+1 234 567 890</p>

                <p className="mt-8">[Hiring Manager's Name]</p>
                <p>XYZ Company</p>
                <p>456 Business Rd</p>
                <p>New York, NY 10002</p>

                <p className="mt-8">May 3, 2025</p>

                <p className="mt-8">Dear [Hiring Manager's Name],</p>

                <p className="mt-4">
                    I am writing to express my interest in the Software Engineer position at XYZ Company. With over five years of
                    experience developing scalable web applications and a passion for delivering high-quality software, I believe I
                    would be an excellent fit for your team.
                </p>

                <p className="mt-4">
                    In my current role at ABC Inc., I have led the development of several React-based applications, collaborating
                    closely with designers and product managers to deliver user-centric features. I also improved CI/CD pipelines,
                    reducing deployment times by 30%. I am excited about XYZ Company's mission to innovate in the tech industry,
                    and I am eager to contribute my skills to your projects.
                </p>

                <p className="mt-4">
                    I would welcome the opportunity to discuss how my experience aligns with your needs. Thank you for considering
                    my application.
                </p>

                <p className="mt-4">Sincerely,</p>

                <p className="mt-8">John Doe</p>
            </div>
        </div>
    )
}