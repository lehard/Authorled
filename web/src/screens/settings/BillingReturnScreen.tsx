import { useEffect, useRef, useState } from "react";
import { Link } from "react-router";

import { Button } from "@/components/ui/button";
import {
  checkPayment,
  formatDay,
  useBilling,
  useCheckout,
  useSetBilling,
  type Billing,
} from "@/account/billing";
import { MessageScreen } from "@/screens/system/MessageScreen";

// The pages Tochka returns the buyer to (openspec/specs/web/workspace, «Страница возврата после оплаты»):
// /settings/billing/return asks the core to confirm the payment until it is active, at most two minutes;
// /settings/billing/fail offers to pay again.

const EVERY_MS = 3_000;
const AT_MOST_MS = 120_000;

const message = (e: unknown) => (e instanceof Error ? e.message : String(e));

function ToSettings() {
  return (
    <Button asChild variant="outline" className="rounded-full">
      <Link to="/settings#plan">К тарифу</Link>
    </Button>
  );
}

export function BillingReturnScreen() {
  const setBilling = useSetBilling();
  const [paid, setPaid] = useState<Billing | null>(null);
  const [waiting, setWaiting] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [round, setRound] = useState(0);
  const started = useRef(0);

  useEffect(() => {
    let stopped = false;
    started.current = Date.now();
    async function poll() {
      while (!stopped) {
        try {
          const billing = await checkPayment();
          if (stopped) return;
          setBilling(billing);
          if (billing.state === "active") {
            setPaid(billing);
            return;
          }
        } catch (e) {
          setError(message(e));
          setWaiting(false);
          return;
        }
        if (Date.now() - started.current >= AT_MOST_MS) {
          setWaiting(false);
          return;
        }
        await new Promise((resolve) => setTimeout(resolve, EVERY_MS));
      }
    }
    void poll();
    return () => {
      stopped = true;
    };
  }, [round, setBilling]);

  if (paid !== null) {
    return (
      <MessageScreen
        title="Оплата прошла"
        text={`Тариф «${paid.plan.name}» действует до ${formatDay(paid.periodEnd)}. Чек придёт на почту.`}
      >
        <ToSettings />
      </MessageScreen>
    );
  }
  if (waiting) {
    return (
      <MessageScreen
        loading
        title="Подтверждаем оплату…"
        text="Ждём ответа Точки, это занимает до минуты."
      />
    );
  }
  return (
    <MessageScreen
      title="Оплата ещё не подтверждена"
      text={
        error ??
        "Если деньги списались, тариф появится, как только Точка подтвердит оплату."
      }
    >
      <Button
        className="rounded-full"
        onClick={() => {
          setWaiting(true);
          setError(null);
          setRound((n) => n + 1);
        }}
      >
        Проверить ещё раз
      </Button>
      <ToSettings />
    </MessageScreen>
  );
}

export function BillingFailScreen() {
  const { data } = useBilling();
  const checkout = useCheckout();
  const plan = data?.checkoutPlan ?? null;
  return (
    <MessageScreen
      title="Оплата не прошла"
      text={checkout.error ?? "Деньги не списаны. Можно попробовать ещё раз."}
    >
      {plan !== null && (
        <Button
          className="rounded-full"
          disabled={checkout.busy !== null}
          onClick={() => void checkout.pay(plan)}
        >
          Оплатить снова
        </Button>
      )}
      <ToSettings />
    </MessageScreen>
  );
}
