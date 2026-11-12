import { useEffect, useRef } from "react";

import { EPIGRAPH, VISION, VISION_CARD } from "../content/copy";
import { KOLYA } from "../content/demo";
import { prefersReducedMotion, useInView } from "../motion/hooks";

// The vision phrase (openspec/specs/web/site, «Крупная фраза о видении»; design D4): every word is in the
// prerendered HTML; while the page scrolls, words cross a line at about 55% of the screen and light up. Next to it,
// Uncle Kolya's card with the scenes that show each fact, marked «Концепт» (design D4 of site-coauthor-examples).

function HeroCard() {
  const ref = useRef<HTMLElement>(null);
  useInView(ref);
  return (
    <aside
      ref={ref}
      data-reveal
      aria-label={VISION_CARD.label}
      className="flex w-full max-w-[360px] flex-col gap-4 rounded-2xl bg-card p-5 ring-1 ring-border"
    >
      <div className="flex flex-col gap-1">
        <span className="w-fit rounded-full bg-paper px-2 py-0.5 caption-3 text-muted-foreground ring-1 ring-border">
          {VISION_CARD.badge}
        </span>
        <p className="caption-3 font-normal text-muted-foreground">
          {VISION_CARD.notYet}
        </p>
      </div>
      <div>
        <p className="title-2 text-foreground">
          {KOLYA.name} · {KOLYA.age}
        </p>
        <p className="body-6 text-muted-foreground">{KOLYA.role}</p>
      </div>
      <ul className="flex flex-col divide-y divide-border">
        {KOLYA.facts.map((fact) => (
          <li
            key={fact.text}
            className="flex items-baseline justify-between gap-4 py-2 body-6 text-foreground"
          >
            <span>{fact.text}</span>
            {fact.scene === null ? null : (
              <span className="shrink-0 caption-1 text-ai">
                {VISION_CARD.scene} {fact.scene}
              </span>
            )}
          </li>
        ))}
      </ul>
    </aside>
  );
}

export function Vision() {
  const ref = useRef<HTMLParagraphElement>(null);
  useEffect(() => {
    const phrase = ref.current;
    if (phrase === null) throw new Error("Vision: the phrase is not mounted");
    const words = [...phrase.querySelectorAll<HTMLElement>("[data-word]")];
    if (prefersReducedMotion()) {
      words.forEach((word) => word.setAttribute("data-lit", ""));
      return;
    }
    const observer = new IntersectionObserver(
      (entries) => {
        for (const entry of entries) {
          if (entry.isIntersecting) {
            entry.target.setAttribute("data-lit", "");
            observer.unobserve(entry.target);
          }
        }
      },
      { rootMargin: "0px 0px -45% 0px" },
    );
    words.forEach((word) => observer.observe(word));
    return () => observer.disconnect();
  }, []);

  const words = VISION.split(" ");
  return (
    <section
      aria-labelledby="vision-title"
      className="px-4 py-24 sm:px-6 sm:py-32"
    >
      <figure className="mx-auto mb-12 flex w-full max-w-6xl flex-col gap-2">
        <blockquote className="max-w-[560px] body-6 text-muted-foreground">
          «{EPIGRAPH.quote}»
        </blockquote>
        <figcaption className="caption-1 text-muted-foreground">
          {EPIGRAPH.author}
        </figcaption>
      </figure>
      <div className="mx-auto grid w-full max-w-6xl items-end gap-10 lg:grid-cols-[1fr_auto]">
        <p
          id="vision-title"
          ref={ref}
          className="max-w-[680px] heading-2 text-foreground"
        >
          {words.map((word, index) => (
            <span key={index}>
              <span data-word>{word}</span>
              {index < words.length - 1 ? " " : null}
            </span>
          ))}
        </p>
        <HeroCard />
      </div>
    </section>
  );
}
