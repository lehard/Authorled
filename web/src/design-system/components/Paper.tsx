import { cn } from "cn";
import type { ComponentProps } from "react";

/** The text column of a document; see `.paper` in typography.css. */
export function Paper({ className, ...props }: ComponentProps<"div">) {
  return <div lang="ru" className={cn("paper", className)} {...props} />;
}
