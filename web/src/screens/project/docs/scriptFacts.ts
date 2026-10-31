import { paragraphs, type ScreenplayDoc } from "@/editor/document.ts";

/** Scenes and a rough screen time: about 12 characters per second, as in mockup v2. */
export function scriptFacts(text: ScreenplayDoc): {
  scenes: number;
  duration: string;
} {
  const list = paragraphs(text);
  const scenes = list.filter((p) => p.type === "sceneHeading").length;
  const chars = list
    .filter((p) => !["act", "sequence", "beat", "inlineNote"].includes(p.type))
    .reduce((n, p) => n + p.text.length, 0);
  const seconds = Math.round(chars / 12);
  return {
    scenes,
    duration: `${Math.floor(seconds / 60)}:${String(seconds % 60).padStart(2, "0")}`,
  };
}
