"use client";
import {
  useId,
  type ChangeEvent,
  type MouseEvent,
  type HTMLInputTypeAttribute,
} from "react";
import {
  get,
  type FieldError,
  type FieldErrors,
  type FieldValues,
  type Path,
  type UseFormRegister,
} from "react-hook-form";
import { Input } from "./input";
import { useTranslation } from "react-i18next";
import { Label } from "./label";
import { cn } from "@/lib/utils";

interface InputFieldProps<T extends FieldValues> {
  label: string;
  type?: HTMLInputTypeAttribute;
  name: Path<T>;
  placeholder: string;
  register: UseFormRegister<T>;
  errors: FieldErrors<T>;
  className?: string;
  onChange?: (_event: ChangeEvent<HTMLInputElement>) => void;
  onClick?: (_event: MouseEvent<HTMLInputElement>) => void;
}
export function InputField<T extends FieldValues>({
  label,
  onChange,
  onClick,
  type,
  name,
  placeholder,
  register,
  errors,
  className,
}: InputFieldProps<T>) {
  const { t } = useTranslation();
  const id = useId();
  const field = register(name);
  const error = get(errors, name) as FieldError | undefined;
  return (
    <div className={cn("mb-4 min-w-0 space-y-2", className)}>
      <Label htmlFor={id} className={label ? undefined : "sr-only"}>
        {label || t(name)}
      </Label>
      <Input
        {...field}
        id={id}
        type={type}
        placeholder={placeholder}
        onClick={onClick}
        autoComplete={
          type === "email"
            ? "email"
            : type === "password"
              ? "current-password"
              : undefined
        }
        aria-invalid={!!error}
        aria-describedby={error ? id + "-error" : undefined}
        onChange={(event) => {
          void field.onChange(event);
          onChange?.(event);
        }}
      />
      {error?.message && (
        <p id={id + "-error"} role="alert" className="text-sm text-destructive">
          {error.message}
        </p>
      )}
    </div>
  );
}
