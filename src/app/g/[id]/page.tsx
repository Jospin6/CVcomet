"use client"

import { motion } from "framer-motion";
import { useEffect, useRef, useState } from "react";
import { useDispatch, useSelector } from "react-redux";
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
import { LoadingIcon } from "@/components/ui/loadingIcon";
import Link from "next/link";
import { getTodayGenerationCount } from "@/lib/utils";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { useCurrentUser } from "@/hooks/useCurrentUser";

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
    const { t, i18n } = useTranslation('common')
    const params = useParams()
    const id = params.id
    const conversation = useSelector(selectConversation)
    const loadConversation = useSelector((state: RootState) => state.conversation.loading)
    const inputRef = useRef<HTMLDivElement>(null);
    const [input, setInput] = useState(conversation?.content ?? "");
    const dispatch = useDispatch<AppDispatch>();
    const convId = useSelector(selectConversationId)
    const { user, loading } = useCurrentUser()
    const currentUser = useSelector(selectUser)
    const typeGeneration = useSelector(selectTypeGeneration)
    const [hasGenerated, setHasGenerated] = useState(false);
    let language = i18n.language === 'fr' ? 'French' : 'English'
    const [isCvLoad, setCvLoad] = useState<boolean>(false)
    const [isCoverLoad, setCoverLoad] = useState<boolean>(false)
    const hasFetchedConversation = useRef(false);

    const { object: cvObject, error: cvError, submit: cvSubmit, isLoading: isLoadingCv } = useObject({
        api: '/api/generate-cv',
        schema: cvSchema,
    });

    const { object: coverLetterObject, error: coverError, submit: submitCoverLetter, isLoading: isLoadingCoverLetter } = useObject({
        api: '/api/generate-cover-letter',
        schema: coverLetterSchema,
    });

    const SelectedCvComponent = currentUser?.currentTemplateId && templateComponentMap[currentUser.currentTemplateId];
    const SelectedCoverLetterComponent = currentUser?.currentCoverLetterId && templateComponentMap[currentUser.currentCoverLetterId];

    useEffect(() => {
        if (input === "" && conversation?.content) {
            setInput(conversation.content);
        }
    }, [input, conversation?.content]);

    const alreadyGeneratedRef = useRef(false);

    useEffect(() => {
        if (!conversation || !convId) return;

        if (!alreadyGeneratedRef.current && !hasGenerated) {
            if (typeGeneration === "cv") {
                cvSubmit({ description: conversation.content, user: currentUser, conversationId: convId, language });
            } else if (typeGeneration === "coverLetter") {
                submitCoverLetter({ description: conversation.content, user: currentUser, conversationId: convId, language });
            }

            alreadyGeneratedRef.current = true; // Ne pas regénérer
            setHasGenerated(true);
            dispatch(clearConversationId());
        }
    }, [conversation, convId, hasGenerated, typeGeneration, currentUser, dispatch]);

    useEffect(() => {
        if (typeof id === "string") {
            dispatch(getConversation({ id }));
        }
    }, [dispatch, id]);

    const handleSend = async () => {
        if (!input.trim()) return;
        setCvLoad(true);
        try {
            await cvSubmit({ description: input, user: currentUser, conversationId: id, language });
            setInput("");
            setCvLoad(false);
            if (inputRef.current) {
                inputRef.current.innerText = "";
            }
        } catch (error) {
            console.log("Error submitting CV:", error);
            setCvLoad(false);
        }
    };

    const handleCoverLetter = async () => {
        if (!input.trim()) return;
        setCoverLoad(true)
        try {
            await submitCoverLetter({ description: input, user: currentUser, conversationId: id, language });
            setCoverLoad(false)
            setInput("");
            if (inputRef.current) {
                inputRef.current.innerText = "";
            }
        } catch (error) {
            console.log("Error submitting Cover letter:", error);
            setCoverLoad(false)
        }
    };

    useEffect(() => {
        if (user?.id) {
            dispatch(fetchUser(user.id));
        }
    }, [user?.id, dispatch]);

    const [isExpanded, setIsExpanded] = useState(false);

    const toggleText = () => setIsExpanded(!isExpanded);

    const longText = conversation?.content;

    return (
        <div className="pb-20">
            <motion.div
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                className="w-full pb-4 pt-2 mt-auto"
            >
                <div className="md:max-w-3xl md:mx-auto md:px-4">
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
                        <div className="flex gap-2 justify-between items-center">
                            <div>
                                {currentUser?.isSubscribed ? (
                                    <span className="text-xs text-gray-400">
                                        {t("active")}
                                    </span>
                                ) : (
                                    <span className="text-xs text-gray-400">
                                        {(currentUser?.lastGeneratedAt && currentUser?.generationCount) &&
                                            (
                                                <span>
                                                    {t("remainingGenerations")}: {getTodayGenerationCount(currentUser?.lastGeneratedAt, currentUser?.generationCount)}
                                                </span>
                                            )
                                        }
                                    </span>
                                )}
                            </div>
                            <div className="flex gap-2">
                                {!isCvLoad ? (
                                    <Button className="cursor-pointer bg-transparent border-[1px] py-1 border-gray-500 text-xs md:text-sm" onClick={handleSend}>
                                        <Sparkles className="md:w-4 md:h-4 w-2 h-2" />
                                        <span>Cv</span>
                                    </Button>
                                ) : (
                                    <Button className="cursor-pointer bg-transparent border-[1px] border-gray-500 text-xs md:text-sm">
                                        <LoadingIcon />
                                    </Button>
                                )}
                                {!isCoverLoad ? (
                                    <Button className="cursor-pointer bg-transparent py-1 border-[1px] border-gray-500 text-xs md:text-sm" onClick={handleCoverLetter}>
                                        <Wand2 className="md:w-4 md:h-4 w-2 h-2" />
                                        <span>{t('coverLetter')}</span>
                                    </Button>
                                ) : (
                                    <Button className="cursor-pointer bg-transparent border-[1px] border-gray-500 text-xs md:text-sm">
                                        <LoadingIcon />
                                    </Button>
                                )}
                            </div>
                        </div>
                    </motion.div>
                </div>
            </motion.div>

            <div className=" max-w-3xl mx-auto px-4 text-gray-300">
                <p
                    className={`transition-all text-sm duration-500 ease-in-out leading-relaxed tracking-wide ${isExpanded ? '' : 'line-clamp-3'}`}
                >
                    {longText}
                </p>

                <div className="flex justify-end">
                    <button
                        onClick={toggleText}
                        className="mt-2 text-sm text-blue-600 hover:underline focus:outline-none"
                    >
                        {isExpanded ? `${t("lessInfos")}` : `${t("moreInfos")}`}
                    </button>
                </div>
            </div>

            {(cvError || coverError) && (
                <div className="text-red-500 bg-black/50 mb-4 rounded-lg text-sm p-2 mt-2">
                    <p>{t("limite")}</p>
                    <Link href={"/upgrade"} className="text-sm text-blue-700 underline">
                        {t("ctUpgrade")}
                    </Link>
                </div>
            )}

            {(isLoadingCv) && <CvSkeleton />}
            {isLoadingCoverLetter && (<CoverLetterSkeleton />)}


            <Tabs defaultValue="all" className="w-full mt-4">
                <div className="md:w-[400px] w-3/4 m-auto">
                    <TabsList className="grid w-full grid-cols-3 bg-[#1a1a1a] text-gray-300">
                        <TabsTrigger className="text-white" value="all">{t("all")}</TabsTrigger>
                        <TabsTrigger className="text-white" value="cv">{t("resume")}</TabsTrigger>
                        <TabsTrigger className="text-white" value="cover">{t("letter")}</TabsTrigger>
                    </TabsList>
                </div>
                <TabsContent value="all">
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

                </TabsContent>
                <TabsContent value="cv">
                    <div>
                        <div>
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
                        </div>
                        {
                            conversation?.Cv && (<CvItems cv={conversation.Cv} user={currentUser!} />)
                        }
                    </div>
                </TabsContent>
                <TabsContent value="cover">
                    <div>
                        {coverLetterObject?.coverLetter && (
                            <div>
                                {SelectedCoverLetterComponent ? (
                                    <SelectedCoverLetterComponent coverLetter={{ ...coverLetterObject.coverLetter }} user={currentUser!} />
                                ) : (
                                    <CoverLetter coverLetter={{ ...coverLetterObject.coverLetter }} user={currentUser ?? undefined} />
                                )}

                            </div>
                        )}
                        {
                            conversation?.CoverLetter && (<CoverLetterItems coverLetters={conversation.CoverLetter} user={currentUser!} />)
                        }
                    </div>
                </TabsContent>
            </Tabs>
        </div>
    );
}
