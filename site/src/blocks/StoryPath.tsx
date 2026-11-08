import { useRef, useState } from "react";

import { PATH } from "../content/copy";
import { GROUPS, STAGES } from "../content/concept";
import { useInView } from "../motion/hooks";

// «Путь истории» (openspec/specs/web/site, «Путь истории»; design D7): 22 stages on a snake line that draws
// itself in view; choosing a stage shows the concept frame of its group. Everything here is a concept.

const W = 1000;
const H = 420;
const ROWS = [70, 210, 350];
// Columns stay 80 units inside the edges, so the labels of the end stages fit.
const COLUMN = (col: number) => 80 + col * 120;

/** Center of stage `n` (1-based) on the snake: 1–8 left to right, 9–16 back, 17–22 left to right. */
function point(n: number): [number, number] {
  const index = n - 1;
  const row = Math.floor(index / 8);
  const inRow = index % 8;
  const col = row === 1 ? 7 - inRow : inRow;
  return [COLUMN(col), ROWS[row]];
}

const LINE = [
  `M ${COLUMN(0)} ${ROWS[0]} L ${COLUMN(7)} ${ROWS[0]}`,
  `C ${COLUMN(7) + 70} ${ROWS[0]} ${COLUMN(7) + 70} ${ROWS[1]} ${COLUMN(7)} ${ROWS[1]}`,
  `L ${COLUMN(0)} ${ROWS[1]}`,
  `C ${COLUMN(0) - 70} ${ROWS[1]} ${COLUMN(0) - 70} ${ROWS[2]} ${COLUMN(0)} ${ROWS[2]}`,
  `L ${COLUMN(5)} ${ROWS[2]}`,
].join(" ");

function groupOf(stage: number): number {
  const index = GROUPS.findIndex(
    (group) => stage >= group.from && stage <= group.to,
  );
  if (index < 0) throw new Error(`StoryPath: stage ${stage} is in no group`);
  return index;
}

const NODE =
  "grid size-9 place-items-center rounded-full caption-3 tabular-nums ring-1 transition-[background-color,transform] duration-300 ease-base focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ring active:scale-95";

export function StoryPath() {
  const section = useRef<HTMLDivElement>(null);
  const line = useRef<SVGSVGElement>(null);
  useInView(section);
  useInView(line, 0.4);
  const [group, setGroup] = useState(0);
  const frame = GROUPS[group].frame;

  const nodeClass = (stage: number) =>
    `${NODE} ${groupOf(stage) === group ? "bg-ai text-paper ring-ai scale-110" : "bg-paper text-foreground ring-border-strong hover:bg-muted"}`;

  return (
    <section
      aria-labelledby="path-title"
      className="bg-panel px-4 py-16 sm:px-6 sm:py-24"
    >
      <div
        ref={section}
        data-reveal
        className="mx-auto flex w-full max-w-6xl flex-col gap-10"
      >
        <div className="flex max-w-[720px] flex-col gap-4">
          <p className="w-fit rounded-full bg-muted px-3 py-1 caption-1 text-muted-foreground ring-1 ring-border">
            {PATH.badge}
          </p>
          <h2 id="path-title" className="heading-2 text-foreground">
            {PATH.title}
          </h2>
          <p className="body-lg text-muted-foreground">{PATH.lead}</p>
          <p className="body-3 text-muted-foreground">{PATH.notYet}</p>
        </div>

        {/* Wide screens: the snake. */}
        <div className="relative hidden aspect-[1000/420] w-full sm:block">
          <svg
            ref={line}
            viewBox={`0 0 ${W} ${H}`}
            className="absolute inset-0 size-full text-border-strong"
            aria-hidden="true"
          >
            <path
              d={LINE}
              pathLength={1}
              data-draw
              fill="none"
              stroke="currentColor"
              strokeWidth={2}
              strokeLinecap="round"
              vectorEffect="non-scaling-stroke"
            />
          </svg>
          <ol className="absolute inset-0">
            {STAGES.map((name, index) => {
              const stage = index + 1;
              const [x, y] = point(stage);
              return (
                <li
                  key={name}
                  className="absolute flex w-28 -translate-x-1/2 -translate-y-[18px] flex-col items-center gap-1.5 text-center"
                  style={{
                    left: `${(x / W) * 100}%`,
                    top: `${(y / H) * 100}%`,
                  }}
                >
                  <button
                    type="button"
                    className={nodeClass(stage)}
                    aria-pressed={groupOf(stage) === group}
                    onClick={() => setGroup(groupOf(stage))}
                  >
                    {stage}
                  </button>
                  <span className="caption-3 font-medium text-pretty text-muted-foreground">
                    {name}
                  </span>
                </li>
              );
            })}
          </ol>
        </div>

        {/* Phones: two lists. */}
        <div className="grid gap-8 sm:hidden">
          {[
            { title: PATH.coreTitle, from: 1, to: 12 },
            { title: PATH.featureTitle, from: 13, to: 22 },
          ].map((part) => (
            <div key={part.title} className="flex flex-col gap-3">
              <h3 className="title-3 text-foreground">{part.title}</h3>
              <ol className="flex flex-col gap-2">
                {STAGES.slice(part.from - 1, part.to).map((name, index) => {
                  const stage = part.from + index;
                  return (
                    <li key={name}>
                      <button
                        type="button"
                        aria-pressed={groupOf(stage) === group}
                        onClick={() => setGroup(groupOf(stage))}
                        className="flex w-full items-center gap-3 text-left body-6 text-foreground"
                      >
                        <span className={nodeClass(stage)}>{stage}</span>
                        {name}
                      </button>
                    </li>
                  );
                })}
              </ol>
            </div>
          ))}
        </div>

        <p className="body-6 text-muted-foreground">{PATH.pick}</p>
        <figure key={frame.image} className="site-fade-in flex flex-col gap-3">
          <div className="overflow-hidden rounded-2xl bg-paper p-2 shadow-panel ring-1 ring-border">
            <img
              className="block h-auto w-full rounded-xl"
              src={`/concept/${frame.image}-1440.webp`}
              srcSet={`/concept/${frame.image}-720.webp 720w, /concept/${frame.image}-1080.webp 1080w, /concept/${frame.image}-1440.webp 1440w`}
              sizes="(min-width: 1152px) 1120px, 100vw"
              width={1440}
              height={900}
              alt={frame.alt}
              loading="lazy"
            />
          </div>
          <figcaption className="body-6 text-muted-foreground">
            <span className="mr-2 rounded-full bg-muted px-2 py-0.5 caption-3 ring-1 ring-border">
              {PATH.badge}
            </span>
            Этапы{" "}
            {GROUPS[group].from === GROUPS[group].to
              ? GROUPS[group].from
              : `${GROUPS[group].from}–${GROUPS[group].to}`}
            . {frame.caption}
          </figcaption>
        </figure>
      </div>
    </section>
  );
}
