import { cn } from "cn";

import { Badge } from "@/components/ui/badge";
import { documentStatus, type DocumentStatus } from "@/design-system/statuses";

type StatusBadgeProps = {
  /** Status from the backend. An unknown value throws instead of rendering a neutral badge. */
  status: DocumentStatus | (string & {});
  /** Replaces the default label, e.g. "Устарел после правки Д4". */
  label?: string;
  className?: string;
};

/** Document status: always colour, icon and text together. */
export function StatusBadge({ status, label, className }: StatusBadgeProps) {
  const { label: defaultLabel, Icon, className: tone } = documentStatus(status);
  return (
    <Badge variant="outline" className={cn(tone, className)}>
      <Icon aria-hidden data-icon="inline-start" />
      {label ?? defaultLabel}
    </Badge>
  );
}
