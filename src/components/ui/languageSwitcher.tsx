'use client';

import { useTranslation } from 'react-i18next';
import { useRouter, usePathname } from 'next/navigation';
import {
    DropdownMenu,
    DropdownMenuTrigger,
    DropdownMenuContent,
    DropdownMenuItem,
} from "@/components/ui/dropdown-menu";

export default function LanguageSwitcher() {
    const { i18n } = useTranslation();
    const router = useRouter();
    const pathname = usePathname();

    const changeLanguage = (lng: string) => {
        i18n.changeLanguage(lng);

        const segments = pathname.split('/');
        if (segments[1] === 'en' || segments[1] === 'fr') {
            segments[1] = lng;
        } else {
            segments.splice(1, 0, lng);
        }
        const newPath = segments.join('/');

        router.push(newPath);
    };

    return (
        <DropdownMenu>
            <DropdownMenuTrigger className="size-[25px] cursor-pointer rounded-md border-[1px] text-white text-[12px] font-medium">
                {i18n.language === 'fr' ? 'FR' : 'EN'}
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end">
                <DropdownMenuItem onClick={() => changeLanguage('en')}>
                    English
                </DropdownMenuItem>
                <DropdownMenuItem onClick={() => changeLanguage('fr')}>
                    Français
                </DropdownMenuItem>
            </DropdownMenuContent>
        </DropdownMenu>
    );
}
