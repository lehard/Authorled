import { useState, type ReactNode } from "react";

import { ONE_ACTION } from "../content/copy";
import { ONE_ACTION_QUOTES } from "../content/demo";

// The «one action» cards under the beta tabs (openspec/specs/web/site, «Карточки „одно действие“»; design D3 of
// site-coauthor-examples): what the co-author of the beta does in one step, on the demo story. The suggestion card
// is accepted or rejected like a suggestion in the beta, and can be brought back; the prerender shows it offered.

type State = "offered" | "accepted" | "rejected";

const button =
  "rounded-full px-4 py-2 button-sm transition-transform duration-300 ease-base focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ring active:scale-[0.98]";
const primary = `${button} bg-primary text-primary-foreground hover:bg-primary/90`;
const secondary = `${button} text-foreground ring-1 ring-border-strong hover:bg-muted`;

function Card({ label, children }: { label: string; children: ReactNode }) {
  return (
    <li className="flex flex-col gap-3 rounded-2xl bg-card p-5 ring-1 ring-border">
      <p className="caption-1 text-ai">{label}</p>
      {children}
    </li>
  );
}

function Sheet({
  caption,
  children,
}: {
  caption: string;
  children: ReactNode;
}) {
  return (
    <div className="rounded-xl bg-paper px-4 py-3 text-paper-foreground shadow-paper ring-1 ring-border">
      <p className="caption-3 font-normal text-muted-foreground">{caption}</p>
      <div className="mt-1 font-mono text-sm leading-6">{children}</div>
    </div>
  );
}

function SuggestionCard() {
  const [state, setState] = useState<State>("offered");
  const { suggestion } = ONE_ACTION_QUOTES;
  const copy = ONE_ACTION.suggestion;
  return (
    <Card label={copy.label}>
      <Sheet caption={`${ONE_ACTION.scene} ${suggestion.scene}`}>
        {state === "offered" ? (
          <p>
            <del className="text-muted-foreground">{suggestion.before}</del>{" "}
            <ins className="rounded-sm bg-ai-subtle px-0.5 no-underline ring-1 ring-ai-border">
              {suggestion.after}
            </ins>
          </p>
        ) : (
          <p className="site-fade-in">
            {state === "accepted" ? suggestion.after : suggestion.before}
          </p>
        )}
      </Sheet>
      <div role="group" aria-label={copy.group} className="flex flex-col gap-3">
        <div aria-live="polite">
          {state === "offered" ? (
            <p className="body-6 text-foreground">{suggestion.why}</p>
          ) : (
            <p className="site-fade-in body-6 text-foreground">
              {state === "accepted" ? copy.accepted : copy.rejected}
            </p>
          )}
        </div>
        <div className="flex flex-wrap gap-2">
          {state === "offered" ? (
            <>
              <button
                type="button"
                className={primary}
                onClick={() => setState("accepted")}
              >
                {copy.accept}
              </button>
              <button
                type="button"
                className={secondary}
                onClick={() => setState("rejected")}
              >
                {copy.reject}
              </button>
            </>
          ) : (
            <button
              type="button"
              className={secondary}
              onClick={() => setState("offered")}
            >
              {copy.undo}
            </button>
          )}
        </div>
      </div>
    </Card>
  );
}

export function OneAction() {
  const { line, comment } = ONE_ACTION;
  return (
    <div className="flex flex-col gap-4 pt-4">
      <div className="flex flex-col gap-1">
        <h3 className="heading-5 text-foreground">{ONE_ACTION.title}</h3>
        <p className="body-6 text-muted-foreground">{ONE_ACTION.caption}</p>
      </div>
      <ul className="grid items-start gap-4 lg:grid-cols-3">
        <Card label={line.label}>
          <Sheet caption={line.source}>
            <p>{ONE_ACTION_QUOTES.mishaGoal}</p>
          </Sheet>
          <p className="body-6 text-foreground">{line.note}</p>
        </Card>
        <SuggestionCard />
        <Card label={comment.label}>
          <Sheet
            caption={`${ONE_ACTION.scene} ${ONE_ACTION_QUOTES.comment.scene}`}
          >
            <p>{ONE_ACTION_QUOTES.comment.quote}</p>
          </Sheet>
          <p className="border-l-2 border-ai-border pl-3 body-6 text-foreground">
            {comment.text}
          </p>
        </Card>
      </ul>
    </div>
  );
}
