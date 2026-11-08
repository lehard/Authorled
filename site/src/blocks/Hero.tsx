import { useState, type CSSProperties } from "react";

import { LinkButton } from "../components/ui";
import { HEADLINE, HERO, LIVE_EDIT } from "../content/copy";
import { AFTER, SCENE, SUGGESTION, type ScriptLine } from "../content/demo";
import { APP_URL } from "../site";

// The first screen (openspec/specs/web/site, «Главная страница», «Живая правка в первом экране»; design D3).
// It appears on load in reading order; the visitor accepts or rejects the co-author's suggestion right here.

const order = (i: number): CSSProperties => ({ "--i": i }) as CSSProperties;

function Line({ line }: { line: ScriptLine }) {
  switch (line.kind) {
    case "heading":
      return <p className="font-bold uppercase">{line.text}</p>;
    case "action":
      return <p>{line.text}</p>;
    case "character":
      return <p className="mt-3 pl-[34%] uppercase">{line.text}</p>;
    case "parenthetical":
      return <p className="pl-[26%]">{line.text}</p>;
    case "dialogue":
      return <p className="pr-[12%] pl-[18%]">{line.text}</p>;
  }
}

type Decision = "offered" | "accepted" | "rejected";

function LiveEdit() {
  const [decision, setDecision] = useState<Decision>("offered");
  return (
    <figure className="flex flex-col gap-3" data-appear style={order(6)}>
      <div className="rounded-2xl bg-panel p-2 shadow-panel ring-1 ring-border">
        <div className="flex flex-col gap-1 rounded-xl bg-paper px-5 py-6 font-mono text-sm leading-6 text-paper-foreground shadow-paper sm:px-8">
          {SCENE.map((line, index) => (
            <Line key={index} line={line} />
          ))}
          <p className="pr-[12%] pl-[18%]" aria-live="polite">
            {decision === "offered" ? (
              <>
                <del className="decoration-deco-delete decoration-2 opacity-70">
                  {SUGGESTION.before}
                </del>{" "}
                <ins className="rounded-sm bg-ai-subtle px-0.5 text-ai no-underline ring-1 ring-ai-border">
                  {SUGGESTION.after}
                </ins>
              </>
            ) : decision === "accepted" ? (
              <span className="site-fade-in">{SUGGESTION.after}</span>
            ) : (
              <span className="site-fade-in">{SUGGESTION.before}</span>
            )}
          </p>
          {AFTER.map((line, index) => (
            <Line key={index} line={line} />
          ))}
        </div>
        <div
          role="group"
          aria-label={LIVE_EDIT.label}
          className="mx-2 -mt-1 mb-1 rounded-xl bg-card p-4 ring-1 ring-ai-border sm:mx-6"
          data-appear
          style={order(10)}
        >
          {decision === "offered" ? (
            <div className="flex flex-col gap-3">
              <p className="caption-1 text-ai">{LIVE_EDIT.label}</p>
              <p className="body-6 text-muted-foreground">{SUGGESTION.why}</p>
              <div className="flex flex-wrap gap-2">
                <button
                  type="button"
                  className="rounded-full bg-primary px-4 py-2 button-sm text-primary-foreground transition-transform duration-300 ease-base hover:bg-primary/90 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ring active:scale-[0.98]"
                  onClick={() => setDecision("accepted")}
                >
                  {LIVE_EDIT.accept}
                </button>
                <button
                  type="button"
                  className="rounded-full px-4 py-2 button-sm text-foreground ring-1 ring-border-strong transition-transform duration-300 ease-base hover:bg-muted focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ring active:scale-[0.98]"
                  onClick={() => setDecision("rejected")}
                >
                  {LIVE_EDIT.reject}
                </button>
              </div>
            </div>
          ) : (
            <div className="site-fade-in flex flex-wrap items-center justify-between gap-3">
              <p className="body-6 text-foreground">
                {decision === "accepted"
                  ? LIVE_EDIT.accepted
                  : LIVE_EDIT.rejected}
              </p>
              <button
                type="button"
                className="rounded-full px-4 py-2 button-sm text-foreground ring-1 ring-border-strong hover:bg-muted focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ring"
                onClick={() => setDecision("offered")}
              >
                {LIVE_EDIT.again}
              </button>
            </div>
          )}
        </div>
      </div>
      <figcaption
        className="body-6 text-muted-foreground"
        data-appear
        style={order(11)}
      >
        {HERO.sheetCaption}
      </figcaption>
    </figure>
  );
}

export function Hero() {
  return (
    <section
      aria-labelledby="hero-title"
      className="px-4 pt-10 pb-16 sm:px-6 sm:pt-16 sm:pb-24"
    >
      <div className="mx-auto grid w-full max-w-6xl items-center gap-12 lg:grid-cols-[1.05fr_1fr]">
        <div className="flex max-w-[680px] flex-col gap-6">
          <p
            className="w-fit rounded-full bg-ai-subtle px-3 py-1 caption-1 text-ai ring-1 ring-ai-border"
            data-appear
            style={order(1)}
          >
            {HERO.badge}
          </p>
          <h1
            id="hero-title"
            className="heading-1 text-foreground"
            data-appear
            style={order(2)}
          >
            {HEADLINE.first}{" "}
            <span
              className="block text-balance text-ai"
              data-appear
              style={order(8)}
            >
              {HEADLINE.second}
            </span>
          </h1>
          <p
            className="body-lg text-muted-foreground"
            data-appear
            style={order(3)}
          >
            {HERO.lead}
          </p>
          <div
            className="flex flex-wrap items-center gap-3"
            data-appear
            style={order(4)}
          >
            <LinkButton variant="primary" href="#beta">
              {HERO.primary}
            </LinkButton>
            <LinkButton variant="secondary" href={APP_URL}>
              {HERO.secondary}
            </LinkButton>
          </div>
          <p
            className="body-6 text-muted-foreground"
            data-appear
            style={order(5)}
          >
            {HERO.note}
          </p>
        </div>
        <LiveEdit />
      </div>
    </section>
  );
}
