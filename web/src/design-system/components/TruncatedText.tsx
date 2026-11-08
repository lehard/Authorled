import { cn } from "cn";
import { useRef, useState, type ReactNode } from "react";

import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip";

type TruncatedTextProps = {
  children: ReactNode;
  className?: string;
  /** Where the full text shows; the navigator is on the left, so its tooltips go right. */
  side?: "top" | "right" | "bottom" | "left";
};

/**
 * One line cut with an ellipsis; hovering a line that is cut shows it in full in a tooltip
 * of the design system (native `title` tooltips are not used, `check:native-ui`). A line that
 * fits shows nothing.
 */
export function TruncatedText({
  children,
  className,
  side = "right",
}: TruncatedTextProps) {
  const ref = useRef<HTMLSpanElement>(null);
  const [open, setOpen] = useState(false);
  return (
    <TooltipProvider delayDuration={400}>
      <Tooltip
        open={open}
        onOpenChange={(next) => {
          const el = ref.current;
          setOpen(next && el !== null && el.scrollWidth > el.clientWidth);
        }}
      >
        <TooltipTrigger asChild>
          <span ref={ref} className={cn("truncate", className)}>
            {children}
          </span>
        </TooltipTrigger>
        <TooltipContent side={side}>{children}</TooltipContent>
      </Tooltip>
    </TooltipProvider>
  );
}
