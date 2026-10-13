"use client";

import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { useState } from "react";
import Link from "next/link"; import { useDispatch } from "react-redux";
import { AppDispatch } from "@/redux/store";
import { useRouter } from "next/navigation";
import { signup } from "@/redux/auth/authSlice";
import { InputField } from "@/components/ui/InputField";
import { Button } from "@/components/ui/button";

import { useTranslation } from 'react-i18next';
import { authClient } from "@/lib/auth-client";

const schema = z.object({
  email: z.string().email("Invalid email"),
  password: z.string().min(6, "Short password"),
});

type signupFormData = z.infer<typeof schema>;

export default function RegisterForm() {
  const { t } = useTranslation()
  const router = useRouter();
  const dispatch = useDispatch<AppDispatch>();
  const {
    register,
    handleSubmit,
    formState: { errors, isSubmitting },
  } = useForm<signupFormData>({ resolver: zodResolver(schema) });

  const [error, setError] = useState("");

  const onSubmit = async (data: signupFormData) => {
    setError("");
    try {
      await dispatch(signup(data)).unwrap();
      router.replace("/onboarding");
      router.refresh();
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
        <p className="eyebrow mb-4">CVcomet / Your career workspace</p>
        <h1 className="type-h1 mb-5">{t("shell.signupIntro")}</h1>
      </div>
      {error && <p role="alert" className="mb-4 rounded-md bg-destructive/10 p-3 text-sm text-destructive">{error}</p>}
      <form onSubmit={handleSubmit(onSubmit)}>
        <InputField
          label={t("shell.email")}
          name={"email"}
          
          type="email"
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
        <Button type="submit" className="w-full" disabled={isSubmitting}>{t(isSubmitting?"shell.signingUp":"signup")}</Button>
      </form>
      {process.env.NEXT_PUBLIC_GOOGLE_AUTH_ENABLED === "true" && (
        <Button type="button" variant="outline" className="mt-4 w-full" onClick={async () => {
          const result = await authClient.signIn.social({ provider: "google", callbackURL: "/onboarding" });
          if (result.error) setError(result.error.message || "Google sign-in failed");
        }}>Google</Button>
      )}
      <div className="mt-6 flex flex-wrap gap-y-2 text-sm justify-center">
        <span className="pr-2 text-muted-foreground">{t("haveSignedup")}</span>
        <Link href="/login" className="text-primary hover:underline">
          {t("login")}
        </Link>
      </div>
    </div>
  );
}
