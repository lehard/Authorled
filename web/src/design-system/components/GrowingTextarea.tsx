import { cn } from "cn";
import type { ComponentProps } from "react";

/** How far the field grows before it scrolls inside: lines of its text, a share of the window height, or not at all. */
export type GrowLimit = { rows: number } | { screen: number } | "none";

type GrowingTextareaProps = Omit<
  ComponentProps<"textarea">,
  "value" | "rows" | "className" | "style"
> & {
  value: string;
  /** Lowest height, in lines of the field's text. */
  minRows: number;
  limit: GrowLimit;
  /** `field`: border and focus ring like other inputs; `bare`: no box (the place draws it). */
  variant: "field" | "bare";
  /** Classes of the box around the field: border, background, padding, font, focus ring. */
  className?: string;
  placeholderClassName?: string;
};

const FIELD =
  "rounded-lg border border-input bg-transparent px-2.5 py-2 text-base transition-colors focus-within:border-ring focus-within:ring-3 focus-within:ring-ring/50 md:text-sm dark:bg-input/30";

function maxHeight(limit: GrowLimit): string | undefined {
  if (limit === "none") return undefined;
  if ("rows" in limit) return `calc(${limit.rows} * 1lh)`;
  return `calc(${limit.screen} * 100dvh)`;
}

/**
 * The one multi-line field of the interface; it grows with its text in every browser
 * (openspec/specs/web/design-system, «Многострочные поля растут с текстом»).
 *
 * The field and an invisible copy of its text share one grid cell: the copy sets the height of the
 * cell and the field stretches over it, so the browser lays out the height itself, with no
 * measuring and no CSS sizing of the field that old Safari lacks. The copy carries the lowest
 * height and the limit; past the
 * limit the field scrolls inside. A space after the text makes an empty last line count.
 */
export function GrowingTextarea({
  value,
  minRows,
  limit,
  variant,
  className,
  placeholderClassName,
  placeholder,
  ...props
}: GrowingTextareaProps) {
  const copy = value === "" ? (placeholder ?? "") : value;
  return (
    <div
      className={cn(
        "grid grid-cols-[minmax(0,1fr)]",
        variant === "field" && FIELD,
        className,
      )}
    >
      <span
        aria-hidden
        className="invisible col-start-1 row-start-1 overflow-hidden wrap-anywhere whitespace-pre-wrap"
        style={{
          minHeight: `calc(${minRows} * 1lh)`,
          maxHeight: maxHeight(limit),
        }}
      >
        {`${copy} `}
      </span>
      <textarea
        {...props}
        rows={1}
        value={value}
        placeholder={placeholder}
        className={cn(
          "col-start-1 row-start-1 resize-none overflow-y-auto bg-transparent wrap-anywhere outline-none placeholder:text-muted-foreground",
          placeholderClassName,
        )}
      />
    </div>
  );
}
