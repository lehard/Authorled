import type { ReactNode } from "react";

import { APP_URL, PAGES } from "../site";
import { buttonClass } from "./ui";

function BrandMark() {
  return (
    <a
      href="/"
      className="flex items-center gap-2 rounded-full title-3 text-foreground focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-ring"
    >
      <span
        aria-hidden="true"
        className="grid size-7 place-items-center rounded-full bg-primary caption-3 text-primary-foreground"
        style={{ fontFamily: "var(--font-heading)" }}
      >
        С
      </span>
      Соавтор
    </a>
  );
}

export function Layout({ children }: { children: ReactNode }) {
  return (
    <div className="flex min-h-dvh flex-col bg-desk text-foreground">
      <a
        href="#main"
        className="sr-only rounded-full bg-primary px-4 py-2 button-sm text-primary-foreground focus:not-sr-only focus:fixed focus:top-4 focus:left-4 focus:z-50"
      >
        К содержанию
      </a>
      <header className="sticky top-0 z-40 px-4 pt-4 sm:px-6">
        <nav
          aria-label="Основная навигация"
          className="mx-auto flex w-full max-w-6xl items-center justify-between gap-4 rounded-full bg-panel/85 px-4 py-2 shadow-panel ring-1 ring-border backdrop-blur-md"
        >
          <BrandMark />
          <a
            href={APP_URL}
            className={`${buttonClass("secondary")} px-4 py-2 button-sm`}
          >
            Войти
          </a>
        </nav>
      </header>
      <main id="main" className="flex-1">
        {children}
      </main>
      <footer className="px-4 pt-8 pb-12 sm:px-6">
        <div className="mx-auto flex w-full max-w-6xl flex-col gap-4 border-t border-border pt-8 body-6 text-muted-foreground sm:flex-row sm:items-center sm:justify-between">
          <p>Соавтор, закрытая бета, 2026</p>
          <ul className="flex flex-wrap gap-x-6 gap-y-2">
            <li>
              <a
                className="hover:text-foreground hover:underline"
                href={PAGES.privacy.path}
              >
                Политика обработки персональных данных
              </a>
            </li>
            <li>
              <a
                className="hover:text-foreground hover:underline"
                href={APP_URL}
              >
                Войти
              </a>
            </li>
          </ul>
        </div>
      </footer>
    </div>
  );
}
