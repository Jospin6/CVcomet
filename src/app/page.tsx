"use client"

import {  motion } from "framer-motion";
import { useEffect, useRef, useState } from "react";
import { useDispatch, useSelector } from "react-redux";
import { selectCvState } from "@/redux/cv/cvSlice";
import { useCurrentUser } from "@/hooks/useCurrentUser";
import { AppDispatch } from "@/redux/store";
import { Button } from "@/components/ui/button";
import { fetchUser, selectUser } from "@/redux/user/userSlice";
import { addConversation, selectConversationId, setTypeGeneration } from "@/redux/conversation/conversationSlice";
import { redirect } from "next/navigation";

export default function Home() {
    const inputRef = useRef<HTMLDivElement>(null);
    const [input, setInput] = useState("");
    const dispatch = useDispatch<AppDispatch>();
    const cv = useSelector(selectCvState)
    const user = useCurrentUser();
    const currentUser = useSelector(selectUser)
    const currentConversationId = useSelector(selectConversationId);
    console.log("currentConversation Id: ", currentConversationId)


    const handleSend = () => {
        dispatch(addConversation({content: input, userId: user?.id}))
        dispatch(setTypeGeneration("cv"))
    };

    const handleCoverLetter = () => {
        dispatch(addConversation({content: input, userId: user?.id}))
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
        <div className="flex h-[93vh] items-center justify-center">
            <motion.div
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                className="w-full pb-4 pt-2"
            >
                <div className="max-w-3xl mx-auto px-4">
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
                        <div className="flex gap-2">
                            <Button className="cursor-pointer" onClick={handleSend}>Cv</Button>
                            <Button className="cursor-pointer" onClick={handleCoverLetter}>Cover letter</Button>
                        </div>
                    </motion.div>
                </div>
            </motion.div>
        </div>
    );
}
