"use client"

import { AppDispatch } from "@/redux/store"
import { fetchTemplate, selectTemplate } from "@/redux/template/templateSlice"
import { useEffect, useState } from "react"
import { useDispatch, useSelector } from "react-redux"
import Image from "next/image";

export default function Modal({ params }: { params: { templateId: string } }) {
    const dispatch = useDispatch<AppDispatch>()
    const id = params.templateId
    const template = useSelector(selectTemplate)
    const [avatarUrl, setAvatarUrl] = useState<string | null>(null);

    useEffect(() => {
        if (template?.id) {
            const imageUrl = `/api/avatar?id=${template.id}`;
            setAvatarUrl(imageUrl);
        }
    }, [template?.id]);

    useEffect(() => {
        dispatch(fetchTemplate({ id }))
    }, [dispatch])

    return <div className="h-screen w-full bg-red-800 z-20 flex items-center justify-center">
        <div className="grid w-[60%] h-[70vh] bg-white grid-cols-6 rounded-lg gap-4">
            <div className="col-span-4 flex justify-center items-center">
                <div className="w-[80%] h-[90%]">
                    {avatarUrl && (
                        <Image
                            src={avatarUrl}
                            alt={`Template ${template?.name}`}
                            fill
                            className="object-fill w-[300px] h-[500px]"
                        />
                    )}
                </div>
            </div>
            <div className="col-span-2"></div>
        </div>
    </div>
}