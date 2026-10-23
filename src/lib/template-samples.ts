import { resumeContentSchema, type EditorResume, type ResumeSection } from "@/lib/resume-editor";
import type { TemplateDefinition } from "@/lib/template-catalog";

// Display-only examples: these are never passed to document creation or the AI.
export function sampleResume(template: TemplateDefinition): EditorResume {
  const student = template.functionalType === "STUDENT";
  const academic = template.functionalType === "ACADEMIC";
  const executive = template.functionalType === "EXECUTIVE";
  const title = student ? "Graduate Product Designer" : academic ? "Researcher in Human–Computer Interaction" : executive ? "Director of Product Design" : "Senior Product Designer";
  const summary = student
    ? "Design graduate with hands-on experience in user research, accessible interfaces and prototyping. Developed a community services app with a student team and tested it with local residents. Looking to contribute thoughtful design and a collaborative approach to a product team."
    : academic
      ? "Human–computer interaction researcher studying how accessible digital services support independent living. Experienced in mixed-methods research, peer-reviewed publication and undergraduate teaching. Interested in translating research findings into practical public-service design."
      : executive
        ? "Design leader with ten years of experience building teams and improving digital services. Connects customer research with product strategy, develops design talent and establishes measurable delivery standards. Led a multidisciplinary team across three product lines."
        : "Product designer with six years of experience turning complex workflows into clear, accessible digital experiences. Combines user research, interaction design and close collaboration with engineers to deliver useful products. Focused on practical improvements that make everyday tasks easier.";
  const sectionOrder: ResumeSection[] = academic || student
    ? ["summary", "educations", "projects", "experiences", "skills", "certifications", "languages"]
    : template.functionalType === "SKILLS_BASED" || template.functionalType === "HYBRID"
      ? ["summary", "skills", "projects", "experiences", "educations", "certifications", "languages"]
      : template.functionalType === "PORTFOLIO"
        ? ["summary", "projects", "experiences", "skills", "educations", "certifications", "languages"]
        : ["summary", "experiences", "educations", "skills", "projects", "certifications", "languages"];
  return resumeContentSchema.parse({
    title, summary: [summary],
    contact: { name: "John Doe", email: "john.doe@example.com", phone: "+44 7700 900123", city: "London, United Kingdom", website: "johndoe.example.com", linkedin: "" },
    design: { documentName: "John Doe — sample CV", layout: template.layout, font: template.font, accent: template.accent, padding: template.layout === "modern" ? 40 : 44, sectionOrder },
    experiences: [
      {
        title: student ? "Product Design Intern" : academic ? "Research Associate" : executive ? "Director of Product Design" : "Senior Product Designer",
        company: academic ? "Westbridge Research Institute" : "Northstar Studio", location: "London, UK", start: student ? "Jun 2025" : "Jan 2022", end: student ? "Sep 2025" : "Present",
        description: academic ? ["Designed and ran a mixed-methods study with 48 participants on accessible public services.", "Co-authored two journal articles and mentored four undergraduate research projects."]
          : student ? ["Created and tested a mobile onboarding prototype with eight participants.", "Documented reusable interface components with the senior design team."]
            : executive ? ["Grew a design team from 6 to 14 people and introduced a structured mentoring programme.", "Aligned three product teams around shared research priorities and a common design system."]
              : ["Redesigned the onboarding journey, reducing completion time by 28% in usability tests.", "Partnered with eight engineers to deliver an accessible design system across three products."],
      },
      {
        title: student ? "Student Design Volunteer" : academic ? "Teaching Assistant" : executive ? "Design Lead" : "Product Designer",
        company: academic ? "Westbridge University" : "Brightline Digital", location: "Bristol, UK", start: student ? "Oct 2024" : "Sep 2019", end: student ? "May 2025" : "Dec 2021",
        description: academic ? ["Led weekly interaction design tutorials for a class of 35 students."]
          : student ? ["Worked with a local charity to simplify its event registration pages."]
            : ["Conducted customer interviews and translated findings into tested prototypes.", "Improved the checkout flow through iterative research and collaboration with developers."],
      },
    ],
    educations: [{ degree: academic ? "PhD, Human–Computer Interaction" : "BA (Hons), Digital Design", school: "Westbridge University", location: "Bristol, UK", start: academic ? "2019" : student ? "2022" : "2015", end: academic ? "2023" : student ? "2025" : "2018", description: [academic ? "Thesis: Designing inclusive digital services for independent living." : "Focused on interaction design, research methods and visual communication."] }],
    skills: [{ hardskills: academic ? "Mixed-methods research, study design, statistical analysis, academic writing" : executive ? "Design strategy, team leadership, service design, research planning" : "User research, interaction design, accessibility, prototyping", softskills: "Workshop facilitation, stakeholder communication, cross-functional collaboration", tools: academic ? "R, Python, Figma, NVivo" : "Figma, FigJam, Adobe Illustrator, HTML & CSS" }],
    projects: [{ title: academic ? "Inclusive Services Study · 2024" : "Community Connect · 2025", description: academic ? "Doe, J. and Lee, A. Accessible journeys in local government services. Journal of Inclusive Interaction, 12(2), 41–58. Presented findings at the Westbridge Research Symposium." : "Designed a service directory that helps residents find local support. Interviewed 12 residents and tested an accessible search experience with community volunteers.", technologies: "", link: academic ? "research.example.com/john-doe" : "johndoe.example.com/community" }],
    certifications: [{ title: academic ? "Research Ethics & Integrity" : "Accessibility for Digital Products", issuer: "Westbridge Professional Learning", date: "2024", description: "" }],
    languages: [{ language: "English", level: "Native" }, { language: "French", level: "Professional working proficiency" }],
  });
}

export const sampleLetter = {
  name: "John Doe", title: "Senior Product Designer", email: "john.doe@example.com", phone: "+44 7700 900123", city: "London, United Kingdom",
  date: "22 October 2026", recipient: "Ms Sarah Taylor", recipientTitle: "Head of Design", company: "Northstar Studio", address: "London, United Kingdom",
  subject: "Application for Senior Product Designer", salutation: "Dear Ms Taylor,",
  paragraphs: [
    "I am writing to apply for the Senior Product Designer position at Northstar Studio. Your focus on making everyday services more accessible closely matches the work I have pursued throughout my design career. I would welcome the opportunity to bring my research and interaction design experience to your team.",
    "In my current role at Brightline Digital, I led the redesign of a customer onboarding journey. By interviewing users, mapping points of friction and testing prototypes with the engineering team, we reduced completion time by 28% in usability tests. This work taught me to connect design decisions to clear evidence and to involve colleagues early in the process.",
    "I also helped establish a shared design system used across three products. Working with designers and engineers, I documented accessible components and organised review sessions to support their adoption. I would bring the same practical, collaborative approach to Northstar’s growing product portfolio.",
    "I would be pleased to discuss how my experience could support your team’s priorities. My portfolio includes the onboarding project and examples of my research process. Thank you for considering my application; I look forward to the opportunity to speak with you.",
  ],
  closing: "Yours sincerely,", enclosure: "Enclosure: Curriculum vitae",
};
