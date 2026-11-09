import { useState, type CSSProperties } from "react";

import { LinkButton } from "../components/ui";
import { HEADLINE, HERO, HERO_CHECK } from "../content/copy";
import { CONTRADICTION } from "../content/demo";
import { APP_URL } from "../site";

// The first screen (openspec/specs/web/site, «Главная страница», «Противоречие в первом экране»; design D1–D3 of
// site-hero-contradiction). It appears on load in reading order: scene 5, scene 6, the line between them, then the
// co-author's card. The visitor shows the two lines in the text or marks the contradiction as intended.

const order = (i: number): CSSProperties => ({ "--i": i }) as CSSProperties;
const draw = (delay: number): CSSProperties =>
  ({ "--draw-delay": `${delay}ms` }) as CSSProperties;

type Scene = (typeof CONTRADICTION)["first"];
type State = "flagged" | "shown" | "intended";

/** One piece of the line that links the two scenes, grown in turn on load; the dot marks a scene. */
function Rail({
  from,
  to,
  dot,
  delay,
  linked,
}: {
  from: string;
  to: string;
  /** Order of appearance of the dot: with its scene card. */
  dot?: number;
  delay: number;
  linked: boolean;
}) {
  return (
    <div
      aria-hidden="true"
      className={`relative transition-opacity duration-300 ease-base ${linked ? "" : "opacity-0"}`}
    >
      <div
        className="absolute left-[calc(50%-1px)] w-0.5 origin-top rounded-full bg-ai-border"
        style={{ top: from, bottom: to, ...draw(delay) }}
        data-rail
      />
      {dot === undefined ? null : (
        <span
          className="absolute top-[1.1rem] left-[calc(50%-0.3125rem)] size-2.5 rounded-full bg-ai"
          data-appear
          style={order(dot)}
        />
      )}
    </div>
  );
}

function SceneCard({
  scene,
  lit,
  i,
}: {
  scene: Scene;
  lit: boolean;
  i: number;
}) {
  return (
    <div
      className="rounded-xl bg-paper px-4 py-3 text-paper-foreground shadow-paper ring-1 ring-border sm:px-5"
      data-appear
      style={order(i)}
    >
      <p className="caption-1 text-muted-foreground">
        {HERO_CHECK.scene} {scene.number} · {scene.place}
      </p>
      <p className="mt-2 font-mono text-base leading-7 uppercase">
        {scene.character}
      </p>
      <p className="font-mono text-base leading-7">
        <mark
          className={`rounded-sm px-0.5 text-inherit ${lit ? "bg-ai-subtle ring-1 ring-ai-border" : "bg-transparent"}`}
        >
          {scene.line}
        </mark>
      </p>
    </div>
  );
}

const primaryButton =
  "rounded-full bg-primary px-4 py-2 button-sm text-primary-foreground transition-transform duration-300 ease-base hover:bg-primary/90 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ring active:scale-[0.98]";
const secondaryButton =
  "rounded-full px-4 py-2 button-sm text-foreground ring-1 ring-border-strong transition-transform duration-300 ease-base hover:bg-muted focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ring active:scale-[0.98]";

function ContradictionCheck() {
  const [state, setState] = useState<State>("flagged");
  const linked = state !== "intended";
  const lit = state === "shown";
  return (
    <figure className="flex flex-col gap-3">
      <div className="rounded-2xl bg-panel p-3 shadow-panel ring-1 ring-border sm:p-4">
        <div className="grid grid-cols-[1rem_1fr] gap-x-3">
          <Rail from="1.4rem" to="0" dot={6} delay={1000} linked={linked} />
          <div className="pb-3">
            <SceneCard scene={CONTRADICTION.first} lit={lit} i={6} />
          </div>
          <Rail from="0" to="0" delay={1200} linked={linked} />
          <div className="pb-3">
            <div
              role="group"
              aria-label={HERO_CHECK.group}
              className="rounded-xl bg-card p-4 ring-1 ring-ai-border"
              data-appear
              style={order(23)}
            >
              <div aria-live="polite">
                {state === "intended" ? (
                  <div className="site-fade-in flex flex-wrap items-center justify-between gap-3">
                    <p className="body-6 text-foreground">
                      {HERO_CHECK.marked}
                    </p>
                    <button
                      type="button"
                      className={secondaryButton}
                      onClick={() => setState("flagged")}
                    >
                      {HERO_CHECK.again}
                    </button>
                  </div>
                ) : (
                  <div className="flex flex-col gap-3">
                    <p className="caption-1 text-ai">{HERO_CHECK.label}</p>
                    <p className="body-6 text-foreground">
                      {CONTRADICTION.note}
                    </p>
                    <div className="flex flex-wrap gap-2">
                      <button
                        type="button"
                        className={primaryButton}
                        aria-pressed={lit}
                        onClick={() => setState(lit ? "flagged" : "shown")}
                      >
                        {lit ? HERO_CHECK.hide : HERO_CHECK.show}
                      </button>
                      <button
                        type="button"
                        className={secondaryButton}
                        onClick={() => setState("intended")}
                      >
                        {HERO_CHECK.intended}
                      </button>
                    </div>
                  </div>
                )}
              </div>
            </div>
          </div>
          <Rail
            from="0"
            to="calc(100% - 1.4rem)"
            dot={8}
            delay={1400}
            linked={linked}
          />
          <SceneCard scene={CONTRADICTION.second} lit={lit} i={8} />
        </div>
      </div>
      <figcaption
        className="body-6 text-muted-foreground"
        data-appear
        style={order(24)}
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
        <ContradictionCheck />
      </div>
    </section>
  );
}
