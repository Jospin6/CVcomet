import { z } from "zod";

export const cvSchema = z.object({
    cvs: z.object({
        title: z.string().describe("Title of the profile, e.g., 'Full Stack Developer'"),
        summary: z.string().optional().describe("Brief professional summary or profile statement"),

        skills: z.array(
            z.object({
                softskills: z.string().optional().describe("Soft skills like 'Teamwork, Communication'"),
                hardskills: z.string().optional().describe("Hard skills like 'JavaScript, React'"),
                tools: z.string().optional().describe("Tools and technologies like 'Git, Docker'")
            })
        ).optional(),

        experiences: z.array(
            z.object({
                title: z.string().describe("Job title, e.g., 'Software Engineer'"),
                company: z.string().describe("Company name, e.g., 'Google'"),
                location: z.string().describe("Location, e.g., 'San Francisco, CA'"),
                start: z.string().describe("Start date, e.g., 'Jan 2021'"),
                end: z.string().optional().describe("End date, e.g., 'Present' or 'Dec 2023'"),
                description: z.array(z.string()).optional().describe("Responsibilities or achievements")
            })
        ).optional(),

        educations: z.array(
            z.object({
                degree: z.string().describe("Degree name, e.g., 'BSc Computer Science'"),
                school: z.string().describe("School name, e.g., 'MIT'"),
                location: z.string().describe("Location, e.g., 'Cambridge, MA'"),
                start: z.string().describe("Start year, e.g., '2015'"),
                end: z.string().optional().describe("End year, e.g., '2019'"),
                description: z.array(z.string()).optional().describe("Major subjects or activities")
            })
        ).optional(),

        projects: z.array(
            z.object({
                title: z.string().describe("Project title"),
                description: z.string().describe("Project description"),
                technologies: z.string().describe("Technologies used, e.g., 'React, Node.js'"),
                link: z.string().optional().describe("Link to the project")
            })
        ).optional(),

        certifications: z.array(
            z.object({
                title: z.string().describe("Certification title, e.g., 'AWS Certified Developer'"),
                issuer: z.string().describe("Issuer name, e.g., 'Amazon'"),
                date: z.string().describe("Date, e.g., 'May 2023'"),
                description: z.string().optional().describe("Brief description")
            })
        ).optional(),

        languages: z.array(
            z.object({
                language: z.string().describe("Language, e.g., 'English'"),
                level: z.enum(["Basic", "Professional", "Fluent", "Native"]).describe("Proficiency level")
            })
        ).optional(),

        hobbies: z.string().optional().describe("Comma-separated hobbies, e.g., 'Coding, Music, Reading'")
    })
});

export type CvProps = {
    title?: string;
    summary?: string;

    skills?: Array<{
        softskills?: string;
        hardskills?: string;
        tools?: string;
    }>;

    experiences?: Array<{
        title: string;
        company: string;
        location: string;
        start: string;
        end?: string;
        description?: string[];
    }>;

    educations?: Array<{
        degree: string;
        school: string;
        location: string;
        start: string;
        end?: string;
        description?: string[];
    }>;

    certifications?: Array<{
        title: string;
        issuer: string;
        date: string;
        description?: string;  // description est optionnel
    }>;

    projects?: Array<{
        title: string;
        description: string;
        technologies: string;
        link?: string;  // link est optionnel
    }>;

    languages?: Array<{
        language: string;
        level: "Basic" | "Professional" | "Fluent" | "Native";
    }>;

    hobbies?: string;
};


export const coverLetterSchema = z.object({
    coverLetter: z.object({
        sendertitle: z.string().describe("Title of the profile, e.g., 'Full Stack Developer'"),
        recipientName: z.string().describe("Name of the person to whom the letter is addressed (e.g., 'Mr. John Smith')"),
        recipientTitle: z.string().optional().describe("Title of the recipient (e.g., 'Hiring Manager')"),
        companyName: z.string().describe("Name of the company (e.g., 'XYZ Corporation')"),
        companyAddress: z.string().optional().describe("Address of the company"),
        date: z.string().describe("Date of the cover letter (e.g., 'May 3, 2025')"),
        positionTitle: z.string().describe("Title of the job being applied for (e.g., 'Data Analyst')"),

        introduction: z.string().describe("Introduction paragraph of the cover letter"),
        body: z.string().describe("Main body paragraph(s) of the cover letter"),
        conclusion: z.string().describe("Closing paragraph of the cover letter"),

        senderName: z.string().describe("Name of the sender (e.g., 'John Doe')"),
        senderAddress: z.string().optional().describe("Address of the sender"),
        senderEmail: z.string().optional().describe("Email address of the sender"),
        senderPhone: z.string().optional().describe("Phone number of the sender"),
    })
});

export type CoverLetterProps = {
    recipientName?: string;
    recipientTitle?: string;
    companyName?: string;
    companyAddress?: string;
    date?: string;
    introduction?: string;
    body?: string;
    conclusion?: string;
    senderName?: string;
    senderAddress?: string;
    senderEmail?: string;
    senderPhone?: string;
    sendertitle?: string;
};

export const authSchema = z.object({
    email: z.string().trim().toLowerCase().email({ message: "Email invalide" }),
    password: z
        .string()
        .min(6, { message: "Le mot de passe doit contenir au moins 6 caractères" }),
});
