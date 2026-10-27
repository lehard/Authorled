import {
  CircleCheckIcon,
  CircleDashedIcon,
  CircleDotDashedIcon,
  CircleDotIcon,
  ClockIcon,
  ContrastIcon,
  TriangleAlertIcon,
  type LucideIcon,
} from "lucide-react";

// Visual semantics of document statuses (openspec/specs/web/design-system). Which status a
// document has is decided by the backend; this table only says how each one looks.
// Classes are spelled out in full so Tailwind can find them.
export const DOCUMENT_STATUSES = {
  not_started: {
    label: "Не начат",
    Icon: CircleDashedIcon,
    className:
      "border-status-not-started-border bg-status-not-started-subtle text-status-not-started",
  },
  draft: {
    label: "Черновик",
    Icon: CircleDotDashedIcon,
    className:
      "border-status-draft-border bg-status-draft-subtle text-status-draft",
  },
  in_progress: {
    label: "В работе",
    Icon: ContrastIcon,
    className:
      "border-status-in-progress-border bg-status-in-progress-subtle text-status-in-progress",
  },
  ready: {
    label: "Ждёт утверждения",
    Icon: CircleDotIcon,
    className:
      "border-status-ready-border bg-status-ready-subtle text-status-ready",
  },
  approved: {
    label: "Утверждён",
    Icon: CircleCheckIcon,
    className:
      "border-status-approved-border bg-status-approved-subtle text-status-approved",
  },
  stale: {
    label: "Устарел",
    Icon: ClockIcon,
    className:
      "border-status-stale-border bg-status-stale-subtle text-status-stale",
  },
  conflict: {
    label: "Противоречие",
    Icon: TriangleAlertIcon,
    className:
      "border-status-conflict-border bg-status-conflict-subtle text-status-conflict",
  },
} as const satisfies Record<
  string,
  { label: string; Icon: LucideIcon; className: string }
>;

export type DocumentStatus = keyof typeof DOCUMENT_STATUSES;

export function documentStatus(value: string) {
  if (!Object.hasOwn(DOCUMENT_STATUSES, value)) {
    throw new Error(`Unknown document status: ${value}`);
  }
  return DOCUMENT_STATUSES[value as DocumentStatus];
}
