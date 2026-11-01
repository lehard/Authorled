import { scenes, screenTime, type ScreenplayDoc } from "@/editor/document.ts";

/** Scenes and a rough screen time of the screenplay, counted as in the scene list. */
export function scriptFacts(text: ScreenplayDoc): {
  scenes: number;
  duration: string;
} {
  const list = scenes(text).filter((s) => s.kind === "scene");
  return {
    scenes: list.length,
    duration: screenTime(list.reduce((n, s) => n + s.chars, 0)),
  };
}
