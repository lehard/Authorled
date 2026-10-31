import type { Block } from "@/data/model";

/** Scenes and a rough screen time: about 12 characters per second, as in mockup v2. */
export function scriptFacts(blocks: Block[]): {
  scenes: number;
  duration: string;
} {
  const scenes = blocks.filter((b) => b.t === "sh").length;
  const chars = blocks
    .filter((b) => !["act", "seq", "beat", "note"].includes(b.t))
    .reduce((n, b) => n + b.text.length, 0);
  const seconds = Math.round(chars / 12);
  return {
    scenes,
    duration: `${Math.floor(seconds / 60)}:${String(seconds % 60).padStart(2, "0")}`,
  };
}
