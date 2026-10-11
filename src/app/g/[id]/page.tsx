"use client"

import { PageHeader } from "@/components/ui/page-header";
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
import { ArrowUpRight } from 'lucide-react';
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
import Link from "next/link";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";

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
    const dispatch = useDispatch<AppDispatch>();
    const convId = useSelector(selectConversationId)
    const { user: user } = useCurrentUser();
    const currentUser = useSelector(selectUser)
    const typeGeneration = useSelector(selectTypeGeneration)
    const [hasGenerated, setHasGenerated] = useState(false);
    const language = i18n.language.startsWith('fr') ? 'fr' : 'en'


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


    const alreadyGeneratedRef = useRef(false);

    useEffect(() => {
        if (!conversation || !convId || !currentUser || conversation.id !== convId) return;

        if (!alreadyGeneratedRef.current && !hasGenerated) {
            if (typeGeneration === "cv") {
                cvSubmit({ description: conversation.content, conversationId: convId, language });
            } else if (typeGeneration === "coverLetter") {
                submitCoverLetter({ description: conversation.content, conversationId: convId, language });
            }

            alreadyGeneratedRef.current = true; // Ne pas regénérer
            setHasGenerated(true);
            dispatch(clearConversationId());
        }
    }, [conversation, convId, hasGenerated, typeGeneration, currentUser, dispatch, cvSubmit, submitCoverLetter, language]);

    useEffect(() => {
        if (typeof id === "string") {
            dispatch(getConversation({ id }));
        }
    }, [dispatch, id]);

    // useEffect(() => {
    //     if (cvObject && !cvError && !hasFetchedConversation.current) {
    //         hasFetchedConversation.current = true;

    //         if (typeof id === "string") {
    //             dispatch(getConversation({ id }));
    //         }
    //     }
    // }, [cvObject, cvError, id, dispatch]);

    useEffect(() => {
        if (user?.id) {
            dispatch(fetchUser(user.id));
        }
    }, [user?.id, dispatch]);

    return (
        <div className="min-w-0 space-y-6 pb-10"><PageHeader title={t("shell.documents")} description={conversation?.title || t("documents.description")} />
            <div className="flex flex-wrap gap-3">
                <Button variant="outline" asChild><Link href="/dashboard/resumes">{t("documents.manage")}<ArrowUpRight /></Link></Button>
                <Button variant="outline" asChild><Link href="/dashboard/cover-letters">{t("shell.coverLetters")}<ArrowUpRight /></Link></Button>
            </div>

            {(cvError || coverError) && (
                <div className="text-destructive bg-destructive/10 mb-4 rounded-lg text-sm p-2 mt-2">
                    <p>{t("limite")}</p>
                    <Link href={"/upgrade"} className="text-sm text-primary underline">
                        {t("ctUpgrade")}
                    </Link>
                </div>
            )}

            {(isLoadingCv) && <CvSkeleton />}
            {isLoadingCoverLetter && (<CoverLetterSkeleton />)}


            <Tabs defaultValue="all" className="w-full mt-4">
                <div className="mx-auto w-full max-w-md">
                    <TabsList className="grid w-full grid-cols-3 bg-card text-foreground">
                        <TabsTrigger className="text-foreground" value="all">{t("all")}</TabsTrigger>
                        <TabsTrigger className="text-foreground" value="cv">{t("resume")}</TabsTrigger>
                        <TabsTrigger className="text-foreground" value="cover">{t("letter")}</TabsTrigger>
                    </TabsList>
                </div>
                <TabsContent className="min-w-0" value="all">
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
                <TabsContent className="min-w-0" value="cv">
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
                <TabsContent className="min-w-0" value="cover">
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
