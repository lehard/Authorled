import { useEffect, useRef, useState } from "react";

import { SANDBOX } from "../content/copy";
import { AFTER, SCENE, SUGGESTION } from "../content/demo";
import { ANSWERS } from "../content/sandbox";
import { prefersReducedMotion, useInView, useOnScreen } from "../motion/hooks";

// The sandbox «Спросите соавтора» (openspec/specs/web/site; design D5): prepared answers are typed word by
// word into a chat that looks like the co-author panel of the beta. No request leaves the page.

const WORDS_PER_SECOND = 32;

function wordsOf(paragraphs: string[]): number {
  return paragraphs.join(" ").split(" ").length;
}

/** The first `count` words of the answer, kept in its paragraphs. */
function cut(paragraphs: string[], count: number): string[] {
  const out: string[] = [];
  let left = count;
  for (const paragraph of paragraphs) {
    if (left <= 0) break;
    const words = paragraph.split(" ");
    out.push(words.slice(0, left).join(" "));
    left -= words.length;
  }
  return out;
}

export function Sandbox() {
  const ref = useRef<HTMLDivElement>(null);
  const onScreen = useOnScreen(ref);
  useInView(ref);
  const [active, setActive] = useState(ANSWERS[0].id);
  // Words shown of the active answer; null — the whole answer (the prerendered state).
  const [shown, setShown] = useState<number | null>(null);

  const answer = ANSWERS.find((item) => item.id === active);
  if (answer === undefined) throw new Error(`Sandbox: no answer ${active}`);
  const total = wordsOf(answer.paragraphs);

  useEffect(() => {
    if (shown === null || shown >= total || !onScreen) return;
    let frame = 0;
    let last = performance.now();
    let carry = 0;
    const tick = (now: number) => {
      carry += ((now - last) / 1000) * WORDS_PER_SECOND;
      last = now;
      const step = Math.floor(carry);
      if (step > 0) {
        carry -= step;
        setShown((value) =>
          value === null ? null : Math.min(total, value + step),
        );
      }
      frame = requestAnimationFrame(tick);
    };
    frame = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(frame);
  }, [shown, total, onScreen]);

  function ask(id: string) {
    setActive(id);
    setShown(prefersReducedMotion() ? null : 0);
  }

  return (
    <section
      aria-labelledby="sandbox-title"
      className="bg-panel px-4 py-16 sm:px-6 sm:py-24"
    >
      <div
        className="mx-auto flex w-full max-w-6xl flex-col gap-10"
        data-reveal
        ref={ref}
      >
        <div className="flex max-w-[680px] flex-col gap-4">
          <h2 id="sandbox-title" className="heading-2 text-foreground">
            {SANDBOX.title}
          </h2>
          <p className="body-lg text-muted-foreground">{SANDBOX.lead}</p>
        </div>
        <div className="grid items-stretch gap-6 lg:grid-cols-[1fr_1.1fr]">
          <div className="rounded-2xl bg-paper px-5 py-6 font-mono text-sm leading-6 text-paper-foreground shadow-paper ring-1 ring-border sm:px-8">
            {SCENE.map((line, index) => (
              <p
                key={index}
                className={
                  line.kind === "heading"
                    ? "font-bold uppercase"
                    : line.kind === "character"
                      ? "mt-3 pl-[34%] uppercase"
                      : line.kind === "parenthetical"
                        ? "pl-[26%]"
                        : line.kind === "dialogue"
                          ? "pr-[12%] pl-[18%]"
                          : ""
                }
              >
                {line.text}
              </p>
            ))}
            <p className="pr-[12%] pl-[18%]">{SUGGESTION.before}</p>
            {AFTER.map((line, index) => (
              <p
                key={index}
                className={
                  line.kind === "character"
                    ? "mt-3 pl-[34%] uppercase"
                    : "pr-[12%] pl-[18%]"
                }
              >
                {line.text}
              </p>
            ))}
          </div>
          <div className="flex min-h-[420px] flex-col rounded-2xl bg-card ring-1 ring-border">
            <div className="border-b border-border px-5 py-3">
              <p className="title-3 text-ai">{SANDBOX.chatTitle}</p>
              <p className="caption-3 font-normal text-muted-foreground">
                {SANDBOX.chatSees}
              </p>
            </div>
            <div className="flex flex-1 flex-col gap-4 p-5">
              <div
                className="flex flex-wrap justify-end gap-2"
                role="group"
                aria-label="Вопросы соавтору"
              >
                {ANSWERS.map((item) => (
                  <button
                    key={item.id}
                    type="button"
                    aria-pressed={item.id === active}
                    onClick={() => ask(item.id)}
                    className="rounded-full px-4 py-2 body-6 text-foreground ring-1 ring-border-strong transition-colors duration-300 ease-base hover:bg-muted focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ring aria-pressed:bg-primary aria-pressed:text-primary-foreground aria-pressed:ring-primary"
                  >
                    {item.question}
                  </button>
                ))}
              </div>
              {ANSWERS.map((item) => {
                const isActive = item.id === active;
                const paragraphs =
                  isActive && shown !== null
                    ? cut(item.paragraphs, shown)
                    : item.paragraphs;
                return (
                  <div
                    key={item.id}
                    hidden={!isActive}
                    aria-live={isActive ? "polite" : undefined}
                    className="flex flex-col gap-2 rounded-xl bg-muted/60 p-4"
                  >
                    <p className="flex flex-wrap items-center gap-2 caption-3 text-muted-foreground">
                      <span className="rounded-full bg-paper px-2 py-0.5 ring-1 ring-border">
                        {SANDBOX.example}
                      </span>
                      {item.concept ? (
                        <span className="rounded-full bg-paper px-2 py-0.5 ring-1 ring-border">
                          {SANDBOX.concept}
                        </span>
                      ) : null}
                    </p>
                    {paragraphs.map((text, index) => (
                      <p key={index} className="body-6 text-foreground">
                        {text}
                      </p>
                    ))}
                  </div>
                );
              })}
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}
