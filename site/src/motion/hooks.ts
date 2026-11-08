import { useEffect, useState, type RefObject } from "react";

// Motion of the site (openspec/specs/web/site, «Движение на сайте»; design D1–D2). Sections start once
// when about 30% of them is visible; repeating stories pause off screen; «reduce motion» shows the end state.

export function prefersReducedMotion(): boolean {
  return window.matchMedia("(prefers-reduced-motion: reduce)").matches;
}

/** Sets `data-in` on the element once it has been on screen; the CSS reveal and line drawing key off it. */
export function useInView(
  ref: RefObject<HTMLElement | SVGElement | null>,
  threshold = 0.3,
): void {
  useEffect(() => {
    const element = ref.current;
    if (element === null)
      throw new Error("useInView: the element is not mounted");
    if (prefersReducedMotion()) {
      element.setAttribute("data-in", "");
      return;
    }
    const observer = new IntersectionObserver(
      (entries) => {
        if (entries.some((entry) => entry.isIntersecting)) {
          element.setAttribute("data-in", "");
          observer.disconnect();
        }
      },
      { threshold },
    );
    observer.observe(element);
    return () => observer.disconnect();
  }, [ref, threshold]);
}

/** Whether the element is on screen now: repeating stories stop while it is not. */
export function useOnScreen(ref: RefObject<HTMLElement | null>): boolean {
  const [visible, setVisible] = useState(false);
  useEffect(() => {
    const element = ref.current;
    if (element === null)
      throw new Error("useOnScreen: the element is not mounted");
    const observer = new IntersectionObserver((entries) => {
      setVisible(entries.some((entry) => entry.isIntersecting));
    });
    observer.observe(element);
    return () => observer.disconnect();
  }, [ref]);
  return visible;
}
