"use client";
import { useId } from "react";
import {
  get,
  type FieldError,
  type FieldErrors,
  type FieldValues,
  type Path,
  type UseFormRegister,
} from "react-hook-form";
import { useTranslation } from "react-i18next";
import { Label } from "./label";
import { Textarea } from "./textarea";
interface TextAreaFieldProps<T extends FieldValues> {
  label: string;
  name: Path<T>;
  placeholder: string;
  register: UseFormRegister<T>;
  errors: FieldErrors<T>;
  className?: string;
  defaultValue?: string;
}
export function TextAreaField<T extends FieldValues>({
  label,
  name,
  defaultValue,
  register,
  errors,
  className,
  placeholder,
}: TextAreaFieldProps<T>) {
  const { t } = useTranslation();
  const id = useId();
  const error = get(errors, name) as FieldError | undefined;
  return (
    <div className="mb-4 min-w-0 space-y-2">
      <Label htmlFor={id} className={label ? undefined : "sr-only"}>
        {label || t(name)}
      </Label>
      <Textarea
        {...register(name)}
        id={id}
        defaultValue={defaultValue}
        className={className}
        placeholder={placeholder}
        rows={3}
        aria-invalid={!!error}
        aria-describedby={error ? id + "-error" : undefined}
      />
      {error?.message && (
        <p id={id + "-error"} role="alert" className="text-sm text-destructive">
          {error.message}
        </p>
      )}
    </div>
  );
}
