import { dayLimit } from "@/helpers/constants";
import { clsx, type ClassValue } from "clsx"
import { SignJWT } from "jose";
import { twMerge } from "tailwind-merge"

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs))
}

export function formatDateToMonthYear(dateStr: string): string {
  const date = new Date(dateStr);
  const options: Intl.DateTimeFormatOptions = {
    year: 'numeric',
    month: 'short',
  };

  // Format avec locale française pour "sept." au lieu de "Sep"
  const formatted = date.toLocaleDateString('en-US', options);

  // Capitaliser le premier caractère du mois (ex: sept → Sept)
  return formatted.charAt(0).toUpperCase() + formatted.slice(1);
}
export const transformStringToArray = (input: string): string[] => {
  return input
    .split(",")
    .map(item => item.trim())
    .filter(item => item !== "");
};

export function formatDateToFullYear(dateInput: string | number, language: string): string {
  const date = new Date(dateInput);
  const lang = `${language}-${language === 'fr' ? 'FR' : 'US'}`;
  const options: Intl.DateTimeFormatOptions = {
    day: 'numeric',
    month: 'long',
    year: 'numeric',
  };

  if (isNaN(date.getTime())) {
    return 'Date invalide';
  }

  return date.toLocaleDateString(lang, options);
}

// Define your secret key here or import it from your environment/config
const secret = new TextEncoder().encode(process.env.JWT_SECRET || "secret_key");

export async function generateToken(user: any) {
  const token = await new SignJWT({
    id: user.id,
    email: user.email,
    role: user.role,
  })
    .setProtectedHeader({ alg: "HS256" })
    .setIssuedAt()
    .setExpirationTime(100 * 365 * 24 * 60 * 60)
    .sign(secret);

  return token;
}

export function getTodayGenerationCount(lastGeneratedAt: string, generationCount: number): number {
    const MAX_GENERATIONS = dayLimit;

  const now = new Date();
  const today = now.toISOString().split('T')[0];

  const lastGeneratedDate = new Date(lastGeneratedAt).toISOString().split('T')[0];

  return lastGeneratedDate === today
    ? Math.max(0, MAX_GENERATIONS - generationCount)
    : MAX_GENERATIONS;
}