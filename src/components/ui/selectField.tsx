"use client";
import { useId, type ChangeEvent } from "react";
import {
  get,
  type FieldError,
  type FieldErrors,
  type FieldValues,
  type Path,
  type UseFormRegister,
} from "react-hook-form";
import { Label } from "./label";
interface SelectFieldProps<T extends FieldValues> {
  name: Path<T>;
  label: string;
  options: { value: string; label: string }[];
  register: UseFormRegister<T>;
  errors: FieldErrors<T>;
  onChange?: (_event: ChangeEvent<HTMLSelectElement>) => void;
  defaultValue?: string;
}
export function SelectField<T extends FieldValues>({
  name,
  label,
  defaultValue,
  options,
  register,
  onChange,
  errors,
}: SelectFieldProps<T>) {
  const id = useId();
  const field = register(name);
  const error = get(errors, name) as FieldError | undefined;
  return (
    <div className="mb-4 min-w-0 space-y-2">
      <Label htmlFor={id}>{label}</Label>
      <select
        {...field}
        id={id}
        defaultValue={defaultValue ?? ""}
        onChange={(event) => {
          void field.onChange(event);
          onChange?.(event);
        }}
        aria-invalid={!!error}
        aria-describedby={error ? id + "-error" : undefined}
        className="h-10 w-full rounded-md border border-input bg-card px-3 text-base text-foreground md:text-sm"
      >
        <option value="" disabled>
          — {label} —
        </option>
        {options.map((option) => (
          <option key={option.value} value={option.value}>
            {option.label}
          </option>
        ))}
      </select>
      {error?.message && (
        <p id={id + "-error"} role="alert" className="text-sm text-destructive">
          {error.message}
        </p>
      )}
    </div>
  );
}
