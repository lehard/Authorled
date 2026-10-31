import { cn } from "cn";

/**
 * Waiting animation of the Kabinet: an ink line writes itself and fades out, over and over.
 * Decorative: the waiting text next to it says what happens. Styles: `.ink-loader` in
 * typography.css (still with prefers-reduced-motion).
 */
export function InkLoader({ className }: { className?: string }) {
  return (
    <svg
      viewBox="0 0 96 28"
      aria-hidden
      className={cn("ink-loader", className)}
    >
      <path className="ink-loader-rule" d="M4 24 H92" pathLength={1} />
      <path
        className="ink-loader-ink"
        d="M4 18 C 12 4, 20 4, 24 14 S 34 26, 42 14 S 54 2, 60 12 S 72 26, 80 14 S 88 6, 92 10"
        pathLength={1}
      />
    </svg>
  );
}
