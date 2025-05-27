"use client"
import Link from 'next/link';
import { useTranslation } from 'react-i18next';

export const AuthNavbar = () => {
    const { t } = useTranslation()
    return (
        <div className="w-full px-3 md:w-8/12 md:px-0 h-[50px] md:m-auto bg-[#1a1a1a]">
            <div className="flex items-center justify-between px-4 h-full">
                <h1 className="md:text-2xl text-lg font-bold text-gray-200">{t("cvcomet")}</h1>
                <nav className="flex items-center gap-4">
                    <Link href={"/login"} className="text-white hover:underline">
                        {t("login")}
                    </Link>
                    <Link href={"/signup"} className="text-white hover:underline">
                        {t("signup")}
                    </Link>
                </nav>
            </div>
        </div>
    );
}