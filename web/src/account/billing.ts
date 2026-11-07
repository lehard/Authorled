// The plan of the signed-in user and its payments through Tochka: /api/v1/billing (openspec/specs/api/billing).
// Like the account (meApi.ts), it lives in the core whatever the data source of the screens: the frontend shows
// what the core answers and decides nothing.
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useCallback, useState } from "react";

import { apiRequest, HttpError } from "@/data/apiClient";

export type BillingState =
  "none" | "pending" | "active" | "cancelled" | "failed";

export type Offer = {
  code: string;
  name: string;
  priceRub: string;
  limitRub: string;
};

export type Payment = {
  paidAt: Date;
  amountRub: string;
  periodStart: Date;
  periodEnd: Date;
};

export type Billing = {
  plan: { code: string; name: string; limitRub: string };
  source: "granted" | "tochka";
  periodEnd: Date;
  spentRub: string;
  usedPercent: number;
  state: BillingState;
  nextChargeAt: Date | null;
  paymentUrl: string | null;
  /** The plan of the open or failed checkout: what «Оплатить снова» buys. */
  checkoutPlan: string | null;
  offers: Offer[];
  payments: Payment[];
};

const STATES: readonly BillingState[] = [
  "none",
  "pending",
  "active",
  "cancelled",
  "failed",
];

function unknown(body: unknown): never {
  throw new HttpError(
    `Сервер вернул тариф в неизвестном виде: ${JSON.stringify(body)}`,
    null,
  );
}

function text(value: unknown, body: unknown): string {
  return typeof value === "string" ? value : unknown(body);
}

function date(value: unknown, body: unknown): Date {
  const parsed = new Date(text(value, body));
  return Number.isNaN(parsed.getTime()) ? unknown(body) : parsed;
}

function optional<T>(value: unknown, read: (v: unknown) => T): T | null {
  return value === null ? null : read(value);
}

/** The answer of the core, checked field by field: a changed contract is an error, not an empty page. */
export function parseBilling(body: unknown): Billing {
  const b = body as Record<string, unknown>;
  const plan = b.plan as Record<string, unknown> | undefined;
  if (
    typeof b !== "object" ||
    b === null ||
    plan === undefined ||
    !Array.isArray(b.offers) ||
    !Array.isArray(b.payments) ||
    typeof b.used_percent !== "number" ||
    !STATES.includes(b.state as BillingState) ||
    (b.source !== "granted" && b.source !== "tochka")
  )
    unknown(body);
  return {
    plan: {
      code: text(plan.code, body),
      name: text(plan.name, body),
      limitRub: text(plan.limit_rub, body),
    },
    source: b.source,
    periodEnd: date(b.period_end, body),
    spentRub: text(b.spent_rub, body),
    usedPercent: b.used_percent,
    state: b.state as BillingState,
    nextChargeAt: optional(b.next_charge_at, (v) => date(v, body)),
    paymentUrl: optional(b.payment_url, (v) => text(v, body)),
    checkoutPlan: optional(b.checkout_plan, (v) => text(v, body)),
    offers: (b.offers as Record<string, unknown>[]).map((o) => ({
      code: text(o.code, body),
      name: text(o.name, body),
      priceRub: text(o.price_rub, body),
      limitRub: text(o.limit_rub, body),
    })),
    payments: (b.payments as Record<string, unknown>[]).map((p) => ({
      paidAt: date(p.paid_at, body),
      amountRub: text(p.amount_rub, body),
      periodStart: date(p.period_start, body),
      periodEnd: date(p.period_end, body),
    })),
  };
}

export async function getBilling(): Promise<Billing> {
  return parseBilling((await apiRequest("/billing")).body);
}

/** Ask the core to confirm the payment just made with Tochka. */
export async function checkPayment(): Promise<Billing> {
  return parseBilling(
    (await apiRequest("/billing/check", { method: "POST" })).body,
  );
}

export async function cancelSubscription(): Promise<Billing> {
  return parseBilling(
    (await apiRequest("/billing/cancel", { method: "POST" })).body,
  );
}

/** The address of the payment page of Tochka for the plan. */
export async function startCheckout(plan: string): Promise<string> {
  const { body } = await apiRequest("/billing/checkout", {
    method: "POST",
    json: { plan },
  });
  const url = (body as { payment_url?: unknown } | null)?.payment_url;
  return typeof url === "string" ? url : unknown(body);
}

const KEY = ["billing"] as const;

export function useBilling() {
  return useQuery({ queryKey: KEY, queryFn: getBilling });
}

/** Puts a fresh answer of the core into the cache of the page; the same function on every render. */
export function useSetBilling(): (billing: Billing) => void {
  const queryClient = useQueryClient();
  return useCallback(
    (billing: Billing) => queryClient.setQueryData(KEY, billing),
    [queryClient],
  );
}

const day = new Intl.DateTimeFormat("ru", {
  day: "numeric",
  month: "long",
  timeZone: "Europe/Moscow",
});
const dayYear = new Intl.DateTimeFormat("ru", {
  day: "numeric",
  month: "long",
  year: "numeric",
  timeZone: "Europe/Moscow",
});

export const formatDay = (at: Date) => day.format(at);
export const formatDayYear = (at: Date) => dayYear.format(at);

/** «490 ₽», «990,50 ₽». */
export function formatRub(amount: string): string {
  const [whole, fraction] = amount.split(".");
  const kopecks =
    fraction === undefined ? "" : fraction.padEnd(2, "0").slice(0, 2);
  return `${whole}${kopecks === "" || kopecks === "00" ? "" : `,${kopecks}`} ₽`;
}

/** Go to the payment page of Tochka; a refusal of the core stays on the page with its reason. */
export function useCheckout(): {
  pay: (plan: string) => Promise<void>;
  busy: string | null;
  error: string | null;
} {
  const [busy, setBusy] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  async function pay(plan: string) {
    setBusy(plan);
    setError(null);
    try {
      window.location.assign(await startCheckout(plan));
    } catch (e) {
      setError(
        `Оплату не удалось начать: ${e instanceof Error ? e.message : String(e)}`,
      );
      setBusy(null);
    }
  }
  return { pay, busy, error };
}
