import type { ReactNode } from "react";

import { PAGES } from "../site";

// The policy for the data of the beta request (openspec/specs/web/site, «Политика обработки персональных данных»).
// The operator and the contact e-mail come from the owner (2026-11-08): his sole proprietorship, his mail at Yandex and
// his work Telegram. scripts/check-build.mjs refuses a build with a placeholder left.
const OPERATOR =
  "индивидуальный предприниматель Соловьев Алексей Львович (ОГРНИП 320665800145321, ИНН 662103909808)";
const CONTACT_EMAIL = "alexx-ekb@ya.ru";
const CONTACT_TELEGRAM = "alexnight8";

const LINK = "text-primary underline underline-offset-2 hover:no-underline";

function Email() {
  return (
    <a className={LINK} href={`mailto:${CONTACT_EMAIL}`}>
      {CONTACT_EMAIL}
    </a>
  );
}

function Telegram() {
  return (
    <a
      className={LINK}
      href={`https://t.me/${CONTACT_TELEGRAM}`}
      rel="noopener"
    >
      @{CONTACT_TELEGRAM}
    </a>
  );
}

function Part({ title, children }: { title: string; children: ReactNode }) {
  return (
    <section className="flex flex-col gap-3">
      <h2 className="heading-5 text-paper-foreground">{title}</h2>
      {children}
    </section>
  );
}

export function Privacy() {
  return (
    <article className="px-4 py-12 sm:px-6 sm:py-20">
      <div className="mx-auto flex w-full max-w-3xl flex-col gap-10 rounded-2xl bg-paper p-6 shadow-paper ring-1 ring-border sm:p-12">
        <div className="flex flex-col gap-3">
          <a
            className="w-fit body-6 text-muted-foreground hover:text-foreground hover:underline"
            href={PAGES.home.path}
          >
            ← На главную
          </a>
          <h1 className="heading-3 text-paper-foreground">
            Политика обработки персональных данных
          </h1>
          <p className="body-6 text-muted-foreground">
            Действует с 8 ноября 2026 года.
          </p>
        </div>
        <div className="flex flex-col gap-8 body-3 text-paper-foreground">
          <Part title="Кто обрабатывает данные">
            <p>
              Оператор персональных данных — {OPERATOR}. По вопросам обработки
              данных пишите на почту <Email /> или в Telegram <Telegram />.
            </p>
          </Part>
          <Part title="Какие данные мы собираем">
            <p>
              Через форму заявки в бету на этом сайте: адрес почты, имя и кто вы
              (сценарист, писатель или другое).
            </p>
            <p>
              Сайт не ставит счётчики посещений и не хранит данные посетителя в
              браузере.
            </p>
          </Part>
          <Part title="Зачем">
            <p>
              Чтобы рассмотреть заявку, пригласить вас в закрытую бету Соавтора
              и написать вам об этом на указанную почту.
            </p>
          </Part>
          <Part title="Где хранятся и кто их видит">
            <p>
              Заявки хранятся в базе данных на сервере сервиса «Соавтор». Их
              видят только люди, которые проводят бету. Мы не передаём данные
              заявок третьим лицам.
            </p>
          </Part>
          <Part title="Сколько хранятся">
            <p>
              До конца закрытой беты или до отзыва согласия, если вы отзовёте
              его раньше.
            </p>
          </Part>
          <Part title="Как отозвать согласие">
            <p>
              Напишите на <Email /> с той почты, которую указали в заявке, или в
              Telegram <Telegram />, назвав эту почту. Мы удалим заявку и
              ответим, когда это будет сделано.
            </p>
          </Part>
        </div>
      </div>
    </article>
  );
}
