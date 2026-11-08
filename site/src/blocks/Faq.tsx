import { useRef } from "react";

import { FAQ } from "../content/copy";
import { useInView } from "../motion/hooks";

// Questions and answers (openspec/specs/web/site, «Вопросы и ответы списком»; design D9): native
// <details>, so they open from the keyboard and without JavaScript.

export function Faq() {
  const ref = useRef<HTMLDivElement>(null);
  useInView(ref);
  return (
    <section
      aria-labelledby="faq-title"
      className="bg-panel px-4 py-16 sm:px-6 sm:py-24"
    >
      <div
        ref={ref}
        data-reveal
        className="mx-auto flex w-full max-w-3xl flex-col gap-8"
      >
        <h2 id="faq-title" className="heading-2 text-foreground">
          {FAQ.title}
        </h2>
        <div className="flex flex-col divide-y divide-border rounded-2xl bg-paper ring-1 ring-border">
          {FAQ.items.map((item) => (
            <details key={item.q} className="group px-5 py-4 sm:px-6">
              <summary className="flex cursor-pointer list-none items-center justify-between gap-4 rounded-md title-2 text-foreground focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-ring [&::-webkit-details-marker]:hidden">
                {item.q}
                <span
                  aria-hidden="true"
                  className="grid size-7 shrink-0 place-items-center rounded-full text-muted-foreground ring-1 ring-border transition-transform duration-300 ease-base group-open:rotate-45"
                >
                  +
                </span>
              </summary>
              <p className="pt-3 pr-10 body-3 text-muted-foreground">
                {item.a}
              </p>
            </details>
          ))}
        </div>
      </div>
    </section>
  );
}
