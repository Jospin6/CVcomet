"use client";
import { useTranslation } from "react-i18next";
import { Button } from "./button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuRadioGroup,
  DropdownMenuRadioItem,
  DropdownMenuTrigger,
} from "./dropdown-menu";
export default function LanguageSwitcher() {
  const { t, i18n } = useTranslation();
  const changeLanguage = (language: string) => {
    void i18n.changeLanguage(language);
    document.cookie =
      "i18next=" + language + "; path=/; max-age=31536000; SameSite=Lax";
    try {
      localStorage.setItem("i18nextLng", language);
    } catch {}
  };
  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button
          variant="outline"
          aria-label={t("shell.language")}
          className="min-w-16"
        >
          {i18n.resolvedLanguage === "fr" ? "FR" : "EN"}
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end">
        <DropdownMenuRadioGroup
          value={i18n.resolvedLanguage}
          onValueChange={changeLanguage}
        >
          <DropdownMenuRadioItem value="fr">Français</DropdownMenuRadioItem>
          <DropdownMenuRadioItem value="en">English</DropdownMenuRadioItem>
        </DropdownMenuRadioGroup>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
