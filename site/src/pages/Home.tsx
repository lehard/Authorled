import { useRef } from "react";

import { BetaTabs } from "../blocks/BetaTabs";
import { Faq } from "../blocks/Faq";
import { Hero } from "../blocks/Hero";
import { Impact } from "../blocks/Impact";
import { Sandbox } from "../blocks/Sandbox";
import { StoryPath } from "../blocks/StoryPath";
import { Vision } from "../blocks/Vision";
import { BetaForm } from "../components/BetaForm";
import { BETA_FORM } from "../content/copy";
import { useInView } from "../motion/hooks";
import { APP_URL } from "../site";

// The main page (openspec/specs/web/site, «Главная страница»): blocks in the order of the spec.

function Signup() {
  const ref = useRef<HTMLDivElement>(null);
  useInView(ref);
  return (
    <section
      id="beta"
      aria-labelledby="beta-title"
      className="scroll-mt-24 px-4 py-16 sm:px-6 sm:py-24"
    >
      <div
        ref={ref}
        data-reveal
        className="mx-auto grid w-full max-w-6xl items-start gap-10 lg:grid-cols-[2fr_3fr]"
      >
        <div className="flex flex-col gap-4">
          <h2 id="beta-title" className="heading-2 text-foreground">
            {BETA_FORM.title}
          </h2>
          <p className="body-lg text-muted-foreground">{BETA_FORM.lead}</p>
          <p className="body-6 text-muted-foreground">
            {BETA_FORM.invited}{" "}
            <a
              className="text-primary underline underline-offset-2 hover:no-underline"
              href={APP_URL}
            >
              {BETA_FORM.signIn}
            </a>{" "}
            {BETA_FORM.invitedTail}
          </p>
        </div>
        <BetaForm />
      </div>
    </section>
  );
}

export function Home() {
  return (
    <>
      <Hero />
      <Vision />
      <Sandbox />
      <BetaTabs />
      <StoryPath />
      <Impact />
      <Faq />
      <Signup />
    </>
  );
}
