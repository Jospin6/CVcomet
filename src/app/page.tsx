"use client"

import { motion } from "framer-motion";
import { use, useEffect, useRef, useState } from "react";
import { useDispatch, useSelector } from "react-redux";
import { useCurrentUser } from "@/hooks/useCurrentUser";
import { AppDispatch } from "@/redux/store";
import { Button } from "@/components/ui/button";
import { fetchUser, selectUser } from "@/redux/user/userSlice";
import { addConversation, selectConversationId, setTypeGeneration } from "@/redux/conversation/conversationSlice";
import { redirect } from "next/navigation";
import { useTranslation } from 'react-i18next';
import { Sparkles, Wand2 } from "lucide-react";
import Link from "next/link";
import { LoadingIcon } from "@/components/ui/loadingIcon";
import { getTodayGenerationCount } from "@/lib/utils";

export default function Home() {
    const { t } = useTranslation();
    const inputRef = useRef<HTMLDivElement>(null);
    const [input, setInput] = useState<string>("");
    const dispatch = useDispatch<AppDispatch>();
    const currentUser = useSelector(selectUser)
    const currentConversationId = useSelector(selectConversationId)
    const [isCvLoad, setCvLoad] = useState<boolean>(false)
    const [isCoverLoad, setCoverLoad] = useState<boolean>(false)
    const [isInputEmpty, setIsInputEmpty] = useState<boolean>(false);
    const [shouldRedirect, setShouldRedirect] = useState<boolean>(false);
    const [conversationStarted, setConversationStarted] = useState(false);

    const { user, loading } = useCurrentUser()

    const handleSend = () => {
        if (input.trim() === "") {
            setIsInputEmpty(true);
            if (inputRef.current) inputRef.current.focus();
            return;
        }

        dispatch(addConversation({ content: input, userId: user?.id }));
        dispatch(setTypeGeneration("cv"));
        setCvLoad(true);
        setConversationStarted(true); // ✅
        setInput("");
    };

    const isUserReadyToGenDoc = () => {
        if (currentUser?.Experience && currentUser?.Education && currentUser?.skills) {
            return true;

        } else {
            return false;
        }
    }

    const handleCoverLetter = () => {
        if (input.trim() === "") {
            setIsInputEmpty(true);
            if (inputRef.current) inputRef.current.focus();
            return;
        }

        dispatch(addConversation({ content: input, userId: user?.id }));
        dispatch(setTypeGeneration("coverLetter"));
        setCoverLoad(true);
        setConversationStarted(true); // ✅
        setInput("");
    };

    useEffect(() => {
        // ✅ redirige uniquement si la conversation est volontairement lancée
        if (conversationStarted && currentConversationId) {
            redirect(`/g/${currentConversationId}`);
        }
    }, [currentConversationId, conversationStarted]);

    useEffect(() => {
        if (user?.id) {
            dispatch(fetchUser(user.id));
        }
    }, [user?.id, dispatch]);


    return (
        <>
            <div className="flex flex-col items-center justify-center min-h-[90vh] gap-2">

                <div className="text-center max-w-2xl mx-auto md:px-4">
                    <motion.h1
                        initial={{ opacity: 0, y: 20 }}
                        animate={{ opacity: 1, y: 0 }}
                        transition={{ duration: 0.8, ease: "easeOut" }}
                        className="text-xl font-extrabold text-white leading-tight mb-4"
                    >
                        {t("bigTitle")}
                    </motion.h1>
                    <motion.h2
                        initial={{ opacity: 0, y: 10 }}
                        animate={{ opacity: 1, y: 0 }}
                        transition={{ duration: 1, delay: 0.3, ease: "easeOut" }}
                        className="text-gray-400 text-sm leading-relaxed"
                    >
                        {t("bigDescription")}
                    </motion.h2>
                </div>

                <motion.div
                    initial={{ opacity: 0, y: 10 }}
                    animate={{ opacity: 1, y: 0 }}
                    className="w-full md:max-w-3xl md:px-4 pb-4 pt-2"
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
                                data-placeholder="Job description..."
                                className="flex-1 text-gray-200 min-h-[36px] max-h-[300px] overflow-y-auto pt-2 pb-4 focus:outline-none 
                                  text-sm rounded-md empty:before:text-gray-300 empty:before:content-[attr(data-placeholder)] whitespace-pre-wrap break-words"
                                ref={inputRef}
                            />
                            <div className="flex justify-between items-center">

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
                                    {user ? (
                                        isUserReadyToGenDoc() ? (
                                            <>
                                                {!isCvLoad ? (

                                                    <Button className="cursor-pointer bg-transparent border-[1px] border-gray-500 text-sm" onClick={handleSend}>
                                                        <Sparkles className="w-4 h-4" />
                                                        <span>Cv</span>
                                                    </Button>
                                                ) : (
                                                    <Button className="cursor-pointer bg-transparent border-[1px] border-gray-500 text-sm">
                                                        <LoadingIcon />
                                                    </Button>
                                                )}
                                                {!isCoverLoad ? (
                                                    <Button className="cursor-pointer bg-transparent border-[1px] border-gray-500 text-sm" onClick={handleCoverLetter}>
                                                        <Wand2 className="w-4 h-4" />
                                                        <span>Cover letter</span>
                                                    </Button>
                                                ) : (
                                                    <Button className="cursor-pointer bg-transparent border-[1px] border-gray-500 text-sm">
                                                        <LoadingIcon />
                                                    </Button>
                                                )}

                                            </>
                                        ) : (
                                            <Link href={"/profil"} className="cursor-pointer bg-transparent text-blue-500 underline text-sm">
                                                {t("fillProfile")}
                                            </Link>
                                        )
                                    ) : (
                                        <>
                                            <Link href={"/login"}>
                                                <Button className="cursor-pointer bg-transparent border-[1px] border-gray-500 text-sm">
                                                    <Sparkles className="w-4 h-4" />
                                                    <span>Cv</span>
                                                </Button>
                                            </Link>
                                            <Link href={"/login"}>
                                                <Button className="cursor-pointer bg-transparent border-[1px] border-gray-500 text-sm">
                                                    <Wand2 className="w-4 h-4" />
                                                    <span>Cover letter</span>
                                                </Button>
                                            </Link>

                                        </>
                                    )}
                                </div>

                            </div>
                            {isInputEmpty && (
                                <p className="text-red-500 text-xs mt-2">
                                    {t("inputRequired")}
                                </p>
                            )}
                        </motion.div>
                    </div>
                </motion.div>
            </div>
        </>

    );
}
