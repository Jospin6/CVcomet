"use client"
import {Menu} from 'lucide-react'
import { useTranslation } from 'react-i18next';
export const Navbar = () => {
    const { t } = useTranslation();
    return <div className="w-full h-64 border-b flex justify-between items-center">
        <div>{t("cvcomet")}</div>
        <div><Menu size={24}/></div>
    </div>
}