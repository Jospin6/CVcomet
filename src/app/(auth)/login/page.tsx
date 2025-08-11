"use client";

import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { redirect, useSearchParams } from "next/navigation";
import { startTransition, useActionState, useCallback, useState } from "react";
import Link from "next/link";
import { useDispatch } from "react-redux";
import { AppDispatch } from "@/redux/store";
import { Button } from "@/components/ui/button";
import { InputField } from "@/components/ui/InputField";
import { login } from "@/redux/auth/authSlice";
import { useTranslation } from 'react-i18next';
import { signIn } from "@/lib/auth";
import { authenticate } from "@/lib/authenticate";

const schema = z.object({
  email: z.string().email("Invalide email"),
  password: z.string().min(6, "Short password"),
});

export default function Login() {
  const { t } = useTranslation()
  const {
    register,
    handleSubmit,
    formState: { errors, isSubmitting },
  } = useForm({ resolver: zodResolver(schema) });
  const [errorMessage, formAction, isPending] = useActionState(
    authenticate,
    undefined
  );

  const searchparams = useSearchParams();

  const onSubmit = useCallback(
    (data: z.infer<typeof schema>) => {
      startTransition(() => {
        formAction({
          ...data,
          redirect: searchparams.get('redirect') || undefined,
        });
      });
    },
    [formAction, searchparams]
  );

  return (
    <div className="md:w-[400px] w-[90%] bg-[#1a1a1a] shadow-amber-600 shadow-2xs mx-auto p-6">
      <div className="py-4">
        <div className="font-bold text-gray-200 md:text-xl text-lg flex items-center justify-start">{t("welcomeBack")}</div>
        <h2 className="md:text-2xl text-2xl font-bold mb-4 text-gray-200">{t("login")}</h2>
      </div>
      <form onSubmit={handleSubmit(onSubmit)} className="space-y-4">
        <InputField
          label={"Email"}
          type="email"
          className="text-white"
          name={"email"}
          placeholder={"Email"}
          register={register}
          errors={errors}
        />
        <InputField
          label={"Password"}
          type="password"
          className="text-white"
          name={"password"}
          placeholder={"Password"}
          register={register}
          errors={errors}
        />
        <Button className="w-4/12 bg-black">{isSubmitting ? "Connexion..." : `${t("login")}`}</Button>
      </form>
      <div className="mt-4 flex text-sm justify-center">
        <span className="pr-2 text-gray-300">{t("nonAccount")}</span>
        <Link href="/signup" className="text-blue-500 hover:underline">
          {t("signup")}
        </Link>
      </div>
    </div>
  );
}
