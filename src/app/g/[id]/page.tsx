"use client"

import { motion } from "framer-motion";
import { useEffect, useRef, useState } from "react";
import { useDispatch, useSelector } from "react-redux";
import { useCurrentUser } from "@/hooks/useCurrentUser";
import { AppDispatch, RootState } from "@/redux/store";
import { experimental_useObject as useObject } from '@ai-sdk/react';
import { coverLetterSchema, cvSchema } from "@/helpers/schema";
import { Cv } from "@/components/ui/cv";
import { CoverLetter } from "@/components/ui/coverLetter";
import { Button } from "@/components/ui/button";
import { fetchUser, selectUser } from "@/redux/user/userSlice";
import { useParams } from "next/navigation"
import { CvSkeleton } from "@/components/ui/cvSkeleton";
import { getConversation, selectConversation, selectTypeGeneration, clearConversationId, selectConversationId } from "@/redux/conversation/conversationSlice";
import { CvItems } from "@/components/ui/cvItems";
import { CoverLetterItems } from "@/components/ui/coverLetterItems";
import { useTranslation } from 'react-i18next';
import { Sparkles, Wand2 } from 'lucide-react';
import { CvOne } from "@/components/templates/cv/templateOne";
import { CvTwo } from "@/components/templates/cv/templateTwo";
import { CvThree } from "@/components/templates/cv/templateThree";
import { CvFour } from "@/components/templates/cv/templateFour";
import { CvFive } from "@/components/templates/cv/templateFive";
import { CoverLetterOne } from "@/components/templates/coverLetter/coverLetterOne";
import { CoverLetterTwo } from "@/components/templates/coverLetter/coverLetterTwo";
import { CoverLetterThree } from "@/components/templates/coverLetter/coverLetterThree";
import { CoverLetterFour } from "@/components/templates/coverLetter/coverLetterFour";
import { CoverLetterFive } from "@/components/templates/coverLetter/coverLetterFive";
import { cover1, cover2, cover3, cover4, cover5, cv1, cv2, cv3, cv4, cv5 } from "@/helpers/constants";
import { CoverLetterSkeleton } from "@/components/ui/coverLetterSkeleton";

const templateComponentMap: Record<string, React.ComponentType<any>> = {
    [cv1]: CvOne,
    [cv2]: CvTwo,
    [cv3]: CvThree,
    [cv4]: CvFour,
    [cv5]: CvFive,

    [cover1]: CoverLetterOne,
    [cover2]: CoverLetterTwo,
    [cover3]: CoverLetterThree,
    [cover4]: CoverLetterFour,
    [cover5]: CoverLetterFive,
};

export default function Home() {
    const { i18n } = useTranslation('common')
    const params = useParams()
    const id = params.id
    const conversation = useSelector(selectConversation)
    const loadConversation = useSelector((state: RootState) => state.conversation.loading)
    const inputRef = useRef<HTMLDivElement>(null);
    const [input, setInput] = useState(conversation?.content ?? "");
    const dispatch = useDispatch<AppDispatch>();
    const convId = useSelector(selectConversationId)
    const user = useCurrentUser();
    const currentUser = useSelector(selectUser)
    const typeGeneration = useSelector(selectTypeGeneration)
    const [hasGenerated, setHasGenerated] = useState(false);
    let language = i18n.language === 'fr' ? 'French' : 'English'

    const { object: cvObject, submit: cvSubmit, isLoading: isLoadingCv } = useObject({
        api: '/api/generate-cv',
        schema: cvSchema,
    });

    const { object: coverLetterObject, submit: submitCoverLetter, isLoading: isLoadingCoverLetter } = useObject({
        api: '/api/generate-cover-letter',
        schema: coverLetterSchema,
    });

    const userInfos = Object.fromEntries(
        Object.entries(currentUser ?? {}).filter(
            ([key]) => key !== 'currentTemplateId' && key !== 'currentCoverLetterId'
        )
    );

    const SelectedCvComponent = currentUser?.currentTemplateId && templateComponentMap[currentUser.currentTemplateId];
    const SelectedCoverLetterComponent = currentUser?.currentCoverLetterId && templateComponentMap[currentUser.currentCoverLetterId];

    useEffect(() => {
        if (!hasGenerated && conversation && convId) {
            if (typeGeneration === "cv") {
                cvSubmit({ description: conversation.content, user: currentUser, conversationId: convId, language });
            } else if (typeGeneration === "coverLetter") {
                submitCoverLetter({ description: conversation.content, user: currentUser, conversationId: convId, language });
            }
            setHasGenerated(true);
            dispatch(clearConversationId());
        }
    }, [conversation, convId, hasGenerated, typeGeneration, currentUser, dispatch]);

    useEffect(() => {
        if (typeof id === "string") {
            dispatch(getConversation({ id }));
        }
    }, [dispatch, id]);

    const handleSend = () => {
        if (!input.trim()) return;
        cvSubmit({ description: input, user: currentUser, conversationId: id, language });
        setInput("");
        if (inputRef.current) {
            inputRef.current.innerText = "";
        }
    };

    const handleCoverLetter = () => {
        if (!input.trim()) return;
        submitCoverLetter({ description: input, user: currentUser, conversationId: id, language });
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
                        className="relative rounded-2xl border-[1px] border-gray-500 p-2.5 bg-[#2F2F2F]"
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
                            className="flex-1 text-gray-200 min-h-[36px] max-h-[300px] overflow-y-auto pt-2 pb-4 focus:outline-none 
                  text-sm rounded-md empty:before:text-gray-300 empty:before:content-[attr(data-placeholder)] whitespace-pre-wrap break-words"
                            ref={inputRef}
                        />
                        <div className="flex gap-2 justify-end">
                            <Button className="cursor-pointer bg-transparent border-[1px] border-gray-500 text-sm" onClick={handleSend}>
                                <Sparkles className="w-4 h-4" />
                                <span>Cv</span>
                            </Button>
                            <Button className="cursor-pointer bg-transparent border-[1px] border-gray-500 text-sm" onClick={handleCoverLetter}>
                                <Wand2 className="w-4 h-4" />
                                <span>Cover letter</span>
                            </Button>
                        </div>
                    </motion.div>
                </div>
            </motion.div>

            {(isLoadingCv || loadConversation) && <CvSkeleton />}
            {isLoadingCoverLetter && (<CoverLetterSkeleton/>)}

            {cvObject?.cvs && (
                <div className="mb-6">
                    {SelectedCvComponent ? (
                        <SelectedCvComponent
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
                    ) : (
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
                    )}

                </div>
            )}

            {coverLetterObject?.coverLetter && (
                <div>
                    {SelectedCoverLetterComponent ? (
                        <SelectedCoverLetterComponent coverLetter={{ ...coverLetterObject.coverLetter }} user={currentUser!} />
                    ) : (
                        <CoverLetter coverLetter={{ ...coverLetterObject.coverLetter }} user={currentUser ?? undefined} />
                    )}

                </div>
            )}

            <div>
                {
                    conversation?.Cv && (<CvItems cv={conversation.Cv} user={currentUser!} />)
                }
            </div>
            <div>
                {
                    conversation?.CoverLetter && (<CoverLetterItems coverLetters={conversation.CoverLetter} user={currentUser!} />)
                }
            </div>
        </div>
    );
}
