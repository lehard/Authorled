// A research brief is a code block marked `research-brief` in the co-author's answer
// (openspec/specs/web/workspace, «Блок задания в чате»).

/** Whether an answer holds a research brief: the chat then has no «Скопировать» of its own under it. */
export function hasBrief(answer: string): boolean {
  return /^```research-brief\b/m.test(answer);
}
