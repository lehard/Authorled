import { useState } from "react";

import { Button } from "@/components/ui/button";
import {
  cancelSubscription,
  checkPayment,
  formatDay,
  formatDayYear,
  formatRub,
  useBilling,
  useCheckout,
  useSetBilling,
  type Billing,
} from "@/account/billing";
import { ConfirmDialog } from "@/screens/shared/ConfirmDialog";

import { Row, Section } from "./parts";

// The section «Тариф» of /settings (openspec/specs/web/workspace, «Тариф в настройках», «Неудачное списание в
// настройках»). Everything shown comes from GET /api/v1/billing.

const message = (e: unknown) => (e instanceof Error ? e.message : String(e));

export function PlanSection() {
  const { data, error, isPending, refetch } = useBilling();
  return (
    <Section id="plan" title="Тариф">
      {isPending ? (
        <p role="status" className="text-muted-foreground">
          Загружаем тариф…
        </p>
      ) : error !== null || data === undefined ? (
        <div className="grid justify-items-start gap-2">
          <p role="alert" className="text-destructive">
            Тариф не загрузился: {message(error)}
          </p>
          <Button
            variant="outline"
            className="h-9 rounded-full px-4"
            onClick={() => void refetch()}
          >
            Повторить
          </Button>
        </div>
      ) : (
        <Plan billing={data} />
      )}
    </Section>
  );
}

function Plan({ billing }: { billing: Billing }) {
  const setBilling = useSetBilling();
  const checkout = useCheckout();
  const [confirm, setConfirm] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function act(action: () => Promise<Billing>, failure: string) {
    setBusy(true);
    setError(null);
    try {
      setBilling(await action());
    } catch (e) {
      setError(`${failure}: ${message(e)}`);
    } finally {
      setBusy(false);
    }
  }

  const failedPlan = billing.state === "failed" ? billing.checkoutPlan : null;
  const offers = billing.state === "active" ? [] : billing.offers;
  return (
    <>
      <Row
        label="Текущий тариф"
        hint={
          billing.source === "tochka" ? "оплачен через Точку" : "бесплатный"
        }
      >
        <div className="grid gap-2">
          <p className="pt-1 font-semibold">{billing.plan.name}</p>
          <p className="text-muted-foreground">
            Использовано {billing.usedPercent} % до{" "}
            {formatDay(billing.periodEnd)}
          </p>
          <div
            role="progressbar"
            aria-label="Использованный лимит соавтора"
            aria-valuemin={0}
            aria-valuemax={100}
            aria-valuenow={billing.usedPercent}
            className="h-2 max-w-sm overflow-hidden rounded-full bg-muted"
          >
            <div
              className="h-full rounded-full bg-primary"
              style={{ width: `${billing.usedPercent}%` }}
            />
          </div>
        </div>
      </Row>

      {billing.state === "active" && billing.nextChargeAt !== null && (
        <Row label="Подписка" hint="продлевается каждый месяц">
          <div className="grid justify-items-start gap-2">
            <p className="pt-1">
              Следующее списание {formatDay(billing.nextChargeAt)}
            </p>
            <Button
              variant="outline"
              className="h-9 rounded-full px-4"
              disabled={busy}
              onClick={() => setConfirm(true)}
            >
              Отменить подписку
            </Button>
          </div>
        </Row>
      )}
      {billing.state === "cancelled" && (
        <Row label="Подписка">
          <p className="pt-1">
            Подписка отменена, тариф действует до {formatDay(billing.periodEnd)}
          </p>
        </Row>
      )}
      {billing.state === "pending" && billing.paymentUrl !== null && (
        <Row label="Оплата" hint="ссылка Точки действует неделю">
          <div className="grid justify-items-start gap-2">
            <p className="pt-1">Ожидаем оплату.</p>
            <div className="flex flex-wrap gap-2">
              <Button asChild className="h-9 rounded-full px-4">
                <a href={billing.paymentUrl}>Перейти к оплате</a>
              </Button>
              <Button
                variant="outline"
                className="h-9 rounded-full px-4"
                disabled={busy}
                onClick={() =>
                  void act(checkPayment, "Оплату не удалось проверить")
                }
              >
                Проверить оплату
              </Button>
            </div>
          </div>
        </Row>
      )}
      {failedPlan !== null && (
        <Row label="Оплата">
          <div className="grid justify-items-start gap-2">
            <p role="alert" className="pt-1 text-destructive">
              Оплата не прошла.
            </p>
            <Button
              className="h-9 rounded-full px-4"
              disabled={checkout.busy !== null}
              onClick={() => void checkout.pay(failedPlan)}
            >
              Оплатить снова
            </Button>
          </div>
        </Row>
      )}

      {billing.state !== "active" && (
        <Row label="Платные тарифы" hint="списание раз в месяц, чек на почту">
          {offers.length === 0 ? (
            <p className="pt-1 text-muted-foreground">
              Платные тарифы пока не продаются.
            </p>
          ) : (
            <ul className="grid gap-3">
              {offers.map((offer) => (
                <li
                  key={offer.code}
                  className="flex flex-wrap items-center justify-between gap-3 rounded-xl border border-border p-4"
                >
                  <div className="grid gap-0.5">
                    <span className="font-semibold">{offer.name}</span>
                    <span className="text-caption text-muted-foreground">
                      {formatRub(offer.priceRub)} в месяц, лимит соавтора{" "}
                      {formatRub(offer.limitRub)}
                    </span>
                  </div>
                  <Button
                    className="h-9 rounded-full px-4"
                    disabled={
                      checkout.busy !== null || offer.code === billing.plan.code
                    }
                    onClick={() => void checkout.pay(offer.code)}
                  >
                    Оформить
                  </Button>
                </li>
              ))}
            </ul>
          )}
        </Row>
      )}

      {billing.payments.length > 0 && (
        <Row label="Платежи">
          <ul className="grid gap-1 pt-1">
            {billing.payments.map((payment) => (
              <li
                key={payment.paidAt.toISOString()}
                className="flex flex-wrap gap-x-3"
              >
                <span>{formatDayYear(payment.paidAt)}</span>
                <span className="font-semibold">
                  {formatRub(payment.amountRub)}
                </span>
                <span className="text-muted-foreground">
                  за {formatDay(payment.periodStart)} —{" "}
                  {formatDay(payment.periodEnd)}
                </span>
              </li>
            ))}
          </ul>
        </Row>
      )}

      {(error ?? checkout.error) !== null && (
        <p role="alert" className="text-caption text-destructive">
          {error ?? checkout.error}
        </p>
      )}

      <ConfirmDialog
        open={confirm}
        onOpenChange={setConfirm}
        title="Отменить подписку?"
        text={`Автосписание отключится. Тариф «${billing.plan.name}» действует до ${formatDay(billing.periodEnd)}, потом вы перейдёте на бесплатный тариф.`}
        actionLabel="Отменить подписку"
        onConfirm={() =>
          void act(cancelSubscription, "Подписку не удалось отменить")
        }
      />
    </>
  );
}
