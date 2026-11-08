import { useEffect, useRef, useState } from "react";

import { IMPACT_COPY } from "../content/copy";
import { DECISION, IMPACTED, SCAN, UNTOUCHED } from "../content/concept";
import { prefersReducedMotion, useInView } from "../motion/hooks";

// «Передумали — соавтор покажет, что это задело» (openspec/specs/web/site, «Схема последствий»; design D8):
// the data of the screen `impact` of the mockup «Кабинет». A concept: none of it is in the beta.

type Stage =
  { kind: "idle" } | { kind: "scanning"; step: number } | { kind: "done" };

const STEP_MS = 700;
const CX = 170;
const CY = 150;
const R = 112;

const NODES = [
  ...IMPACTED.map((doc) => ({
    n: doc.n,
    short: doc.short,
    verdict: doc.verdict as "stale" | "conflict" | "ok",
  })),
  ...UNTOUCHED.map((doc) => ({
    n: doc.n,
    short: doc.short,
    verdict: "ok" as const,
  })),
];

const TONE = {
  stale: "text-status-stale",
  conflict: "text-status-conflict",
  ok: "text-muted-foreground",
} as const;

export function Impact() {
  const section = useRef<HTMLDivElement>(null);
  useInView(section);
  const [stage, setStage] = useState<Stage>({ kind: "idle" });

  useEffect(() => {
    if (stage.kind !== "scanning") return;
    const timer = window.setTimeout(() => {
      setStage(
        stage.step + 1 < SCAN.length
          ? { kind: "scanning", step: stage.step + 1 }
          : { kind: "done" },
      );
    }, STEP_MS);
    return () => window.clearTimeout(timer);
  }, [stage]);

  const changed = stage.kind !== "idle";
  const done = stage.kind === "done";
  // Lines get `data-draw` first and their group `data-in` a frame later, so the CSS transition can run.
  const [drawn, setDrawn] = useState(false);
  useEffect(() => {
    if (!done) return;
    const frame = requestAnimationFrame(() => setDrawn(true));
    return () => cancelAnimationFrame(frame);
  }, [done]);
  const points = NODES.map((node, index) => {
    const angle = -Math.PI / 2 + (index * 2 * Math.PI) / NODES.length;
    return {
      ...node,
      x: CX + R * Math.cos(angle),
      y: CY + R * Math.sin(angle),
    };
  });

  return (
    <section
      aria-labelledby="impact-title"
      className="px-4 py-16 sm:px-6 sm:py-24"
    >
      <div
        ref={section}
        data-reveal
        className="mx-auto flex w-full max-w-6xl flex-col gap-10"
      >
        <div className="flex max-w-[720px] flex-col gap-4">
          <p className="w-fit rounded-full bg-muted px-3 py-1 caption-1 text-muted-foreground ring-1 ring-border">
            {IMPACT_COPY.badge}
          </p>
          <h2 id="impact-title" className="heading-2 text-foreground">
            {IMPACT_COPY.title}
          </h2>
          <p className="body-lg text-muted-foreground">{IMPACT_COPY.lead}</p>
          <p className="body-3 text-muted-foreground">{IMPACT_COPY.notYet}</p>
        </div>

        <div className="grid items-start gap-8 lg:grid-cols-[1.1fr_1fr]">
          <div className="flex flex-col gap-5 rounded-2xl bg-paper p-6 shadow-paper ring-1 ring-border">
            <p className="caption-3 text-muted-foreground uppercase">
              {DECISION.document} · {DECISION.question}
            </p>
            <div className="flex flex-col gap-2 font-serif text-xl text-paper-foreground">
              {changed ? (
                <>
                  <del className="text-muted-foreground decoration-deco-delete decoration-2">
                    {DECISION.was}
                  </del>
                  <ins className="site-fade-in text-paper-foreground no-underline">
                    {DECISION.now}
                  </ins>
                </>
              ) : (
                <p>{DECISION.was}</p>
              )}
            </div>
            <div className="flex flex-wrap gap-2">
              {changed ? (
                <button
                  type="button"
                  onClick={() => {
                    setStage({ kind: "idle" });
                    setDrawn(false);
                  }}
                  className="rounded-full px-4 py-2 button-sm text-foreground ring-1 ring-border-strong hover:bg-muted focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ring"
                >
                  {IMPACT_COPY.undo}
                </button>
              ) : (
                <button
                  type="button"
                  onClick={() =>
                    setStage(
                      prefersReducedMotion()
                        ? { kind: "done" }
                        : { kind: "scanning", step: 0 },
                    )
                  }
                  className="rounded-full bg-primary px-4 py-2 button-sm text-primary-foreground hover:bg-primary/90 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ring active:scale-[0.98]"
                >
                  {IMPACT_COPY.change}
                </button>
              )}
            </div>
            {changed ? (
              <ol
                className="flex flex-col gap-1.5 border-t border-border pt-4"
                aria-live="polite"
              >
                {SCAN.map((item, index) => {
                  const reached =
                    done || (stage.kind === "scanning" && index <= stage.step);
                  return (
                    <li
                      key={item.step}
                      className={`flex justify-between gap-4 body-6 transition-opacity duration-300 ease-fade ${reached ? "opacity-100" : "opacity-30"}`}
                    >
                      <span className="text-foreground">{item.step}</span>
                      <span className="text-muted-foreground tabular-nums">
                        {reached ? item.result : "…"}
                      </span>
                    </li>
                  );
                })}
              </ol>
            ) : null}
          </div>

          <figure className="flex flex-col items-center gap-3">
            <svg
              viewBox="0 0 340 300"
              className="w-full max-w-[420px]"
              role="img"
              aria-label="Схема: тема и семь документов, которые на неё опираются"
            >
              <g data-in={drawn ? "" : undefined}>
                {points.map((point) => (
                  <line
                    key={`line-${point.n}`}
                    x1={CX}
                    y1={CY}
                    x2={point.x}
                    y2={point.y}
                    pathLength={1}
                    className={
                      done ? TONE[point.verdict] : "text-border-strong"
                    }
                    stroke="currentColor"
                    strokeWidth={done && point.verdict !== "ok" ? 2.5 : 1.2}
                    strokeDasharray={
                      done && point.verdict !== "ok" ? undefined : "0.02 0.03"
                    }
                    data-draw={done && point.verdict !== "ok" ? "" : undefined}
                  />
                ))}
              </g>
              <circle cx={CX} cy={CY} r={30} className="fill-ai" />
              <text
                x={CX}
                y={CY + 4}
                textAnchor="middle"
                className="fill-paper text-[11px] font-semibold"
              >
                Тема
              </text>
              {points.map((point) => (
                <g
                  key={`node-${point.n}`}
                  className={
                    done ? TONE[point.verdict] : "text-muted-foreground"
                  }
                >
                  <circle
                    cx={point.x}
                    cy={point.y}
                    r={17}
                    className="fill-paper"
                    stroke="currentColor"
                    strokeWidth={done && point.verdict !== "ok" ? 2.5 : 1.2}
                  />
                  <text
                    x={point.x}
                    y={point.y + 4}
                    textAnchor="middle"
                    fill="currentColor"
                    className="text-[11px] font-semibold"
                  >
                    {point.n}
                  </text>
                  <text
                    x={point.x}
                    y={point.y + (point.y > CY ? 32 : -24)}
                    textAnchor="middle"
                    className="fill-muted-foreground text-[10px]"
                  >
                    {point.short}
                  </text>
                </g>
              ))}
            </svg>
            <figcaption className="title-3 text-foreground" aria-live="polite">
              {done
                ? `Задето ${IMPACTED.length} документа из ${NODES.length}`
                : `${NODES.length} документов опираются на тему`}
            </figcaption>
          </figure>
        </div>

        {done ? (
          <div className="site-fade-in grid gap-6 lg:grid-cols-3">
            {IMPACTED.map((doc) => (
              <article
                key={doc.n}
                className={`flex flex-col gap-2 rounded-2xl p-5 ring-1 ${doc.verdict === "stale" ? "bg-status-stale-subtle ring-status-stale-border" : "bg-status-conflict-subtle ring-status-conflict-border"}`}
              >
                <p className={`caption-3 uppercase ${TONE[doc.verdict]}`}>
                  {doc.verdict === "stale"
                    ? IMPACT_COPY.stale
                    : IMPACT_COPY.conflict}
                </p>
                <h3 className="title-2 text-foreground">
                  {doc.n}. {doc.name}
                </h3>
                <p className="font-serif body-6 text-foreground">{doc.quote}</p>
                <p className="body-6 text-muted-foreground">{doc.why}</p>
              </article>
            ))}
            <div className="flex flex-col gap-2 rounded-2xl bg-panel p-5 ring-1 ring-border lg:col-span-3">
              <p className="caption-3 text-muted-foreground uppercase">
                {IMPACT_COPY.untouchedTitle}
              </p>
              <ul className="grid gap-2 sm:grid-cols-2">
                {UNTOUCHED.map((doc) => (
                  <li key={doc.n} className="body-6 text-foreground">
                    <span className="font-medium">{doc.name}</span> —{" "}
                    <span className="text-muted-foreground">{doc.why}</span>
                  </li>
                ))}
              </ul>
            </div>
          </div>
        ) : null}
      </div>
    </section>
  );
}
