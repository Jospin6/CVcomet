import { CvProps } from "@/helpers/schema"
import { User } from "@/redux/user/userSlice"
import { Cv } from "./cv";
import { CvOne } from "@/components/templates/cv/templateOne";
import { CvTwo } from "../templates/cv/templateTwo";
import { CvThree } from "@/components/templates/cv/templateThree";
import { CvFour } from "@/components/templates/cv/templateFour";
import { CvFive } from "@/components/templates/cv/templateFive";
import { cv1, cv2, cv3, cv4, cv5 } from "@/helpers/constants";

const templateComponentMap: Record<string, React.ComponentType<any>> = {
    [cv1]: CvOne,
    [cv2]: CvTwo,
    [cv3]: CvThree,
    [cv4]: CvFour,
    [cv5]: CvFive,
};



export const CvItems = ({ cv, user }: { cv: CvProps[], user: User }) => {
    const SelectedCvComponent = user?.currentTemplateId && templateComponentMap[user.currentTemplateId];
    return <>
        {
            cv && cv.map((c, i) => (
                <div className="mb-6" key={i}>
                    {SelectedCvComponent ? (
                        <SelectedCvComponent
                            cv={{
                                ...c,
                                skills: (c.skills ?? []).filter((skill): skill is NonNullable<typeof skill> => skill !== undefined), // Ensure no undefined values
                                educations: (c.educations ?? []).filter((education): education is {
                                    degree: string;
                                    school: string;
                                    location: string;
                                    start: string;
                                    end?: string;
                                    description?: string[];
                                } => education !== undefined && education.degree !== undefined && education.school !== undefined && education.location !== undefined && education.start !== undefined),
                                projects: (c.projects ?? []).filter((project): project is {
                                    title: string;
                                    description: string;
                                    technologies: string;
                                    link?: string;
                                } => project !== undefined && project.title !== undefined && project.description !== undefined && project.technologies !== undefined),
                                experiences: (c.experiences ?? []).filter((experience): experience is {
                                    title: string;
                                    company: string;
                                    location: string;
                                    start: string;
                                    end?: string;
                                    description?: string[];
                                } => experience !== undefined && experience.title !== undefined && experience.company !== undefined && experience.location !== undefined && experience.start !== undefined),
                                certifications: (c.certifications ?? []).filter((certification): certification is {
                                    title: string;
                                    issuer: string;
                                    date: string;
                                    description?: string;
                                } => certification !== undefined && certification.title !== undefined && certification.issuer !== undefined && certification.date !== undefined),
                                languages: (c.languages ?? []).filter((language): language is { language: string; level: "Basic" | "Professional" | "Fluent" | "Native"; } => language !== undefined && language.language !== undefined && language.level !== undefined),
                            }}
                            user={user ?? undefined}
                        />
                    ) : (
                        <Cv
                            cv={{
                                ...c,
                                skills: (c.skills ?? []).filter((skill): skill is NonNullable<typeof skill> => skill !== undefined), // Ensure no undefined values
                                educations: (c.educations ?? []).filter((education): education is {
                                    degree: string;
                                    school: string;
                                    location: string;
                                    start: string;
                                    end?: string;
                                    description?: string[];
                                } => education !== undefined && education.degree !== undefined && education.school !== undefined && education.location !== undefined && education.start !== undefined),
                                projects: (c.projects ?? []).filter((project): project is {
                                    title: string;
                                    description: string;
                                    technologies: string;
                                    link?: string;
                                } => project !== undefined && project.title !== undefined && project.description !== undefined && project.technologies !== undefined),
                                experiences: (c.experiences ?? []).filter((experience): experience is {
                                    title: string;
                                    company: string;
                                    location: string;
                                    start: string;
                                    end?: string;
                                    description?: string[];
                                } => experience !== undefined && experience.title !== undefined && experience.company !== undefined && experience.location !== undefined && experience.start !== undefined),
                                certifications: (c.certifications ?? []).filter((certification): certification is {
                                    title: string;
                                    issuer: string;
                                    date: string;
                                    description?: string;
                                } => certification !== undefined && certification.title !== undefined && certification.issuer !== undefined && certification.date !== undefined),
                                languages: (c.languages ?? []).filter((language): language is { language: string; level: "Basic" | "Professional" | "Fluent" | "Native"; } => language !== undefined && language.language !== undefined && language.level !== undefined),
                            }}
                            user={user ?? undefined}
                        />
                    )}

                </div>
            ))
        }

    </>
}