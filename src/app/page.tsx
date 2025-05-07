"use client"

import { motion } from "framer-motion";
import { useEffect, useRef, useState } from "react";
import { useDispatch, useSelector } from "react-redux";
import { selectCvState } from "@/redux/cv/cvSlice";
import { useCurrentUser } from "@/hooks/useCurrentUser";
import { AppDispatch } from "@/redux/store";
import { Button } from "@/components/ui/button";
import { fetchUser, selectUser } from "@/redux/user/userSlice";
import { addConversation, selectConversationId, setTypeGeneration } from "@/redux/conversation/conversationSlice";
import { redirect } from "next/navigation";
import { useTranslation } from 'react-i18next';
import { Sparkles, Wand2 } from "lucide-react";

export default function Home() {
    const { t } = useTranslation();
    const inputRef = useRef<HTMLDivElement>(null);
    const [input, setInput] = useState("");
    const dispatch = useDispatch<AppDispatch>();
    const cv = useSelector(selectCvState)
    const user = useCurrentUser();
    const currentUser = useSelector(selectUser)
    const currentConversationId = useSelector(selectConversationId)



    const handleSend = () => {
        dispatch(addConversation({ content: input, userId: user?.id }))
        dispatch(setTypeGeneration("cv"))
    };

    const handleCoverLetter = () => {
        dispatch(addConversation({ content: input, userId: user?.id }))
        dispatch(setTypeGeneration("coverLetter"))

    };

    useEffect(() => {
        if (currentConversationId != null) {
            redirect(`/g/${currentConversationId}`);
        }
    }, [currentConversationId])

    useEffect(() => {
        if (user?.id) {
            dispatch(fetchUser(user.id));
        }
    }, [user?.id, dispatch]);



    return (
        <>
            <div className="flex flex-col items-center justify-center min-h-[90vh] gap-4">
                {/* Première partie : titre et description */}
                <div className="text-center max-w-2xl mx-auto  px-4">
                    <motion.h1
                        initial={{ opacity: 0, y: 20 }}
                        animate={{ opacity: 1, y: 0 }}
                        transition={{ duration: 0.8, ease: "easeOut" }}
                        className="text-xl font-extrabold text-white leading-tight mb-4"
                    >
                        {t("bigTitle")}
                    </motion.h1>
                    <motion.p
                        initial={{ opacity: 0, y: 10 }}
                        animate={{ opacity: 1, y: 0 }}
                        transition={{ duration: 1, delay: 0.3, ease: "easeOut" }}
                        className="text-gray-400 text-sm leading-relaxed"
                    >
                        {t("bigDescription")}
                    </motion.p>
                </div>

                {/* Deuxième partie : input + boutons */}
                {/* <motion.div
                    initial={{ opacity: 0, y: 10 }}
                    animate={{ opacity: 1, y: 0 }}
                    className="w-full max-w-3xl px-4 pb-4 pt-2"
                >
                    <motion.div
                        animate={{ height: "auto" }}
                        whileFocus={{ scale: 1.01 }}
                        transition={{ duration: 0.2 }}
                        className="relative rounded-2xl lg:rounded-e-3xl p-2.5 flex gap-2 bg-background"
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
                            className="flex-1 text-gray-600 bg-gray-300 min-h-[100px] max-h-[350px] overflow-y-auto px-3 py-2 focus:outline-none 
            text-sm rounded-md empty:before:text-gray-600 empty:before:content-[attr(data-placeholder)] whitespace-pre-wrap break-words"
                            ref={inputRef}
                        />
                        <div className="flex flex-col gap-2">
                            <Button className="cursor-pointer" onClick={handleSend}>
                                Cv
                            </Button>
                            <Button className="cursor-pointer" onClick={handleCoverLetter}>
                                Cover letter
                            </Button>
                        </div>
                    </motion.div>
                </motion.div> */}
                <motion.div
                    initial={{ opacity: 0, y: 10 }}
                    animate={{ opacity: 1, y: 0 }}
                    className="w-full max-w-3xl px-4 pb-4 pt-2"
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
                                data-placeholder="Job description..."
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
            </div>
        </>

    );
}
