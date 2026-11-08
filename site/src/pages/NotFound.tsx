import { LinkButton } from "../components/ui";
import { PAGES } from "../site";

export function NotFound() {
  return (
    <section
      aria-labelledby="not-found-title"
      className="px-4 py-24 sm:px-6 sm:py-32"
    >
      <div className="mx-auto flex w-full max-w-[680px] flex-col items-start gap-6">
        <h1 id="not-found-title" className="heading-2 text-foreground">
          Такой страницы нет
        </h1>
        <p className="body-lg text-muted-foreground">
          Возможно, адрес набран с ошибкой. На главной — что такое Соавтор и как
          попасть в бету.
        </p>
        <LinkButton variant="primary" href={PAGES.home.path}>
          На главную
        </LinkButton>
      </div>
    </section>
  );
}
