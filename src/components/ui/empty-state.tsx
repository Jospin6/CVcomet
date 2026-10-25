import type { LucideIcon } from "lucide-react";
import { cn } from "@/lib/utils";
export function EmptyState({
  icon: Icon,
  title,
  description,
  action,
  className,
}: {
  icon: LucideIcon;
  title: string;
  description?: string;
  action?: React.ReactNode;
  className?: string;
}) {
  return (
    <div
      className={cn(
        "flex flex-col items-center rounded-lg border border-dashed bg-card px-6 py-10 text-center",
        className,
      )}
    >
      <span className="mb-3 flex size-10 items-center justify-center rounded-md bg-accent text-primary">
        <Icon className="size-5" aria-hidden="true" />
      </span>
      <h2 className="type-h3">{title}</h2>
      {description && (
        <p className="sr-only">
          {description}
        </p>
      )}
      {action && <div className="mt-4">{action}</div>}
    </div>
  );
}
