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

const schema = z.object({
  email: z.string().email("Invalide email"),
  password: z.string().min(6, "Short password"),
});

export default function Login() {
  const { t } = useTranslation()
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
      router.replace("/");
    } catch (error) {
      if (typeof error === "object" && error && "message" in error) {
        setError(String((error as { message?: string }).message));
      } else if (typeof error === "string") {
        setError(error);
      } else {
        setError("Authentication failed");
      }
    }
  };

  return (
    <div className="auth-card">
      <div className="py-4">
        <p className="eyebrow mb-4">CVcomet / Welcome back</p>
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
      <div className="mt-6 flex flex-wrap gap-y-2 text-sm justify-center">
        <span className="pr-2 text-muted-foreground">{t("nonAccount")}</span>
        <Link href="/signup" className="text-primary hover:underline">
          {t("signup")}
        </Link>
      </div>
    </div>
  );
}
