import type { AnchorHTMLAttributes, ReactNode } from "react";

// Buttons and frames of the site on the semantic tokens of the design system.

const BUTTON_BASE =
  "inline-flex items-center justify-center gap-2 rounded-full px-5 py-3 button-md transition-[background-color,transform] duration-300 ease-base focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ring active:scale-[0.98] disabled:pointer-events-none disabled:opacity-60";

const VARIANTS = {
  primary: "bg-primary text-primary-foreground hover:bg-primary/90",
  secondary: "bg-card text-foreground ring-1 ring-border-strong hover:bg-muted",
} as const;

export function buttonClass(variant: keyof typeof VARIANTS): string {
  return `${BUTTON_BASE} ${VARIANTS[variant]}`;
}

export function LinkButton({
  variant,
  children,
  ...rest
}: AnchorHTMLAttributes<HTMLAnchorElement> & {
  variant: keyof typeof VARIANTS;
  children: ReactNode;
}) {
  return (
    <a className={buttonClass(variant)} {...rest}>
      {children}
    </a>
  );
}

/** A screenshot of the service in both widths, framed like a sheet on the desk. */
export function Shot({
  name,
  alt,
  caption,
  priority,
}: {
  name: string;
  alt: string;
  caption?: string;
  priority?: boolean;
}) {
  return (
    <figure className="flex flex-col gap-3">
      <div className="overflow-hidden rounded-2xl bg-panel p-2 shadow-panel ring-1 ring-border">
        <img
          className="block h-auto w-full rounded-xl"
          src={`/shots/${name}-1440.webp`}
          srcSet={`/shots/${name}-720.webp 720w, /shots/${name}-1440.webp 1440w`}
          sizes="(min-width: 1024px) 960px, 100vw"
          width={1440}
          height={900}
          alt={alt}
          loading={priority ? "eager" : "lazy"}
          fetchPriority={priority ? "high" : "auto"}
        />
      </div>
      {caption ? (
        <figcaption className="body-6 text-muted-foreground">
          {caption}
        </figcaption>
      ) : null}
    </figure>
  );
}

export function Section({
  id,
  labelledBy,
  className,
  children,
}: {
  id?: string;
  labelledBy: string;
  className?: string;
  children: ReactNode;
}) {
  return (
    <section
      id={id}
      aria-labelledby={labelledBy}
      className={`scroll-mt-24 px-4 py-16 sm:px-6 sm:py-24 ${className ?? ""}`}
    >
      <div className="mx-auto flex w-full max-w-6xl flex-col gap-10">
        {children}
      </div>
    </section>
  );
}
