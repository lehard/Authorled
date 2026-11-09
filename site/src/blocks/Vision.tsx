import { useEffect, useRef } from "react";

import { VISION } from "../content/copy";
import { prefersReducedMotion } from "../motion/hooks";

// The vision phrase (openspec/specs/web/site, «Крупная фраза о видении»; design D4): every word is in the
// prerendered HTML; while the page scrolls, words cross a line at about 55% of the screen and light up.

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
    <section aria-label="Видение" className="px-4 py-24 sm:px-6 sm:py-32">
      <p ref={ref} className="mx-auto max-w-[880px] heading-2 text-foreground">
        {words.map((word, index) => (
          <span key={index}>
            <span data-word>{word}</span>
            {index < words.length - 1 ? " " : null}
          </span>
        ))}
      </p>
    </section>
  );
}
