"use client";

import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import {
  startTransition,
  useActionState,
  useCallback,
  useEffect,
  useState,
} from 'react';
import Link from "next/link"; import { useDispatch } from "react-redux";
import { AppDispatch } from "@/redux/store";
import { redirect } from "next/navigation";
import { signup } from "@/redux/auth/authSlice";
import { InputField } from "@/components/ui/InputField";
import { Button } from "@/components/ui/button";
import { useTranslation } from 'react-i18next';
import { signIn } from "@/lib/auth";
import { signUp } from "@/lib/actions";

const schema = z.object({
  email: z.string().email("Invalid email"),
  password: z.string().min(6, "Short password"),
});

type signupFormData = z.infer<typeof schema>;
type SignUpResponse = {
  message: string;
  data: z.infer<typeof schema> | null;
};

export default function RegisterForm() {
  const { t } = useTranslation()
  const {
    register,
    handleSubmit,
    formState: { errors, isSubmitting },
  } = useForm<signupFormData>({ resolver: zodResolver(schema) });

  const [prevState, formAction, isPending] = useActionState(signUp, undefined);

  return (
    <div className="md:w-[400px] w-[90%] bg-[#1a1a1a] shadow-amber-600 shadow-2xs mx-auto p-6">
      <div className="py-4">
        <div className="font-bold text-gray-200 md:text-xl text-lg flex items-center justify-start">{t("welcome")}</div>
        <h2 className="md:text-2xl text-2xl font-bold mb-4 text-gray-200">{t("signup")}</h2>
      </div>
      <form onSubmit={handleSubmit(async (data) => {
        startTransition(() => {
          formAction(data);
        });
      })}>
        <InputField
          label={"email"}
          name={"email"}
          className="text-white"
          type="email"
          placeholder={"Email"}
          register={register}
          errors={errors}
        />
        <InputField
          label={"password"}
          className="text-white"
          type="password"
          name={"password"}
          placeholder={"Password"}
          register={register}
          errors={errors}
        />
        <Button className="w-4/12 bg-black">{isSubmitting ? "Loading..." : `${t("signup")}`}</Button>
      </form>
      <div className="mt-4 flex text-sm justify-center">
        <span className="pr-2 text-gray-300">{t("haveSignedup")}</span>
        <Link href="/login" className="text-blue-500 hover:underline">
          {t("login")}
        </Link>
      </div>
    </div>
  );
}
