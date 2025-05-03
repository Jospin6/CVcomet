"use client"

import { Navbar } from "@/components/navbar/navbar";
import Image from "next/image";
import { AnimatePresence, motion } from "framer-motion";// Adjust the path based on your project structure
import { ArrowDown, ArrowUpIcon, Download, RefreshCcw } from "lucide-react";
import { useEffect, useRef, useState } from "react";
import { useDispatch, useSelector } from "react-redux";
import { generateCv, selectCvState } from "@/redux/cv/cvSlice";
import { useCurrentUser } from "@/hooks/useCurrentUser";
import { AppDispatch } from "@/redux/store";
import { experimental_useObject as useObject } from '@ai-sdk/react';
import { coverLetterSchema, cvSchema } from "@/helpers/schema";
import { Cv } from "@/components/ui/cv";
import { CoverLetter } from "@/components/ui/coverLetter";
import { Button } from "@/components/ui/button";
import { fetchUser, selectUser } from "@/redux/user/userSlice";
import { generateCvPrompt } from "@/helpers/helpers";

export default function Home() {
    const inputRef = useRef<HTMLDivElement>(null);
    const [input, setInput] = useState("");
    const dispatch = useDispatch<AppDispatch>();
    const cv = useSelector(selectCvState)
    const user = useCurrentUser();
    const currentUser = useSelector(selectUser)

    const { object: cvObject, submit: cvSubmit, isLoading: isLoadingCv } = useObject({
        api: '/api/generate-cv',
        schema: cvSchema,
    });

    const { object: coverLetterObject, submit: submitCoverLetter, isLoading: isLoadingCoverLetter } = useObject({
        api: '/api/generate-cover-letter',
        schema: coverLetterSchema,
    });

    const handleSend = () => {
        if (!input.trim()) return;
        cvSubmit({ description: input, user: currentUser });
        setInput("");
        if (inputRef.current) {
            inputRef.current.innerText = "";
        }
    };

    const handleCoverLetter = () => {
        if (!input.trim()) return;
        submitCoverLetter({ description: input, user: currentUser });
        setInput("");
        if (inputRef.current) {
            inputRef.current.innerText = "";
        }
    };

    useEffect(() => {
        if (user?.id) {
            dispatch(fetchUser(user.id));
        }
    }, [user?.id, dispatch]);


    console.log("cvObject", cvObject);
    


    return (
        <div className="pb-20">
            <motion.div
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                className="w-full pb-4 pt-2 mt-auto"
            >
                <div className="max-w-3xl mx-auto px-4">
                    <motion.div
                        animate={{ height: "auto" }}
                        whileFocus={{ scale: 1.01 }}
                        transition={{ duration: 0.2 }}
                        className="relative rounded-2xl lg:rounded-e-3xl p-2.5 flex items-end gap-2 bg-background"
                    >
                        <div
                            contentEditable
                            role="textbox"
                            onInput={(e) => {
                                setInput(e.currentTarget.textContent || "");
                            }}
                            onKeyDown={(e) => {
                                if (e.key === "Enter" && !e.shiftKey) {
                                    e.preventDefault();
                                    handleSend();
                                }
                            }}
                            data-placeholder="Enter the Job description..."
                            className="flex-1 text-gray-200 bg-gray-800 min-h-[36px] max-h-[350px] overflow-y-auto px-3 py-2 focus:outline-none 
                  text-sm rounded-md empty:before:text-gray-300 empty:before:content-[attr(data-placeholder)] whitespace-pre-wrap break-words"
                            ref={inputRef}
                        />
                        <div className="flex gap-2">
                            <Button className="cursor-pointer" onClick={handleSend}>Cv</Button>
                            <Button className="cursor-pointer" onClick={handleCoverLetter}>Cover letter</Button>
                        </div>
                    </motion.div>
                </div>
            </motion.div>

            {(isLoadingCv || isLoadingCoverLetter) && <div>Loading...</div>}

            {cvObject?.cvs && (
                <div className="mb-6">
                    <div className="flex items-center justify-between mb-4">
                        <h2 className="text-xl font-bold">Curriculum Vitae</h2>
                        <div className="flex gap-4">
                            <button
                                onClick={() => console.log("Regenerate CV")}
                                className="p-2 rounded hover:bg-gray-100 cursor-pointer"
                                aria-label="Regenerate CV"
                            >
                                <RefreshCcw className="w-5 h-5" />
                            </button>
                            <button
                                onClick={() => console.log("Download CV")}
                                className="p-2 rounded hover:bg-gray-100 cursor-pointer"
                                aria-label="Download CV"
                            >
                                <Download className="w-5 h-5" />
                            </button>
                        </div>
                    </div>
                    <Cv
                        cv={{
                            ...cvObject.cvs,
                            skills: (cvObject.cvs.skills ?? []).filter((skill): skill is NonNullable<typeof skill> => skill !== undefined), // Ensure no undefined values
                            educations: (cvObject.cvs.educations ?? []).filter((education): education is {
                                degree: string;
                                school: string;
                                location: string;
                                start: string;
                                end?: string;
                                description?: string[];
                            } => education !== undefined && education.degree !== undefined && education.school !== undefined && education.location !== undefined && education.start !== undefined),
                            projects: (cvObject.cvs.projects ?? []).filter((project): project is {
                                title: string;
                                description: string;
                                technologies: string;
                                link?: string;
                            } => project !== undefined && project.title !== undefined && project.description !== undefined && project.technologies !== undefined),
                            experiences: (cvObject.cvs.experiences ?? []).filter((experience): experience is {
                                title: string;
                                company: string;
                                location: string;
                                start: string;
                                end?: string;
                                description?: string[];
                            } => experience !== undefined && experience.title !== undefined && experience.company !== undefined && experience.location !== undefined && experience.start !== undefined),
                            certifications: (cvObject.cvs.certifications ?? []).filter((certification): certification is {
                                title: string;
                                issuer: string;
                                date: string;
                                description?: string;
                            } => certification !== undefined && certification.title !== undefined && certification.issuer !== undefined && certification.date !== undefined),
                            languages: (cvObject.cvs.languages ?? []).filter((language): language is { language: string; level: "Basic" | "Professional" | "Fluent" | "Native"; } => language !== undefined && language.language !== undefined && language.level !== undefined),
                        }}
                        user={currentUser ?? undefined}
                    />
                </div>
            )}

            {(coverLetterObject?.coverLetter) && (
                <div>
                    <div className="flex items-center justify-between mb-4">
                        <h2 className="text-xl font-bold">Cover Letter</h2>
                        <div className="flex gap-4">
                            <button
                                onClick={() => console.log("Regenerate Cover Letter")}
                                className="p-2 rounded hover:bg-gray-100 cursor-pointer"
                                aria-label="Regenerate Cover Letter"
                            >
                                <RefreshCcw className="w-5 h-5" />
                            </button>
                            <button
                                onClick={() => console.log("Download Cover Letter")}
                                className="p-2 rounded hover:bg-gray-100 cursor-pointer"
                                aria-label="Download Cover Letter"
                            >
                                <Download className="w-5 h-5" />
                            </button>
                        </div>
                    </div>
                    <CoverLetter coverLetter={{ ...coverLetterObject.coverLetter }} user={currentUser ?? undefined} />
                </div>
            )}
        </div>
    );
}
