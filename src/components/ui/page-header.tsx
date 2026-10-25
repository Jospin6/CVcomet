export function PageHeader({
  eyebrow,
  title,
  description,
  action,
}: {
  eyebrow?: string;
  title: string;
  description?: string;
  action?: React.ReactNode;
}) {
  return (
    <div className="mb-6 flex min-h-9 flex-wrap items-center justify-between gap-4 border-b border-border pb-5">
      <div className="min-w-0">
        {eyebrow && <p className="eyebrow mb-2">{eyebrow}</p>}
        <h1 className="type-h1 break-words">{title}</h1>
        {description && (
          <p className="sr-only">
            {description}
          </p>
        )}
      </div>
      {action && <div className="shrink-0">{action}</div>}
    </div>
  );
}
export function SectionHeader({
  title,
  description,
  action,
}: {
  title: string;
  description?: string;
  action?: React.ReactNode;
}) {
  return (
    <div className="mb-4 flex flex-wrap items-center justify-between gap-3 border-b border-border pb-3">
      <div>
        <h2 className="type-h2">{title}</h2>
        {description && (
          <p className="sr-only">{description}</p>
        )}
      </div>
      {action}
    </div>
  );
}
