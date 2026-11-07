import type { ReactNode } from "react";

// Parts of the settings page: a section with its title and a row with a label.

export function Section({
  id,
  title,
  children,
}: {
  id: string;
  title: string;
  children: ReactNode;
}) {
  return (
    <section
      id={id}
      aria-labelledby={`${id}-title`}
      className="grid scroll-mt-6 gap-6"
    >
      <h2 id={`${id}-title`} className="font-heading text-heading-1">
        {title}
      </h2>
      {children}
    </section>
  );
}

export function Row({
  label,
  hint,
  labelFor,
  children,
}: {
  label: string;
  hint?: string;
  labelFor?: string;
  children: ReactNode;
}) {
  return (
    <div className="grid gap-2 sm:grid-cols-[180px_1fr] sm:gap-6">
      <div className="grid content-start gap-0.5">
        {labelFor === undefined ? (
          <span className="font-semibold">{label}</span>
        ) : (
          <label htmlFor={labelFor} className="font-semibold">
            {label}
          </label>
        )}
        {hint !== undefined && (
          <span className="text-caption text-muted-foreground">{hint}</span>
        )}
      </div>
      <div className="min-w-0">{children}</div>
    </div>
  );
}
