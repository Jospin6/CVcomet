"use client"

import { Navbar } from "@/components/navbar/navbar";
import Image from "next/image";
import { AnimatePresence, motion } from "framer-motion";// Adjust the path based on your project structure
import { ArrowUpIcon } from "lucide-react";
import { useEffect, useRef, useState } from "react";
import { useDispatch, useSelector } from "react-redux";
import { generateCv, selectCvState } from "@/redux/cv/cvSlice";
import { useCurrentUser } from "@/hooks/useCurrentUser";
import { AppDispatch } from "@/redux/store";
import { experimental_useObject as useObject } from '@ai-sdk/react';
import { cvSchema } from "@/helpers/schema";

export default function Home() {
    const inputRef = useRef<HTMLDivElement>(null);
    const [input, setInput] = useState("");
    const dispatch = useDispatch<AppDispatch>();
    const cv = useSelector(selectCvState)
    const user = useCurrentUser();

    const { object, submit, isLoading } = useObject({
        api: '/api/generate-cv',
        schema: cvSchema,
    });

    const handleSend = () => {
        if (!input.trim()) return;
        submit(input)
        // dispatch(generateCv({ description: input }));
        setInput("");
        if (inputRef.current) {
            inputRef.current.innerText = "";
        }
    };


    return (
        <div>
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
                            data-placeholder="Create a script..."
                            className="flex-1 text-gray-200 bg-gray-800 min-h-[36px] max-h-[350px] overflow-y-auto px-3 py-2 focus:outline-none 
                  text-sm rounded-md empty:before:text-gray-300 empty:before:content-[attr(data-placeholder)] whitespace-pre-wrap break-words"
                            ref={inputRef}
                        />
                        <button
                            onClick={handleSend}
                            className="rounded-full shrink-0 mb-0.5 p-1 bg-black text-white"
                        >
                            <ArrowUpIcon strokeWidth={2.5} className="size-5" />
                        </button>
                    </motion.div>
                </div>
            </motion.div>


            {isLoading && <div>Loading...</div>}

            <div>
                {object?.cvs?.map((cv, index) => (
                    <div key={index}>
                        <p><span className="font-bold">Title</span>{cv!.title}</p>
                        <p><span className="font-bold">Exprience</span>{cv!.experiences}</p>
                        <p><span className="font-bold">Languages</span>{cv!.languages}</p>
                        <p><span className="font-bold">Projects</span>{cv!.projects}</p>
                        <p><span className="font-bold">Summary</span>{cv!.summary}</p>
                    </div>
                ))}
            </div>
        </div>
    );
}
