"use client";

import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { useState } from "react";
import Link from "next/link";
import { useDispatch } from "react-redux";
import { useRouter } from "next/navigation";
import { AppDispatch } from "@/redux/store";
import { Button } from "@/components/ui/button";
import { InputField } from "@/components/ui/InputField";
import { login } from "@/redux/auth/authSlice";
import { useTranslation } from 'react-i18next';
import { safeRedirectPath } from "@/lib/utils";
import { authClient } from "@/lib/auth-client";

const createSchema = (t: (key: string) => string) => z.object({
  email: z.string().email(t("auth.invalidEmail")),
  password: z.string().min(6, t("auth.shortPassword")),
});

export default function Login() {
  const { t } = useTranslation();
  const schema = createSchema(t);
  const router = useRouter();
  const {
    register,
    handleSubmit,
    formState: { errors, isSubmitting },
  } = useForm({ resolver: zodResolver(schema) });
  const dispatch = useDispatch<AppDispatch>();

  const [error, setError] = useState("");

  const onSubmit = async (data: z.infer<typeof schema>) => {
    setError("");

    try {
      await dispatch(login(data)).unwrap();
      router.replace(safeRedirectPath(new URLSearchParams(window.location.search).get("redirect")));
      router.refresh();
    } catch (error) {
      if (typeof error === "object" && error && "message" in error) {
        setError(String((error as { message?: string }).message));
      } else if (typeof error === "string") {
        setError(error);
      } else {
        setError(t("auth.failed"));
      }
    }
  };

  return (
    <div className="auth-card">
      <div className="py-4">
        <p className="eyebrow mb-4">{t("auth.loginEyebrow")}</p>
        <h1 className="type-h1 mb-5">{t("shell.loginIntro")}</h1>
      </div>
      {error && <p role="alert" className="mb-4 rounded-md bg-destructive/10 p-3 text-sm text-destructive">{error}</p>}
      <form onSubmit={handleSubmit(onSubmit)} className="space-y-4">
        <InputField
          label={t("shell.email")}
          type="email"
          
          name={"email"}
          placeholder={"Email"}
          register={register}
          errors={errors}
        />
        <InputField
          label={t("shell.password")}
          type="password"
          
          name={"password"}
          placeholder={t("shell.password")}
          register={register}
          errors={errors}
        />
        <Button type="submit" className="w-full" disabled={isSubmitting}>{t(isSubmitting?"shell.loggingIn":"login")}</Button>
      </form>
      {process.env.NEXT_PUBLIC_GOOGLE_AUTH_ENABLED === "true" && (
        <Button type="button" variant="outline" className="mt-4 w-full" onClick={async () => {
          const result = await authClient.signIn.social({ provider: "google", callbackURL: safeRedirectPath(new URLSearchParams(window.location.search).get("redirect")) });
          if (result.error) setError(result.error.message || t("auth.googleFailed"));
        }}>Google</Button>
      )}
      <div className="mt-6 flex flex-wrap gap-y-2 text-sm justify-center">
        <span className="pr-2 text-muted-foreground">{t("nonAccount")}</span>
        <Link href="/signup" className="text-primary hover:underline">
          {t("signup")}
        </Link>
      </div>
    </div>
  );
}
